const vscode = require('vscode');
const { convertHtmlToMd } = require('../core/htmlToMd');
const { rewriteConfluenceLinks } = require('../core/mdDocument');
const { extractLongCodeBlocks } = require('../core/codeSamples');
const { downloadFolderUri, imagesMode, appendixHeading } = require('./config');
const { readSavedPages } = require('./savedPages');
const { pulledDocument } = require('./pageDocument');

function isInside(dir, root) {
  return !!root && dir.scheme === root.scheme && dir.authority === root.authority &&
    (dir.path === root.path || dir.path.startsWith(root.path.replace(/\/+$/, '') + '/'));
}

function pagesRoot(dir) {
  const configured = downloadFolderUri();
  return isInside(dir, configured) ? configured : dir;
}

function relativeDir(dir, root) {
  return dir.path.slice(root.path.replace(/\/+$/, '').length).replace(/^\/+/, '');
}

async function rewriteForFolder(uri, markdown, origin) {
  const dir = vscode.Uri.joinPath(uri, '..');
  const root = pagesRoot(dir);
  const pathById = new Map();
  const pathByTitle = new Map();
  for (const s of await readSavedPages(root)) {
    if (s.pageId) pathById.set(s.pageId, s.relPath);
    if (s.title) pathByTitle.set(s.title, s.relPath);
  }
  return rewriteConfluenceLinks(markdown, pathByTitle,
    { slugById: pathById, origin, fromDir: relativeDir(dir, root) });
}

function samplesFolder(uri) {
  return uri.path.split('/').pop().replace(/\.md$/i, '') + '.samples';
}

async function remoteDocument(uri, page, localText) {
  const converted = convertHtmlToMd(page.html, { origin: page.site.origin, images: imagesMode() });
  const linked = await rewriteForFolder(uri, converted.markdown, page.site.origin);
  const extracted = extractLongCodeBlocks(linked, samplesFolder(uri),
    { appendixHeading: appendixHeading() });
  return { text: pulledDocument(page, extracted.markdown, localText), samples: extracted.samples };
}

module.exports = { remoteDocument, samplesFolder };
