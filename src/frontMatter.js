function parseFrontMatter(text) {
  const m = String(text).match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { meta: null, body: String(text), rawLength: 0, extraLines: [] };
  const url = (m[1].match(/^\s+url:\s*(\S+)\s*$/m) || [])[1] || '';
  const version = (m[1].match(/^\s+version:\s*(\d+)\s*$/m) || [])[1] || '';
  const bound = /^confluence:\s*$/m.test(m[1]) && !!url;
  const extraLines = m[1].split(/\r?\n/).filter((line) =>
    line.trim() !== '' && (!bound || (!/^confluence:\s*$/.test(line) && !/^\s+(url|version):/.test(line))));
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
