const TurndownService = require('turndown');
const { gfm } = require('@joplin/turndown-plugin-gfm');
const { pageRefOfHref } = require('./pageLink');
const { storageToHtml, cleanupConfluenceHtml } = require('./storageHtml');
const { rewriteTocAnchors } = require('./tocAnchors');
const { panelMarkdown } = require('./panels');
const { expandMarkdown } = require('./expand');
const { TOC_MARKDOWN } = require('./tocMacro');

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

// A line break in a table cell, until the cell joins its lines with <br>.
const CELL_BREAK = '\uE000';
const CELL_BREAKS = new RegExp('[ \\t]*' + CELL_BREAK + '\\n?[ \\t]*', 'g');

function isInCell(node) {
  for (let parent = node.parentNode; parent; parent = parent.parentNode) {
    if (parent.nodeName === 'CELL-PRE') return false;
    if (parent.nodeName === 'TD' || parent.nodeName === 'TH') return true;
  }
  return false;
}

function cellLines(content) {
  return content.replace(/\s*\n\s*/g, '\n').replace(CELL_BREAKS, '\n');
}

function hasClass(node, name) {
  return !!node && node.nodeType === 1 && (' ' + (node.getAttribute('class') || '') + ' ')
    .replace(/\s+/g, ' ').indexOf(' ' + name + ' ') >= 0;
}

function macroName(node) {
  return node && node.nodeType === 1 ? node.getAttribute('data-macro-name') || '' : '';
}

function isToc(node) {
  return !!node && node.nodeType === 1 && (hasClass(node, 'toc-macro') || macroName(node) === 'toc');
}

function isExpand(node) {
  return !!node && node.nodeType === 1 && (node.nodeName === 'DETAILS' ||
    hasClass(node, 'expand-container') || macroName(node) === 'expand');
}

function isExpandTitle(node) {
  return isExpand(node.parentNode) && (node.nodeName === 'SUMMARY' || hasClass(node, 'expand-control'));
}

function expandTitle(node) {
  const control = Array.from(node.childNodes).find(isExpandTitle);
  if (!control) return '';
  const text = control.nodeName === 'SUMMARY' ? control
    : control.querySelector('.expand-control-text') || control;
  return String(text.textContent || '').replace(/\s+/g, ' ').trim();
}

function tocMarkdown(node) {
  return isInCell(node) ? TOC_MARKDOWN : '\n\n' + TOC_MARKDOWN + '\n\n';
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
    hr: '---',
    // Confluence on Cloud fills its table of contents in the browser, so the
    // page's HTML has an empty element where it goes.
    blankReplacement: (content, node) => {
      if (isToc(node)) return tocMarkdown(node);
      return node.isBlock ? '\n\n' : '';
    }
  });
  td.use(gfm);

  // Text such as "<nazwa promocji>" would be read as an HTML tag and hidden by
  // the preview and the visual editor.
  const escape = td.escape.bind(td);
  td.escape = (text) => escape(text).replace(/<(?=[A-Za-z/!?])/g, '\\<');

  td.addRule('confluenceToc', {
    filter: isToc,
    replacement: (content, node) => tocMarkdown(node)
  });

  td.addRule('confluenceExpandTitle', {
    filter: isExpandTitle,
    replacement: () => ''
  });

  // A cell holds no <details>, so there the title is a bold line above the text.
  td.addRule('confluenceExpand', {
    filter: isExpand,
    replacement: (content, node) => {
      const title = expandTitle(node);
      if (isInCell(node)) return '\n\n' + (title ? '**' + td.escape(title) + '**\n\n' : '') + content.trim() + '\n\n';
      return '\n\n' + expandMarkdown(title, content) + '\n\n';
    }
  });

  td.addRule('mdComment', {
    filter: (node) => node.nodeName === 'SPAN' && node.hasAttribute('data-md-comment'),
    replacement: (content, node) => '<!-- ' + node.getAttribute('data-md-comment') + ' -->'
  });

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

  // Confluence starts a new paragraph on Enter in a cell. Each paragraph,
  // list or code block in a cell is one line, so only a <br> on a line of its
  // own, as in an empty paragraph, leaves an empty line. A <br> at the end of
  // a paragraph shows nothing.
  td.addRule('cellLineBreak', {
    filter: (node) => node.nodeName === 'BR' && isInCell(node),
    replacement: () => CELL_BREAK
  });

  const cell = td.rules.array.find((rule) => String(rule.filter) === 'th,td').replacement;
  td.addRule('cellLines', {
    filter: ['th', 'td'],
    replacement: (content, node, options) => cell(cellLines(content), node, options)
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

  // A table kept as HTML has no cell rule that takes its breaks.
  const markdown = rewriteTocAnchors(td.turndown(cleanupConfluenceHtml(storageToHtml(html)))
    .split(CELL_BREAK).join('  \n').trim() + '\n');

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
