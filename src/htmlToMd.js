const TurndownService = require('turndown');
const { gfm } = require('@joplin/turndown-plugin-gfm');
const { pageRefOfHref } = require('./pageLink');

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function decodeEntities(s) {
  return String(s)
    .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (m, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function cdataToHtml(s) {
  const str = String(s);
  if (str.indexOf('<![CDATA[') === -1) return str;
  let out = '';
  str.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (m, t) => { out += t; return m; });
  return escapeHtml(out);
}

function attr(tag, name) {
  const m = tag.match(new RegExp(name.replace(/:/g, '\\:') + '\\s*=\\s*"([^"]*)"'));
  return m ? decodeEntities(m[1]) : '';
}

function storageToHtml(input) {
  let s = String(input);

  s = s.replace(/<ac:structured-macro[^>]*ac:name="code"[^>]*>([\s\S]*?)<\/ac:structured-macro>/g, (m, body) => {
    const lang = (body.match(/<ac:parameter[^>]*ac:name="language"[^>]*>([\s\S]*?)<\/ac:parameter>/) || [])[1] || '';
    const code = body.match(/<ac:plain-text-body>([\s\S]*?)<\/ac:plain-text-body>/);
    return '<pre data-code-language="' + escapeHtml(lang.trim()) + '">' +
      (code ? cdataToHtml(code[1]) : '') + '</pre>';
  });
  s = s.replace(/<ac:structured-macro[^>]*ac:name="(toc|anchor|children|pagetree)"[^>]*(?:\/>|>[\s\S]*?<\/ac:structured-macro>)/g, '');
  s = s.replace(/<ac:structured-macro[^>]*ac:name="(info|note|warning|tip|panel)"[^>]*>([\s\S]*?)<\/ac:structured-macro>/g,
    (m, kind, body) => {
      const rich = body.match(/<ac:rich-text-body>([\s\S]*?)<\/ac:rich-text-body>/);
      return '<div class="confluence-information-macro confluence-information-macro-' + kind + '">' +
        (rich ? rich[1] : body) + '</div>';
    });
  s = s.replace(/<ac:structured-macro[^>]*ac:name="status"[^>]*>([\s\S]*?)<\/ac:structured-macro>/g, (m, body) => {
    const t = body.match(/<ac:parameter[^>]*ac:name="title"[^>]*>([\s\S]*?)<\/ac:parameter>/);
    return t ? '<code>' + t[1] + '</code>' : '';
  });
  s = s.replace(/<ac:structured-macro[^>]*>([\s\S]*?)<\/ac:structured-macro>/g, (m, body) => {
    const rich = body.match(/<ac:rich-text-body>([\s\S]*?)<\/ac:rich-text-body>/);
    return rich ? rich[1] : '';
  });

  s = s.replace(/<ac:task-list>([\s\S]*?)<\/ac:task-list>/g, (m, body) => {
    const items = [];
    body.replace(/<ac:task>([\s\S]*?)<\/ac:task>/g, (mm, task) => {
      const done = /<ac:task-status>complete<\/ac:task-status>/.test(task);
      const tb = task.match(/<ac:task-body>([\s\S]*?)<\/ac:task-body>/);
      items.push('<li class="' + (done ? 'checked' : '') + '">' + (tb ? tb[1] : '') + '</li>');
      return mm;
    });
    return '<ul class="inline-task-list">' + items.join('') + '</ul>';
  });

  s = s.replace(/<ac:link[^>]*>([\s\S]*?)<\/ac:link>/g, (m, body) => {
    const page = body.match(/<ri:page[^>]*\/?>/);
    const label = body.match(/<ac:(?:plain-text-)?link-body>([\s\S]*?)<\/ac:(?:plain-text-)?link-body>/);
    const labelHtml = label ? cdataToHtml(label[1]) : '';
    if (page) {
      const title = attr(page[0], 'ri:content-title');
      const spaceKey = attr(page[0], 'ri:space-key');
      const target = (spaceKey ? encodeURIComponent(spaceKey) + '/' : '') + encodeURIComponent(title);
      return '<a href="confluence:' + target + '">' + (labelHtml || escapeHtml(title)) + '</a>';
    }
    const user = body.match(/<ri:user[^>]*\/?>/);
    if (user) {
      const name = attr(user[0], 'ri:username');
      return name ? '@' + escapeHtml(name) : labelHtml;
    }
    return labelHtml;
  });

  s = s.replace(/<ac:image[^>]*>([\s\S]*?)<\/ac:image>/g, (m, body) => {
    const att = body.match(/<ri:attachment[^>]*\/?>/);
    const url = body.match(/<ri:url[^>]*\/?>/);
    const name = att ? attr(att[0], 'ri:filename') : (url ? attr(url[0], 'ri:value') : '');
    return '<img alt="' + escapeHtml(name) + '">';
  });

  s = s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (m, t) => escapeHtml(t));
  s = s.replace(/<\/?(?:ac|ri):[a-zA-Z-]+[^<>]*>/g, '');
  return s;
}

