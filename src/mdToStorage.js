const MarkdownIt = require('markdown-it');
const { mermaidMacroXml } = require('./mermaid');
const { adaptMermaid } = require('./mermaidSyntax');
const { confluenceTargetOf } = require('./pageLink');
const { escapeXml, cdata } = require('./markup');

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

function mdToStorage(md, options) {
  const opts = options || {};
  const mermaidMacro = String(opts.mermaidMacro || '').trim();
  const mdit = new MarkdownIt({ html: false, xhtmlOut: true, linkify: true });
  mdit.renderer.rules.fence = (tokens, idx) => {
    const info = (tokens[idx].info || '').trim().split(/\s+/)[0] || '';
    if (mermaidMacro && info.toLowerCase() === 'mermaid') {
      return mermaidMacroXml(mermaidMacro, adaptMermaid(tokens[idx].content, opts.mermaidVersion));
    }
    return codeMacro(info, tokens[idx].content);
  };
  mdit.renderer.rules.code_block = (tokens, idx) => codeMacro('', tokens[idx].content);
  return anchorLinks(confluenceLinks(taskLists(mdit.render(String(md))))).trim();
}

module.exports = { mdToStorage };
