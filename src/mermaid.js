// Mermaid diagrams are stored in Confluence as a macro from a Marketplace app
// (for example `mermaid-macro`), whose rendered export_view output no longer
// contains the diagram source. The source is taken from the storage format.

const MERMAID_MACRO = /<ac:structured-macro\b[^>]*\bac:name="([^"]*mermaid[^"]*)"[^>]*>([\s\S]*?)<\/ac:structured-macro>/gi;
const PLACEHOLDER = /(?:<p\b[^>]*>\s*)?CTMDMERMAID(\d+)X(?:\s*<\/p>)?/g;

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function decodeEntities(s) {
  return String(s)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function macroSource(body) {
  const plain = body.match(/<ac:plain-text-body>([\s\S]*?)<\/ac:plain-text-body>/);
  if (!plain) return null;
  const text = plain[1];
  if (text.indexOf('<![CDATA[') === -1) return decodeEntities(text);
  let out = '';
  text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (m, t) => { out += t; return m; });
  return out;
}

function hasMermaid(storage) {
  MERMAID_MACRO.lastIndex = 0;
  return MERMAID_MACRO.test(String(storage || ''));
}

// Replaces each Mermaid macro with a placeholder paragraph and returns the
// diagram sources in the same order.
function mermaidPlaceholders(storage) {
  const sources = [];
  const value = String(storage || '').replace(MERMAID_MACRO, (m, name, body) => {
    const source = macroSource(body);
    if (source === null) return m;
    sources.push(source.replace(/^\n+|\s+$/g, ''));
    return '<p>CTMDMERMAID' + (sources.length - 1) + 'X</p>';
  });
  return { storage: value, sources };
}

// Puts the diagram sources back as code blocks that convert to ```mermaid.
function restoreMermaid(html, sources) {
  return String(html).replace(PLACEHOLDER, (m, i) => {
    const source = sources[Number(i)];
    return source === undefined ? m
      : '<pre data-code-language="mermaid">' + escapeHtml(source) + '</pre>';
  });
}

function mermaidMacroXml(name, source, cdata) {
  return '<ac:structured-macro ac:name="' + escapeHtml(name) + '" ac:schema-version="1">' +
    '<ac:plain-text-body>' + cdata(String(source).replace(/\n$/, '')) + '</ac:plain-text-body>' +
    '</ac:structured-macro>\n';
}

module.exports = { hasMermaid, mermaidPlaceholders, restoreMermaid, mermaidMacroXml };
