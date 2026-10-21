// Markdown tables have no merged cells. A cell that contains only one of
// these markers belongs to the cell to its left or above it.
const MERGE_LEFT = '<<';
const MERGE_UP = '^^';

const CELL = /<(t[hd])\b([^>]*)>([\s\S]*?)<\/\1>/gi;
const ROW = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;

function spanOf(attrs, name) {
  const m = new RegExp('\\b' + name + '\\s*=\\s*"?(\\d+)', 'i').exec(attrs);
  return m ? Math.max(1, Math.min(parseInt(m[1], 10), 1000)) : 1;
}

function styleAlignment(attrs) {
  const m = /text-align\s*:\s*(left|center|right)/i.exec(attrs) || /\balign\s*=\s*"?(left|center|right)/i.exec(attrs);
  return m ? m[1].toLowerCase() : '';
}

// Confluence aligns the paragraphs inside a cell, not the cell itself.
function cellAlignment(attrs, body) {
  const own = styleAlignment(attrs);
  if (own) return own;
  const paragraphs = body.match(/<p\b[^>]*>/gi) || [];
  if (!paragraphs.length) return '';
  const first = styleAlignment(paragraphs[0]);
  return paragraphs.every((p) => styleAlignment(p) === first) ? first : '';
}

function expandTable(table) {
  const rows = [];
  table.replace(ROW, (m, row) => {
    const cells = [];
    row.replace(CELL, (mm, tag, attrs, body) => {
      cells.push({ tag, attrs, body, colspan: spanOf(attrs, 'colspan'), rowspan: spanOf(attrs, 'rowspan') });
      return mm;
    });
    rows.push(cells);
    return m;
  });

  const grid = rows.map(() => []);
  rows.forEach((cells, r) => {
    let c = 0;
    for (const cell of cells) {
      while (grid[r][c]) c += 1;
      const attrs = cell.attrs.replace(/\s(?:colspan|rowspan|align|style)\s*=\s*(?:"[^"]*"|[^\s>]*)/gi, '');
      const align = cellAlignment(cell.attrs, cell.body);
      for (let dr = 0; dr < cell.rowspan && r + dr < rows.length; dr++) {
        for (let dc = 0; dc < cell.colspan; dc++) {
          const origin = dr === 0 && dc === 0;
          grid[r + dr][c + dc] = { tag: cell.tag, attrs, origin, align: origin ? align : '',
            body: origin ? cell.body : (dc > 0 ? '&lt;&lt;' : MERGE_UP) };
        }
      }
      c += cell.colspan;
    }
  });

  // Markdown aligns whole columns: a column is aligned when most of its body
  // cells are, or when only its header cells are aligned.
  const width = Math.max(0, ...grid.map((cells) => cells.length));
  const columns = [];
  for (let c = 0; c < width; c++) {
    const cells = grid.map((cells) => cells[c]).filter((cell) => cell && cell.origin);
    const body = cells.filter((cell) => cell.tag.toLowerCase() === 'td');
    const voters = body.length ? body : cells;
    const counts = {};
    voters.forEach((cell) => { counts[cell.align] = (counts[cell.align] || 0) + 1; });
    const best = Object.keys(counts).filter((a) => a).sort((a, b) => counts[b] - counts[a])[0];
    columns.push(best && counts[best] * 2 > voters.length ? best : '');
  }

  let index = 0;
  return table.replace(ROW, (m) => {
    const cells = grid[index++];
    const html = [];
    for (let c = 0; c < cells.length; c++) {
      const cell = cells[c] || { tag: 'td', attrs: '', body: '' };
      html.push('<' + cell.tag + cell.attrs + (columns[c] ? ' align="' + columns[c] + '"' : '') + '>' +
        cell.body + '</' + cell.tag + '>');
    }
    return m.replace(/^(<tr\b[^>]*>)[\s\S]*$/i, (all, open) => open + html.join('') + '</tr>');
  });
}

// Spreads merged cells over the cells they cover and moves the alignment of
// the paragraphs in a cell to the cell, so the table converts to Markdown.
function expandTableSpans(html) {
  return String(html).replace(/<table\b[^>]*>(?:(?!<table\b)[\s\S])*?<\/table>/gi, expandTable);
}

function cellMarker(inline) {
  const text = inline && inline.content.trim();
  return text === MERGE_LEFT || text === MERGE_UP ? text : '';
}

function mergeSection(tokens, start, end) {
  const rows = [];
  let row = null;
  for (let i = start; i < end; i++) {
    const t = tokens[i];
    if (t.type === 'tr_open') rows.push(row = []);
    else if ((t.type === 'th_open' || t.type === 'td_open') && row) {
      row.push({ open: i, close: i + 2, marker: cellMarker(tokens[i + 1]) });
    }
  }

  // Each marker cell takes the owner of the cell it merges into.
  const owners = rows.map((cells) => cells.map(() => null));
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      const marker = rows[r][c].marker;
      let owner = { r, c };
      if (marker === MERGE_LEFT && c > 0) owner = owners[r][c - 1];
      else if (marker === MERGE_UP && r > 0 && owners[r - 1][c]) owner = owners[r - 1][c];
      owners[r][c] = owner;
    }
  }

  const areas = new Map();
  owners.forEach((cells, r) => cells.forEach((owner, c) => {
    const key = owner.r + ',' + owner.c;
    const area = areas.get(key) || { owner, cells: [] };
    area.cells.push({ r, c });
    areas.set(key, area);
  }));

  const remove = new Set();
  for (const { owner, cells } of areas.values()) {
    if (cells.length === 1) continue;
    const rowsSpanned = new Set(cells.map((x) => x.r));
    const colsSpanned = new Set(cells.map((x) => x.c));
    const rect = Math.max(...rowsSpanned) - owner.r + 1 === rowsSpanned.size &&
      Math.max(...colsSpanned) - owner.c + 1 === colsSpanned.size &&
      rowsSpanned.size * colsSpanned.size === cells.length;
    if (!rect) continue;
    const open = tokens[rows[owner.r][owner.c].open];
    if (colsSpanned.size > 1) open.attrSet('colspan', String(colsSpanned.size));
    if (rowsSpanned.size > 1) open.attrSet('rowspan', String(rowsSpanned.size));
    for (const x of cells) {
      if (x.r === owner.r && x.c === owner.c) continue;
      const cell = rows[x.r][x.c];
      for (let i = cell.open; i <= cell.close; i++) remove.add(i);
    }
  }
  return remove;
}

// markdown-it plugin: turns the markers into colspan and rowspan. The header
// and the body are merged separately, as HTML does not allow spans across them.
function tableSpans(md) {
  md.core.ruler.push('confluence_to_md_table_spans', (state) => {
    const remove = new Set();
    let sectionStart = -1;
    state.tokens.forEach((t, i) => {
      if (t.type === 'thead_open' || t.type === 'tbody_open') sectionStart = i;
      else if ((t.type === 'thead_close' || t.type === 'tbody_close') && sectionStart >= 0) {
        mergeSection(state.tokens, sectionStart, i).forEach((x) => remove.add(x));
        sectionStart = -1;
      }
    });
    if (remove.size) state.tokens = state.tokens.filter((t, i) => !remove.has(i));
  });
  return md;
}

module.exports = { expandTableSpans, tableSpans };
