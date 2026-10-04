const { pageRefOfHref } = require('./pageLink');

const FENCE_LINE = /^[ \t]*(?:```|~~~)/;
const H1_LINE = /^#[ \t]+(.+?)[ \t]*$/;

function slugify(title) {
  const s = String(title)
    .replace(/ł/g, 'l').replace(/Ł/g, 'L')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return s || 'page';
}

// The first level-one heading outside fenced code, with the offsets of its
// line (newline included) so that it can be cut out of the text.
function titleHeading(markdown) {
  const text = String(markdown);
  let fenced = false;
  let start = 0;
  while (start < text.length) {
    const newline = text.indexOf('\n', start);
    const end = newline < 0 ? text.length : newline + 1;
    const line = text.slice(start, end).replace(/\r?\n$/, '');
    if (FENCE_LINE.test(line)) {
      fenced = !fenced;
    } else if (!fenced) {
      const m = line.match(H1_LINE);
      if (m) return { title: m[1], start, end };
    }
    start = end;
  }
  return null;
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

module.exports = { slugify, titleHeading, rewriteConfluenceLinks };
