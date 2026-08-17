const MarkdownIt = require('markdown-it');

function escapeXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function cdata(s) {
  return '<![CDATA[' + String(s).replace(/\]\]>/g, ']]]]><![CDATA[>') + ']]>';
}

function codeMacro(lang, code) {
  return '<ac:structured-macro ac:name="code" ac:schema-version="1">' +
    (lang ? '<ac:parameter ac:name="language">' + escapeXml(lang) + '</ac:parameter>' : '') +
    '<ac:plain-text-body>' + cdata(String(code).replace(/\n$/, '')) + '</ac:plain-text-body>' +
    '</ac:structured-macro>\n';
}

function taskLists(html) {
  return html.replace(/<ul>\s*((?:<li>(?:\s*<p>)?\[(?: |x)\][\s\S]*?<\/li>\s*)+)<\/ul>/g, (m, body) => {
    const tasks = [];
    body.replace(/<li>(?:\s*<p>)?\[( |x)\]\s?([\s\S]*?)(?:<\/p>\s*)?<\/li>/g, (mm, mark, text) => {
      tasks.push('<ac:task><ac:task-status>' + (mark === 'x' ? 'complete' : 'incomplete') +
        '</ac:task-status><ac:task-body>' + text.trim() + '</ac:task-body></ac:task>');
      return mm;
    });
    return '<ac:task-list>' + tasks.join('') + '</ac:task-list>';
  });
}

function confluenceLinks(html) {
  return html.replace(/<a href="confluence:([^"]*)"[^>]*>([\s\S]*?)<\/a>/g, (m, target, label) => {
    const parts = target.split('/');
    let title = parts[parts.length - 1], spaceKey = parts.length > 1 ? parts[0] : '';
    try {
      title = decodeURIComponent(title);
      spaceKey = decodeURIComponent(spaceKey);
    } catch (e) { }
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

function mdToStorage(md) {
  const mdit = new MarkdownIt({ html: false, xhtmlOut: true, linkify: true });
  mdit.renderer.rules.fence = (tokens, idx) => {
    const info = (tokens[idx].info || '').trim().split(/\s+/)[0] || '';
    return codeMacro(info, tokens[idx].content);
  };
  mdit.renderer.rules.code_block = (tokens, idx) => codeMacro('', tokens[idx].content);
  return anchorLinks(confluenceLinks(taskLists(mdit.render(String(md))))).trim();
}

module.exports = { mdToStorage };
