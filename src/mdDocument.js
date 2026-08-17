const { pageRefOfHref } = require('./pageLink');

function slugify(title) {
  const s = String(title)
    .replace(/ł/g, 'l').replace(/Ł/g, 'L')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return s || 'page';
}

function detectDocType(markdown, title) {
  const md = String(markdown);
  const t = String(title || '');
  if (/^- \*\*.+\*\* \(`[^`]+`\)/m.test(md) &&
    (/^# UI: /m.test(md) || /^UI: /.test(t) || /^## (\d+\. )?View structure$/m.test(md))) {
    return 'view-design';
  }
  if (/^## Field mappings$/m.test(md) || /^# Mapping: /m.test(md) || /^Mapping: /.test(t)) {
    return 'field-mapping';
  }
  if (/^## Data model$/m.test(md) &&
    (/^## (Endpoints|Operations|Main elements)$/m.test(md) || /\| Format \|/.test(md))) {
    return 'contract';
  }
  return 'confluence-page';
}

function relativeMdLink(fromDir, toPath) {
  const from = fromDir ? String(fromDir).split('/') : [];
  const to = String(toPath).split('/');
  while (from.length && to.length > 1 && from[0] === to[0]) {
    from.shift();
    to.shift();
  }
  const prefix = from.length ? from.map(() => '..').join('/') + '/' : './';
  return prefix + to.join('/') + '.md';
}

function rewriteConfluenceLinks(markdown, slugByTitle, options) {
  const slugById = (options && options.slugById) || new Map();
  const origin = (options && options.origin) || '';
  const fromDir = (options && options.fromDir) || '';
  return String(markdown).replace(/\]\(([^()\s]+)\)/g, (full, href) => {
    const ref = pageRefOfHref(href, origin);
    if (!ref) return full;
    const slug = (ref.pageId && slugById.get(ref.pageId)) ||
      (ref.title && slugByTitle.get(ref.title)) || '';
    return slug ? '](' + relativeMdLink(fromDir, slug) + ')' : full;
  });
}

module.exports = { slugify, rewriteConfluenceLinks, detectDocType };
