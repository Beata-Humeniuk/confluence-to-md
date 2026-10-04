function escapeXml(s) {
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

function plainTextOf(body) {
  const text = String(body);
  if (text.indexOf('<![CDATA[') === -1) return decodeEntities(text);
  let out = '';
  text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (m, t) => { out += t; return m; });
  return out;
}

function cdata(s) {
  return '<![CDATA[' + String(s).replace(/\]\]>/g, ']]]]><![CDATA[>') + ']]>';
}

module.exports = { escapeXml, decodeEntities, plainTextOf, cdata };
