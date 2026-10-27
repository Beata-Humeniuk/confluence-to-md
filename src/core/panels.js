// Confluence panels as GitHub alerts, matched by colour: info is blue, tip
// (Success) green, note (Warning) yellow and warning (Error) red.
const ALERT_OF_MACRO = { info: 'NOTE', information: 'NOTE', tip: 'TIP', note: 'WARNING', warning: 'CAUTION' };
const MACRO_OF_ALERT = { NOTE: 'info', IMPORTANT: 'info', TIP: 'tip', WARNING: 'note', CAUTION: 'warning' };
const MARKER = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*(.*)$/i;

function panelMarkdown(kind, title, content) {
  const alert = ALERT_OF_MACRO[String(kind || '').toLowerCase()] || '';
  const head = alert ? ['[!' + alert + ']' + (title ? ' ' + title : '')] : (title ? ['**' + title + '**', ''] : []);
  const lines = head.concat(String(content).trim().split('\n'));
  return lines.map((line) => ('> ' + line).trimEnd()).join('\n');
}

function panelMacro(alert, title, body) {
  return '<ac:structured-macro ac:name="' + MACRO_OF_ALERT[alert] + '" ac:schema-version="1">' +
    (title ? '<ac:parameter ac:name="title">' + title + '</ac:parameter>' : '') +
    '<ac:rich-text-body>' + body + '</ac:rich-text-body></ac:structured-macro>';
}

// markdown-it plugin: a blockquote that starts with [!TYPE] is a panel. The
// marker line is removed from the text; the rest of it is the title.
function panels(md, options) {
  const storage = !!(options && options.storage);

  md.core.ruler.after('block', 'confluence_to_md_panels', (state) => {
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length - 3; i++) {
      if (tokens[i].type !== 'blockquote_open' || tokens[i + 1].type !== 'paragraph_open') continue;
      const inline = tokens[i + 2];
      const newline = inline.content.indexOf('\n');
      const first = newline < 0 ? inline.content : inline.content.slice(0, newline);
      const m = MARKER.exec(first.trim());
      if (!m) continue;
      tokens[i].meta = { alert: m[1].toUpperCase(), title: m[2].trim() };
      if (newline < 0) tokens.splice(i + 1, 3);
      else inline.content = inline.content.slice(newline + 1);
    }
  });

  const open = md.renderer.rules.blockquote_open ||
    ((tokens, idx, opts, env, self) => self.renderToken(tokens, idx, opts));
  const close = md.renderer.rules.blockquote_close ||
    ((tokens, idx, opts, env, self) => self.renderToken(tokens, idx, opts));
  const opened = [];

  md.renderer.rules.blockquote_open = (tokens, idx, opts, env, self) => {
    const panel = tokens[idx].meta && tokens[idx].meta.alert ? tokens[idx].meta : null;
    opened.push(panel);
    if (!panel) return open(tokens, idx, opts, env, self);
    const title = md.utils.escapeHtml(panel.title);
    if (storage) {
      return '<ac:structured-macro ac:name="' + MACRO_OF_ALERT[panel.alert] + '" ac:schema-version="1">' +
        (title ? '<ac:parameter ac:name="title">' + title + '</ac:parameter>' : '') + '<ac:rich-text-body>\n';
    }
    const kind = panel.alert.toLowerCase();
    return '<div class="confluence-to-md-panel confluence-to-md-panel-' + kind + '">\n' +
      '<p class="confluence-to-md-panel-title">' +
      (title || panel.alert.charAt(0) + panel.alert.slice(1).toLowerCase()) + '</p>\n';
  };

  md.renderer.rules.blockquote_close = (tokens, idx, opts, env, self) => {
    const panel = opened.pop();
    if (!panel) return close(tokens, idx, opts, env, self);
    return storage ? '</ac:rich-text-body></ac:structured-macro>\n' : '</div>\n';
  };

  return md;
}

// A literal <br> stands for a line break, as in table cells, where Markdown
// has no other way to break a line.
function lineBreakTags(md) {
  md.inline.ruler.before('autolink', 'confluence_to_md_br', (state, silent) => {
    const m = /^<br\s*\/?>/i.exec(state.src.slice(state.pos));
    if (!m) return false;
    if (!silent) state.push('hardbreak', 'br', 0);
    state.pos += m[0].length;
    return true;
  });
  return md;
}

function paragraphs(lines) {
  const out = [];
  let current = [];
  for (const line of lines.concat([''])) {
    if (line.trim()) current.push(line);
    else if (current.length) {
      out.push('<p>' + current.join('<br />') + '</p>');
      current = [];
    }
  }
  return out.join('');
}

const LIST_ITEM = /^(?:- |\d+\. )/;

function listBlock(items) {
  const tag = /^- /.test(items[0]) ? 'ul' : 'ol';
  return '<' + tag + '>' + items.map((item) => '<li>' + item.replace(LIST_ITEM, '') + '</li>').join('') +
    '</' + tag + '>';
}

function cellBlocks(body) {
  const segments = body.split(/<br \/>\n?/);
  const blocks = [];
  let text = [];
  for (let i = 0; i < segments.length; i++) {
    if (LIST_ITEM.test(segments[i])) {
      if (text.length) blocks.push(paragraphs(text));
      text = [];
      const items = [];
      const ordered = !/^- /.test(segments[i]);
      while (i < segments.length && LIST_ITEM.test(segments[i]) && !/^- /.test(segments[i]) === ordered) {
        items.push(segments[i++]);
      }
      i -= 1;
      blocks.push(listBlock(items));
      continue;
    }
    if (!/^&gt;/.test(segments[i])) {
      text.push(segments[i]);
      continue;
    }
    if (text.length) blocks.push(paragraphs(text));
    text = [];
    const quote = [];
    while (i < segments.length && /^&gt;/.test(segments[i])) quote.push(segments[i++].replace(/^&gt; ?/, ''));
    i -= 1;
    const m = MARKER.exec(quote[0].trim());
    if (m) blocks.push(panelMacro(m[1].toUpperCase(), m[2].trim(), paragraphs(quote.slice(1))));
    else blocks.push('<blockquote>' + paragraphs(quote) + '</blockquote>');
  }
  if (text.length) blocks.push(paragraphs(text));
  return blocks.join('');
}

// Panels in table cells are written as quoted lines, like
// "> [!WARNING] Title<br>> text", and lists as "- item<br>- item", because a
// cell holds only one line.
function cellPanels(html) {
  return String(html).replace(/<(t[hd])([^>]*)>([\s\S]*?)<\/\1>/g, (m, tag, attrs, body) => {
    if (!/(?:^|<br \/>\n?)(?:&gt; ?\[!(?:NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]|- |\d+\. )/i.test(body)) return m;
    return '<' + tag + attrs + '>' + cellBlocks(body) + '</' + tag + '>';
  });
}

module.exports = { panels, lineBreakTags, cellPanels, panelMarkdown };
