const { convertHtmlToMd } = require('./htmlToMd');
const { serializeFrontMatter } = require('./frontMatter');
const { detectDocType } = require('./mdDocument');
const { pageWebUrl } = require('./confluenceClient');
const { imagesMode } = require('./config');

const EXTENSION_VERSION = require('../package.json').version;

function isoToday() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

function describeLines(page, markdown) {
  const lines = [
    'type: ' + detectDocType(markdown, page.title),
    'generator: confluence-to-md@' + EXTENSION_VERSION,
    'generated: ' + isoToday(),
    'sourceId: ' + page.id
  ];
  if (page.spaceKey) lines.push('space: ' + page.spaceKey);
  lines.push('managed: true');
  return lines;
}

function pageDocument(page, markdown) {
  const fm = serializeFrontMatter(
    { url: pageWebUrl(page.site, page.spaceKey, page.id), version: page.version },
    describeLines(page, markdown));
  return fm + '\n# ' + page.title + '\n\n' + markdown;
}

function pageToMd(page) {
  const converted = convertHtmlToMd(page.html, { origin: page.site.origin, images: imagesMode() });
  return { md: pageDocument(page, converted.markdown), links: converted.links };
}

module.exports = { pageDocument, pageToMd };