function stripTags(s) {
  return String(s).replace(/<[^>]*>/g, '');
}

function flattenIssueTable(body) {
  const rows = [];
  String(body).replace(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi, (m, row) => {
    if (/<th\b/i.test(row)) return m;
    const cells = [];
    row.replace(/<td\b[^>]*>([\s\S]*?)<\/td>/gi, (mm, cell) => {
      if (stripTags(cell).trim()) cells.push(cell.trim());
      return mm;
    });
    if (cells.length) rows.push(cells.join(' — '));
    return m;
  });
  return rows.length ? '<span>' + rows.join('; ') + '</span>' : '';
}

function cleanupConfluenceHtml(input) {
  let s = String(input);

  s = s.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  s = s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');

  s = s.replace(/<table\b[^>]*class="[^"]*\bjira-issues\b[^"]*"[^>]*>([\s\S]*?)<\/table>/gi,
    (m, body) => flattenIssueTable(body));

  s = s.replace(/<colgroup\b[^>]*>[\s\S]*?<\/colgroup>/gi, '');
  s = s.replace(/<colgroup\b[^>]*\/>/gi, '');

  s = s.replace(/<span\b([^>]*\bclass="[^"]*\bjira-status\b[^"]*"[^>]*)>/gi, ' <span$1>');

  s = s.replace(/(<t[hd]\b[^>]*>)([\s\S]*?)(<\/t[hd]>)/gi,
    (m, open, body, close) => open + body.replace(/<\/?h[1-6]\b[^>]*>/gi, '') + close);

  return s;
}

const HEADING_LINE = /^#{1,6}[ \t]+(.*)$/;
const FENCE_LINE = /^[ \t]*(?:```|~~~)/;

function headingPlainText(text) {
  return String(text)
    .replace(/\[([^\]]*)\]\([^()\s]*\)/g, '$1')
    .replace(/[*_`~\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function mdAnchorOf(text) {
  return headingPlainText(text).toLowerCase().replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}\-_]/gu, '');
}

function anchorKeyOf(s) {
  return String(s).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

function collectHeadings(lines) {
  const headings = [];
  const slugSeen = new Map();
  const keySeen = new Map();
  let fenced = false;
  for (const line of lines) {
    if (FENCE_LINE.test(line)) { fenced = !fenced; continue; }
    if (fenced) continue;
    const m = line.match(HEADING_LINE);
    if (!m) continue;
    const key0 = anchorKeyOf(headingPlainText(m[1]));
    if (!key0) continue;
    let slug = mdAnchorOf(m[1]);
    const sN = slugSeen.get(slug) || 0;
    slugSeen.set(slug, sN + 1);
    if (sN) slug += '-' + sN;
    let key = key0;
    const kN = keySeen.get(key) || 0;
    keySeen.set(key, kN + 1);
    if (kN) key += kN;
    headings.push({ key, slug });
  }
  return headings;
}

function anchorTargetOf(fragment, headings) {
  let frag = String(fragment);
  try { frag = decodeURIComponent(frag); } catch (e) { }
  const key = anchorKeyOf(frag);
  if (!key) return null;
  let best = null;
  for (const h of headings) {
    if (h.key === key) return h;
    if (key.length > h.key.length && key.endsWith(h.key) &&
      (!best || h.key.length > best.key.length)) best = h;
  }
  return best;
}

function rewriteTocAnchors(markdown) {
  const lines = String(markdown).split('\n');
  const headings = collectHeadings(lines);
  if (!headings.length) return markdown;
  let fenced = false;
  return lines.map((line) => {
    if (FENCE_LINE.test(line)) { fenced = !fenced; return line; }
    if (fenced) return line;
    return line.replace(/\]\(#([^()\s]+)\)/g, (full, frag) => {
      const target = anchorTargetOf(frag, headings);
      return target ? '](#' + target.slug + ')' : full;
    });
  }).join('\n');
}

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
