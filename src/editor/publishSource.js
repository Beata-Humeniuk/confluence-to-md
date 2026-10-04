const vscode = require('vscode');
const { parseFrontMatter, serializeFrontMatter } = require('../core/frontMatter');
const { partPaths, assembleParts } = require('../core/assembleParts');
const { sampleLinkPaths, inlineSamples } = require('../core/codeSamples');
const { titleHeading } = require('../core/mdDocument');

function baseName(path) {
  return String(path || '').split(/[\\/]/).pop() || '';
}

function splitTitleAndBody(mdBody, fallbackTitle) {
  const h1 = titleHeading(mdBody);
  if (!h1) return { title: fallbackTitle, content: mdBody };
  return { title: h1.title, content: mdBody.slice(0, h1.start) + mdBody.slice(h1.end) };
}

async function readPart(uri) {
  const open = vscode.workspace.textDocuments.find(
    (doc) => doc.uri.toString() === uri.toString());
  if (open) return open.getText();
  return Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8');
}

async function assembleWithParts(uri, body) {
  if (!uri || uri.scheme === 'untitled') return { markdown: body, inlined: [], missing: [] };
  const paths = partPaths(body);
  if (!paths.length) return { markdown: body, inlined: [], missing: [] };
  const folder = vscode.Uri.joinPath(uri, '..');
  const texts = new Map();
  for (const path of paths) {
    const partUri = vscode.Uri.joinPath(folder, ...path.split('/'));
    try {
      texts.set(path, await readPart(partUri));
    } catch (e) {
      texts.set(path, null);
    }
  }
  return assembleParts(body, texts);
}

async function withSampleFiles(uri, markdown) {
  if (!uri || uri.scheme === 'untitled') return markdown;
  const folder = vscode.Uri.joinPath(uri, '..');
  const contents = new Map();
  for (const path of sampleLinkPaths(markdown)) {
    try {
      contents.set(path, await readPart(vscode.Uri.joinPath(folder, ...path.split('/'))));
    } catch (e) {
      contents.set(path, null);
    }
  }
  return inlineSamples(markdown, contents);
}

function editorSource(editor) {
  return {
    uri: editor.document.uri,
    text: editor.document.getText(),
    fileName: baseName(editor.document.fileName),
    editor
  };
}

async function uriSource(uri) {
  return {
    uri,
    text: Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8'),
    fileName: baseName(uri.fsPath || uri.path),
    editor: null
  };
}

function bindingBlock(text, meta) {
  const { rawLength, extraLines } = parseFrontMatter(text);
  return { fm: serializeFrontMatter(meta, extraLines) + (rawLength ? '' : '\n'), rawLength };
}

async function writeBinding(source, meta) {
  if (!source.editor) {
    const { fm, rawLength } = bindingBlock(source.text, meta);
    await vscode.workspace.fs.writeFile(source.uri, Buffer.from(fm + source.text.slice(rawLength), 'utf8'));
    return;
  }
  const document = source.editor.document;
  const { fm, rawLength } = bindingBlock(document.getText(), meta);
  await source.editor.edit((edit) =>
    edit.replace(new vscode.Range(document.positionAt(0), document.positionAt(rawLength)), fm));
}

module.exports = { editorSource, uriSource, writeBinding, assembleWithParts, withSampleFiles, splitTitleAndBody };
