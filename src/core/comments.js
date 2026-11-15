const { escapeXml, decodeEntities } = require('./markup');

// An HTML comment in the file is published as Confluence instruction text
// (ac:placeholder): Confluence keeps it in the page but does not show it, and
// pulling the page brings it back as the same comment.
const PLACEHOLDER = /<ac:placeholder\b[^>]*>([\s\S]*?)<\/ac:placeholder>|<ac:placeholder\b[^>]*\/>/g;
const MARKER = /CTMDCOMMENT(\d+)X/g;

function commentXml(text) {
  return '<ac:placeholder>' + escapeXml(text) + '</ac:placeholder>';
}

function hasComments(storage) {
  return /<ac:placeholder\b/.test(String(storage || ''));
}

function commentPlaceholders(storage, comments) {
  return String(storage || '').replace(PLACEHOLDER, (m, body) => {
    comments.push(decodeEntities(String(body || '').replace(/<[^>]*>/g, '')));
    return 'CTMDCOMMENT' + (comments.length - 1) + 'X';
  });
}

// A span that htmlToMd writes as <!-- text -->. The text is in an attribute,
// which keeps its line breaks; the span has content so it is not dropped as blank.
function restoreComments(html, comments) {
  return String(html).replace(MARKER, (m, i) => {
    const text = comments[Number(i)];
    return text === undefined ? m : '<span data-md-comment="' + escapeXml(text).replace(/\n/g, '&#10;') + '">.</span>';
  });
}

module.exports = { commentXml, hasComments, commentPlaceholders, restoreComments };
