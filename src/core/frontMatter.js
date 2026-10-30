const BLOCK = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const BINDING_KEY = /^confluence:\s*$/;

function unquote(value) {
  return String(value).replace(/^(["'])(.*)\1$/, '$2');
}

// Only the lines indented under confluence: belong to the binding, so a jira: block with its own
// url: can sit next to it.
function parseFrontMatter(text) {
  const m = String(text).match(BLOCK);
  if (!m) return { meta: null, body: String(text), rawLength: 0, extraLines: [] };
  const lines = m[1].split(/\r?\n/);
  const start = lines.findIndex((line) => BINDING_KEY.test(line));
  let end = start + 1;
  while (start >= 0 && end < lines.length && (/^\s/.test(lines[end]) || lines[end].trim() === '')) end++;
  const block = start >= 0 ? lines.slice(start + 1, end).join('\n') : '';
  const url = unquote((block.match(/^\s+url:\s*(\S+)\s*$/m) || [])[1] || '');
  const version = (block.match(/^\s+version:\s*(\d+)\s*$/m) || [])[1] || '';
  const bound = !!url;
  const extraLines = lines.filter((line, i) =>
    line.trim() !== '' && (!bound || i < start || i >= end));
  return {
    meta: bound ? { url, version: version ? parseInt(version, 10) : 0 } : null,
    body: String(text).slice(m[0].length),
    rawLength: m[0].length,
    extraLines
  };
}

function serializeFrontMatter(meta, extraLines) {
  return ['---', 'confluence:', '  url: ' + meta.url, '  version: ' + meta.version]
    .concat(extraLines || [], ['---', '']).join('\n');
}

module.exports = { parseFrontMatter, serializeFrontMatter };
