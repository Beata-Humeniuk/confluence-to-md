const TurndownService = require('turndown');
const { gfm } = require('@joplin/turndown-plugin-gfm');
const { pageRefOfHref } = require('./pageLink');
const { storageToHtml, cleanupConfluenceHtml } = require('./storageHtml');
const { rewriteTocAnchors } = require('./tocAnchors');

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

  td.addRule('confluenceCodeBlock', {
    filter: 'pre',
    replacement: (content, node) => {
      const params = node.getAttribute('data-syntaxhighlighter-params') || '';
      const brush = (params.match(/brush:\s*([\w#+-]+)/) || [])[1] || '';
      const lang = node.getAttribute('data-code-language') || brush || '';
      return '\n\n```' + lang + '\n' + node.textContent.replace(/\n$/, '') + '\n```\n\n';
    }
  });

  td.addRule('confluencePanel', {
    filter: (node) => node.nodeName === 'DIV' && node.classList &&
      node.classList.contains('confluence-information-macro'),
    replacement: (content) => {
      const quoted = content.trim().split('\n').map((ln) => ('> ' + ln).trimEnd()).join('\n');
      return '\n\n' + quoted + '\n\n';
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
