const TurndownService = require('turndown');
const { gfm } = require('@joplin/turndown-plugin-gfm');
const { pageRefOfHref } = require('./pageLink');
const { storageToHtml, cleanupConfluenceHtml } = require('./storageHtml');
const { rewriteTocAnchors } = require('./tocAnchors');
const { panelMarkdown } = require('./panels');

function pageLinkOf(href, node, origin) {
  const ref = pageRefOfHref(href, origin);
  if (!ref) return null;
  const title = ref.title || String(node.textContent || '').trim();
  return title ? { spaceKey: ref.spaceKey, pageId: ref.pageId, title } : null;
}

function imageMarkdown(node, mode, origin) {
  const src = node.getAttribute('src') || '';
  if (mode !== 'link' || !src) return '';
  let name = node.getAttribute('alt') || '';
  if (!name) {
    try { name = decodeURIComponent(src.split('?')[0].split('/').pop()); } catch (e) { name = ''; }
  }
  const href = origin && src[0] === '/' ? origin + src : src;
  return '![' + name + '](' + href + ')';
}

// The lines of a code block in a cell, whose line breaks are <br> elements.
function preLines(node) {
  const lines = [''];
  const walk = (parent) => Array.from(parent.childNodes).forEach((child) => {
    if (child.nodeName === 'BR') lines.push('');
    else if (child.nodeType === 3) lines[lines.length - 1] += child.nodeValue;
    else walk(child);
  });
  walk(node);
  return lines;
}

function inlineCode(text) {
  const longest = Math.max(0, ...(text.match(/`+/g) || []).map((run) => run.length));
  const fence = '`'.repeat(longest + 1);
  const pad = /^`|`$/.test(text) ? ' ' : '';
  return fence + pad + text + pad + fence;
}

function convertHtmlToMd(html, options) {
  const origin = (options && options.origin) || '';
  const images = (options && options.images) || 'skip';
  const links = [];
  const td = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '*',
    hr: '---'
  });
  td.use(gfm);

  // Text such as "<nazwa promocji>" would be read as an HTML tag and hidden by
  // the preview and the visual editor.
  const escape = td.escape.bind(td);
  td.escape = (text) => escape(text).replace(/<(?=[A-Za-z/!?])/g, '\\<');

  td.addRule('confluenceCodeBlock', {
    filter: 'pre',
    replacement: (content, node) => {
      const params = node.getAttribute('data-syntaxhighlighter-params') || '';
      const brush = (params.match(/brush:\s*([\w#+-]+)/) || [])[1] || '';
      const lang = node.getAttribute('data-code-language') || brush || '';
      return '\n\n```' + lang + '\n' + node.textContent.replace(/\n$/, '') + '\n```\n\n';
    }
  });

  const isPanel = (node) => node && node.nodeName === 'DIV' && node.classList &&
    node.classList.contains('confluence-information-macro');

  td.addRule('confluencePanelTitle', {
    filter: (node) => node.nodeName === 'P' && node.classList && node.classList.contains('title') &&
      isPanel(node.parentNode),
    replacement: () => ''
  });

  td.addRule('confluencePanel', {
    filter: isPanel,
    replacement: (content, node) => {
      const kind = (/confluence-information-macro-(\w+)/.exec(node.className) || [])[1] || '';
      const title = Array.from(node.childNodes).find((child) =>
        child.nodeName === 'P' && child.classList && child.classList.contains('title'));
      return '\n\n' + panelMarkdown(kind, title ? title.textContent.trim() : '', content) + '\n\n';
    }
  });

  td.addRule('confluenceTaskItem', {
    filter: (node) => node.nodeName === 'LI' && node.parentNode &&
      /inline-task-list/.test(node.parentNode.className || ''),
    replacement: (content, node) => {
      const done = /\bchecked\b/.test(node.className || '');
      return '- [' + (done ? 'x' : ' ') + '] ' + content.trim() + '\n';
    }
  });

  // A Markdown cell holds one line, so blocks in cells (renamed in
  // cleanupConfluenceHtml) become lines, which the table joins with <br>.
  td.addRule('cellList', {
    filter: ['cell-ul', 'cell-ol'],
    replacement: (content) => '\n\n' + content.trim().split('\n').map((line) => line.trim()).join('\n') + '\n\n'
  });

  td.addRule('cellListItem', {
    filter: 'cell-li',
    replacement: (content, node) => {
      const list = node.parentNode;
      let marker = '- ';
      if (list && /inline-task-list/.test(list.className || '')) {
        marker = '- [' + (/\bchecked\b/.test(node.className || '') ? 'x' : ' ') + '] ';
      } else if (list && list.nodeName === 'CELL-OL') {
        const items = Array.from(list.childNodes).filter((child) => child.nodeName === 'CELL-LI');
        marker = (items.indexOf(node) + 1) + '. ';
      }
      return marker + content.trim().replace(/\n{2,}/g, '\n') + '\n';
    }
  });

  td.addRule('cellCodeBlock', {
    filter: 'cell-pre',
    replacement: (content, node) => {
      const lines = preLines(node).filter((line) => line.trim());
      if (lines.length === 1 && node.querySelector('code')) return '\n\n' + content.trim() + '\n\n';
      return '\n\n' + lines.map((line) => inlineCode(line.replace(/\s+$/, ''))).join('\n') + '\n\n';
    }
  });

  td.addRule('confluenceImage', {
    filter: 'img',
    replacement: (content, node) => imageMarkdown(node, images, origin)
  });

  td.addRule('confluenceLink', {
    filter: (node) => node.nodeName === 'A' && !!node.getAttribute('href'),
    replacement: (content, node) => {
      const href = node.getAttribute('href');
      const page = pageLinkOf(href, node, origin);
      if (page && page.title) links.push(page);
      const text = content.trim() || (page && page.title) || href;
      return '[' + text + '](' + href + ')';
    }
  });

  const markdown = rewriteTocAnchors(
    td.turndown(cleanupConfluenceHtml(storageToHtml(html))).trim() + '\n');

  const seen = new Set();
  const uniq = links.filter((l) => {
    const k = l.pageId || (l.spaceKey + '|' + l.title);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return { markdown, links: uniq };
}

module.exports = { convertHtmlToMd };
