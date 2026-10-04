const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;
const PART_ROW = /^[ \t]*(?:\d+[.)]|[-*])[ \t]+\[([^\]]*)\]\(([^()\s]+\.md)\)[ \t]*$/;
const HEADING = /^#{1,6}[ \t]+/;
const FENCE = /^[ \t]*(?:```|~~~)/;
const MD_LINK = /\[([^\]]*)\]\(([^()\s]+\.md)\)/g;

function stripFrontMatter(text) {
  return String(text).replace(FRONT_MATTER, '');
}

function isPart(text) {
  const block = String(text).match(FRONT_MATTER);
  if (!block) return false;
  return /^type:[ \t]*\S+-part[ \t]*$/m.test(block[1]) || /^parent:[ \t]*\S/m.test(block[1]);
}

function resolvePath(dir, rel) {
  let target = String(rel);
  if (/^[a-z][a-z0-9+.-]*:/i.test(target)) return null;
  if (target.charAt(0) === '/' || target.charAt(0) === '#') return null;
  try {
    target = decodeURIComponent(target);
  } catch (e) { }
  const out = dir ? dir.split('/') : [];
  for (const segment of target.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      if (!out.length) return null;
      out.pop();
      continue;
    }
    out.push(segment);
  }
  return out.length ? out.join('/') : null;
}

function dirOf(path) {
  const cut = path.lastIndexOf('/');
  return cut < 0 ? '' : path.slice(0, cut);
}

function partRows(markdown) {
  const rows = [];
  let fenced = false;
  const lines = String(markdown).split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (FENCE.test(lines[i])) fenced = !fenced;
    if (fenced) continue;
    const m = lines[i].match(PART_ROW);
    if (!m) continue;
    const path = resolvePath('', m[2]);
    if (path) rows.push({ line: i, title: m[1], path });
  }
  return rows;
}

function partPaths(markdown) {
  const seen = [];
  for (const row of partRows(markdown)) {
    if (seen.indexOf(row.path) < 0) seen.push(row.path);
  }
  return seen;
}

function anchorOf(body) {
  for (const line of body.split(/\r?\n/)) {
    if (!HEADING.test(line)) continue;
    return line.replace(HEADING, '')
      .replace(/\[([^\]]*)\]\([^()\s]*\)/g, '$1')
      .replace(/[*_`~]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return '';
}

function toAnchors(text, dir, anchors) {
  return text.replace(MD_LINK, (whole, label, target) => {
    const path = resolvePath(dir, target);
    const anchor = path && anchors.get(path);
    return anchor ? '[' + label + '](#' + encodeURIComponent(anchor) + ')' : whole;
  });
}

function headingsToDrop(lines, rows) {
  const inlined = new Set(rows.map((row) => row.line));
  const drop = new Set();
  let heading = -1;
  let onlyRows = false;
  const close = () => {
    if (heading >= 0 && onlyRows) drop.add(heading);
  };
  for (let i = 0; i < lines.length; i++) {
    if (HEADING.test(lines[i])) {
      close();
      heading = /^#{2,6}[ \t]+/.test(lines[i]) ? i : -1;
      onlyRows = false;
      continue;
    }
    if (heading < 0 || !lines[i].trim()) continue;
    if (inlined.has(i)) onlyRows = true;
    else { onlyRows = false; heading = -1; }
  }
  close();
  return drop;
}

function assembleParts(markdown, texts) {
  const read = (path) => (texts instanceof Map ? texts.get(path) : texts[path]);
  const lines = String(markdown).split(/\r?\n/);
  const rows = partRows(markdown).filter((row) => {
    const text = read(row.path);
    return typeof text === 'string' && isPart(text);
  });
  if (!rows.length) return { markdown: String(markdown), inlined: [], missing: [] };

  const bodies = new Map();
  const anchors = new Map();
  for (const row of rows) {
    if (bodies.has(row.path)) continue;
    const body = stripFrontMatter(read(row.path)).trim();
    bodies.set(row.path, body);
    anchors.set(row.path, anchorOf(body));
  }

  const dropped = headingsToDrop(lines, rows);
  const byLine = new Map(rows.map((row) => [row.line, row]));
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (dropped.has(i)) continue;
    const row = byLine.get(i);
    if (!row) {
      out.push(toAnchors(lines[i], '', anchors));
      continue;
    }
    if (bodies.get(row.path) === null) {
      out.push(toAnchors(lines[i], '', anchors));
      continue;
    }
    out.push('', toAnchors(bodies.get(row.path), dirOf(row.path), anchors), '');
    bodies.set(row.path, null);
  }

  const dirs = new Set(rows.map((row) => dirOf(row.path)));
  const missing = [];
  for (const row of partRows(markdown)) {
    if (read(row.path) !== null || !dirs.has(dirOf(row.path))) continue;
    if (!missing.some((m) => m.path === row.path)) missing.push({ path: row.path, title: row.title });
  }

  const inlined = [];
  for (const row of rows) {
    if (!inlined.some((m) => m.path === row.path)) inlined.push({ path: row.path, title: row.title });
  }
  return {
    markdown: out.join('\n').replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '').replace(/\n+$/, '') + '\n',
    inlined,
    missing
  };
}

module.exports = { partPaths, assembleParts, stripFrontMatter, isPart, resolvePath };
