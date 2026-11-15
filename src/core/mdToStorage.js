const MarkdownIt = require('markdown-it');
const { mermaidMacroXml } = require('./mermaid');
const { adaptMermaid } = require('./mermaidSyntax');
const { confluenceTargetOf } = require('./pageLink');
const { escapeXml, cdata } = require('./markup');
const { tableSpans } = require('./tableSpans');
const { panels, lineBreakTags, cellPanels } = require('./panels');
const { commentXml } = require('./comments');

function codeMacro(lang, code) {
  return '<ac:structured-macro ac:name="code" ac:schema-version="1">' +
    (lang ? '<ac:parameter ac:name="language">' + escapeXml(lang) + '</ac:parameter>' : '') +
    '<ac:plain-text-body>' + cdata(String(code).replace(/\n$/, '')) + '</ac:plain-text-body>' +
    '</ac:structured-macro>\n';
}

function taskLists(html) {
  return html.replace(/<ul>\s*((?:<li>(?:\s*<p>)?\[(?: |[xX])\][\s\S]*?<\/li>\s*)+)<\/ul>/g, (m, body) => {
    const tasks = [];
    body.replace(/<li>(?:\s*<p>)?\[( |[xX])\]\s?([\s\S]*?)(?:<\/p>\s*)?<\/li>/g, (mm, mark, text) => {
      tasks.push('<ac:task><ac:task-status>' + (mark === ' ' ? 'incomplete' : 'complete') +
        '</ac:task-status><ac:task-body>' + text.trim() + '</ac:task-body></ac:task>');
      return mm;
    });
    return '<ac:task-list>' + tasks.join('') + '</ac:task-list>';
  });
}

function confluenceLinks(html) {
  return html.replace(/<a href="confluence:([^"]*)"[^>]*>([\s\S]*?)<\/a>/g, (m, target, label) => {
    const { spaceKey, title } = confluenceTargetOf(target);
    if (!title) return label;
    return '<ac:link><ri:page ri:content-title="' + escapeXml(title) + '"' +
      (spaceKey ? ' ri:space-key="' + escapeXml(spaceKey) + '"' : '') + ' />' +
      '<ac:link-body>' + label + '</ac:link-body></ac:link>';
  });
}

function anchorLinks(html) {
  return html.replace(/<a href="#([^"]*)"[^>]*>([\s\S]*?)<\/a>/g, (m, target, label) => {
    let anchor = target;
    try {
      anchor = decodeURIComponent(target);
    } catch (e) { }
    if (!anchor) return label;
    return '<ac:link ac:anchor="' + escapeXml(anchor) + '">' +
      '<ac:link-body>' + label + '</ac:link-body></ac:link>';
  });
}

// A link to a person's profile in Confluence Cloud, as downloaded mentions
// are, becomes a mention again.
function userMentions(html) {
  return html.replace(/<a href="[^"]*\/wiki\/people\/([^"/?#]+)[^"]*"[^>]*>[\s\S]*?<\/a>/g, (m, id) => {
    let accountId = id;
    try {
      accountId = decodeURIComponent(id);
    } catch (e) { }
    return '<ac:link><ri:user ri:account-id="' + escapeXml(accountId) + '" /></ac:link>';
  });
}

// Confluence aligns the paragraph in a cell, like its own editor does.
function cellAlignment(html) {
  return html.replace(/<(t[hd])([^>]*?) style="text-align:(left|center|right)"([^>]*)>([\s\S]*?)<\/\1>/g,
    (m, tag, before, align, after, body) => '<' + tag + before + after + '>' +
      '<p style="text-align: ' + align + ';">' + body + '</p></' + tag + '>');
}

// An HTML comment is a note that the page does not show, as in any Markdown
// preview: it is published as instruction text (see comments.js). Code keeps
// it as written.
function htmlComments(md) {
  md.inline.ruler.before('html_inline', 'html_comment', (state, silent) => {
    if (!state.src.startsWith('<!--', state.pos)) return false;
    const end = state.src.indexOf('-->', state.pos + 4);
    if (end < 0) return false;
    if (!silent) state.push('md_comment', '', 0).content = state.src.slice(state.pos + 4, end).trim();
    state.pos = end + 3;
    return true;
  });
  md.block.ruler.before('html_block', 'html_comment', (state, startLine, endLine, silent) => {
    const start = state.bMarks[startLine] + state.tShift[startLine];
    if (state.sCount[startLine] - state.blkIndent >= 4) return false;
    if (!state.src.startsWith('<!--', start)) return false;
    const end = state.src.indexOf('-->', start + 4);
    if (end < 0) return false;
    let line = startLine;
    while (line < endLine && state.eMarks[line] < end + 3) line++;
    if (line >= endLine || state.src.slice(end + 3, state.eMarks[line]).trim()) return false;
    if (silent) return true;
    state.push('md_comment_block', '', 0).content = state.src.slice(start + 4, end).trim();
    state.line = line + 1;
    return true;
  }, { alt: ['paragraph', 'reference', 'blockquote', 'list'] });
  md.renderer.rules.md_comment = (tokens, idx) => commentXml(tokens[idx].content);
  md.renderer.rules.md_comment_block = (tokens, idx) => '<p>' + commentXml(tokens[idx].content) + '</p>\n';
}

function mdToStorage(md, options) {
  const opts = options || {};
  const mermaidMacro = String(opts.mermaidMacro || '').trim();
  const mdit = new MarkdownIt({ html: false, xhtmlOut: true, linkify: true }).use(tableSpans)
    .use(panels, { storage: true }).use(lineBreakTags).use(htmlComments);
  mdit.renderer.rules.fence = (tokens, idx) => {
    const info = (tokens[idx].info || '').trim().split(/\s+/)[0] || '';
    if (mermaidMacro && info.toLowerCase() === 'mermaid') {
      return mermaidMacroXml(mermaidMacro, adaptMermaid(tokens[idx].content, opts.mermaidVersion));
    }
    return codeMacro(info, tokens[idx].content);
  };
  mdit.renderer.rules.code_block = (tokens, idx) => codeMacro('', tokens[idx].content);
  return cellAlignment(cellPanels(userMentions(anchorLinks(confluenceLinks(taskLists(mdit.render(String(md)))))))).trim();
}

module.exports = { mdToStorage };
