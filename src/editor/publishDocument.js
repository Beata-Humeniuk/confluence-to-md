const vscode = require('vscode');
const { mdToStorage } = require('../core/mdToStorage');
const { parseFrontMatter } = require('../core/frontMatter');
const { linkLocalPages } = require('../core/localLinks');
const { assembleWithParts, withSampleFiles, readLinkedFiles, splitTitleAndBody } = require('./publishSource');
const { mermaidMacro, mermaidVersion } = require('./config');

async function confirmMissingParts(missing) {
  if (!missing.length) return true;
  const publish = 'Publish without them';
  const picked = await vscode.window.showWarningMessage(
    'Part files not found: ' + missing.map((m) => m.path).join(', ') +
    '. They will stay on the page as links to files that do not exist in Confluence.',
    { modal: true }, publish);
  return picked === publish;
}

async function prepareDocument(source) {
  const { meta, body } = parseFrontMatter(source.text);
  const assembled = await assembleWithParts(source.uri, body);
  if (!await confirmMissingParts(assembled.missing)) return null;
  const markdown = await withSampleFiles(source.uri, assembled.markdown);
  const { title, content } = splitTitleAndBody(
    markdown, source.fileName.replace(/\.md$/i, '') || 'Untitled');
  return {
    source,
    meta,
    title,
    content,
    linked: await readLinkedFiles(source.uri, content),
    inlined: assembled.inlined.length
  };
}

function storageOf(doc, published) {
  const urls = new Map();
  for (const [target, file] of doc.linked) {
    urls.set(target, file ? (file.meta && file.meta.url) || published.get(file.uri.toString()) || null : null);
  }
  return mdToStorage(linkLocalPages(doc.content, urls),
    { mermaidMacro: mermaidMacro(), mermaidVersion: mermaidVersion() });
}

module.exports = { prepareDocument, storageOf };
