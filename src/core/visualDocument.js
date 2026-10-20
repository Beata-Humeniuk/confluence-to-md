const { parseFrontMatter } = require('./frontMatter');

// The visual editor edits only the body. The front matter, with its
// confluence: binding, stays in the file exactly as it is.
function splitDocument(text) {
  const source = String(text);
  const { meta, rawLength } = parseFrontMatter(source);
  return {
    head: source.slice(0, rawLength),
    body: source.slice(rawLength).replace(/\r\n/g, '\n'),
    bound: !!meta
  };
}

function normalizeBody(body) {
  const text = String(body).replace(/\r\n/g, '\n').replace(/^\n+/, '');
  return text.trim() ? text.replace(/\n*$/, '\n') : '';
}

function sameBody(a, b) {
  return normalizeBody(a) === normalizeBody(b);
}

// Keeps the blank lines between the front matter and the text as they were.
function mergeBody(current, edited) {
  return /^(?:\r?\n)*/.exec(String(current))[0] + normalizeBody(edited);
}

function linkTarget(href) {
  const raw = String(href || '').trim();
  if (!raw || raw[0] === '#') return { kind: 'none' };
  if (/^confluence:/i.test(raw)) return { kind: 'confluence', target: raw };
  if (/^(https?|mailto):/i.test(raw)) return { kind: 'external', target: raw };
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return { kind: 'none' };
  if (raw[0] === '/') return { kind: 'site', target: raw };
  let path = raw.replace(/[?#].*$/, '');
  try {
    path = decodeURIComponent(path);
  } catch (e) { }
  return path ? { kind: 'file', target: path } : { kind: 'none' };
}

module.exports = { splitDocument, normalizeBody, sameBody, mergeBody, linkTarget };
