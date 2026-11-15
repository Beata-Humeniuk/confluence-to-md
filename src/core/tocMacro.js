const { mdAnchorOf } = require('./tocAnchors');

// The Confluence table of contents macro as [toc] on a line of its own, as the
// visual editor writes it. Confluence builds the list from the page's
// headings, so the file keeps only where it goes.
const TOC = /^\[toc\]$/i;
const TOC_MARKDOWN = '[toc]';
const TOC_MACRO = '<ac:structured-macro ac:name="toc" ac:schema-version="1" />';

function isTocInline(token) {
  return !!token && token.type === 'inline' && TOC.test(token.content.trim()) &&
    (token.children || []).every((child) => child.type === 'text');
}

function headingText(inline) {
  return (inline.children || []).filter((child) => child.type === 'text' || child.type === 'code_inline')
    .map((child) => child.content).join('');
}

function tocList(tokens, escapeHtml) {
  const headings = [];
  const seen = new Map();
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type !== 'heading_open' || !tokens[i + 1]) continue;
    const text = headingText(tokens[i + 1]).trim();
    if (!text) continue;
    let slug = mdAnchorOf(text);
    const n = seen.get(slug) || 0;
    seen.set(slug, n + 1);
    if (n) slug += '-' + n;
    headings.push({ level: Number(tokens[i].tag.slice(1)), text, slug });
  }
  if (!headings.length) return '';
  const top = Math.min(...headings.map((h) => h.level));
  let html = '';
  let depth = 0;
  for (const h of headings) {
    const level = h.level - top + 1;
    if (level > depth) html += '<ul><li>'.repeat(level - depth);
    else html += '</li>' + '</ul></li>'.repeat(depth - level) + '<li>';
    depth = level;
    html += '<a href="#' + escapeHtml(h.slug) + '">' + escapeHtml(h.text) + '</a>';
  }
  return html + '</li></ul>'.repeat(depth);
}

// markdown-it plugin: a paragraph or table cell that holds only [toc] is the
// table of contents macro. The preview shows the page's headings in its place.
function tocMacro(md, options) {
  const storage = !!(options && options.storage);

  md.core.ruler.after('inline', 'confluence_to_md_toc', (state) => {
    const tokens = state.tokens;
    // The preview's list needs the headings of the whole page, which a table
    // cell's own tokens do not have.
    if (state.env && typeof state.env === 'object') state.env.confluenceToMdTokens = tokens;
    for (let i = 0; i < tokens.length; i++) {
      if (!isTocInline(tokens[i])) continue;
      const paragraph = tokens[i - 1] && tokens[i - 1].type === 'paragraph_open' &&
        tokens[i + 1] && tokens[i + 1].type === 'paragraph_close';
      if (paragraph) {
        const toc = new state.Token('confluence_toc', '', 0);
        toc.block = true;
        toc.map = tokens[i - 1].map;
        tokens.splice(i - 1, 3, toc);
        i -= 1;
      } else if (tokens[i - 1] && /^t[hd]_open$/.test(tokens[i - 1].type)) {
        tokens[i].children = [new state.Token('confluence_toc', '', 0)];
      }
    }
  });

  md.renderer.rules.confluence_toc = (tokens, idx, opts, env) => {
    if (storage) return TOC_MACRO + (tokens[idx].block ? '\n' : '');
    const all = (env && env.confluenceToMdTokens) || tokens;
    return '<div class="confluence-to-md-toc">' + tocList(all, md.utils.escapeHtml) + '</div>' +
      (tokens[idx].block ? '\n' : '');
  };

  return md;
}

module.exports = { tocMacro, TOC_MARKDOWN };
