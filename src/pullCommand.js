const vscode = require('vscode');
const { convertHtmlToMd } = require('./htmlToMd');
const { rewriteConfluenceLinks } = require('./mdDocument');
const { extractLongCodeBlocks } = require('./codeSamples');
const { parseFrontMatter } = require('./frontMatter');
const { parsePageUrl, fetchPageById } = require('./confluenceClient');
const { downloadFolderUri, imagesMode, appendixHeading } = require('./config');
const { credentialsFor } = require('./credentials');
const { errorMessage } = require('./messages');
const { readSavedPages } = require('./savedPages');
const { pulledDocument } = require('./pageDocument');
const { fileUriOf } = require('./previewButton');

function isInside(dir, root) {
  return !!root && dir.scheme === root.scheme && dir.authority === root.authority &&
    (dir.path === root.path || dir.path.startsWith(root.path.replace(/\/+$/, '') + '/'));
}

// Links between saved pages are relative to the download folder, so pull
// within it when the file lives there, and within the file's own folder otherwise.
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

async function confirmPull(document, localVersion, remoteVersion) {
  const pull = 'Pull';
  const picked = await vscode.window.showWarningMessage(
    'Update "' + vscode.workspace.asRelativePath(document.uri, false) + '" to version ' +
    remoteVersion + ' from Confluence' + (localVersion ? ' (your copy is version ' + localVersion + ')' : '') +
    '? The file content is replaced' +
    (document.isDirty ? ', including your unsaved changes.' : '; changes you have not published are lost.'),
    { modal: true }, pull);
  return picked === pull;
}

async function writeDocument(document, content) {
  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, new vscode.Range(
    document.positionAt(0), document.positionAt(document.getText().length)), content);
  if (!await vscode.workspace.applyEdit(edit)) throw new Error('Could not update ' + document.uri.fsPath);
  await document.save();
}

async function writeSamples(uri, samples) {
  if (!samples.length) return;
  const folder = vscode.Uri.joinPath(uri, '..', samplesFolder(uri));
  await vscode.workspace.fs.createDirectory(folder);
  for (const sample of samples) {
    await vscode.workspace.fs.writeFile(
      vscode.Uri.joinPath(folder, sample.name), Buffer.from(sample.content, 'utf8'));
  }
}

function samplesFolder(uri) {
  return uri.path.split('/').pop().replace(/\.md$/i, '') + '.samples';
}

async function pullDocument(document) {
  const { meta } = parseFrontMatter(document.getText());
  if (!meta) {
    vscode.window.showErrorMessage('This file is not bound to a Confluence page — it has no confluence: block in its front matter.');
    return;
  }
  const parsed = parsePageUrl(meta.url);
  if (!parsed || !parsed.pageId) throw new Error('bad-url');
  const creds = await credentialsFor(parsed.site);
  if (!creds) return;

  const page = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'Checking Confluence for updates…' },
    () => fetchPageById(creds, parsed.site, parsed.pageId));
  if (meta.version && page.version === meta.version && !document.isDirty) {
    vscode.window.showInformationMessage('Already up to date — "' + page.title + '" is at version ' + page.version + '.');
    return;
  }
  if (!await confirmPull(document, meta.version, page.version)) return;

  const converted = convertHtmlToMd(page.html, { origin: parsed.site.origin, images: imagesMode() });
  const linked = await rewriteForFolder(document.uri, converted.markdown, parsed.site.origin);
  const extracted = extractLongCodeBlocks(linked, samplesFolder(document.uri),
    { appendixHeading: appendixHeading() });
  await writeDocument(document, pulledDocument(page, extracted.markdown, document.getText()));
  await writeSamples(document.uri, extracted.samples);

  vscode.window.showInformationMessage('Pulled "' + page.title + '" — version ' + page.version +
    (meta.version ? ' (was ' + meta.version + ').' : '.'));
}

async function pullPageCommand(fileUri) {
  const uri = fileUri || (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.uri);
  if (!uri) {
    vscode.window.showErrorMessage('Open the Markdown file you want to update from Confluence.');
    return;
  }
  try {
    await pullDocument(await vscode.workspace.openTextDocument(uri));
  } catch (e) {
    vscode.window.showErrorMessage(errorMessage(e));
  }
}

// The preview's Pull button opens vscode://<extension>/pull?file=<uri>. Only a
// file that is already open is pulled, so a link from elsewhere cannot reach
// files the user is not looking at.
async function handlePullUri(uri) {
  if (uri.path !== '/pull') return;
  const target = fileUriOf(uri.query);
  const document = target && vscode.workspace.textDocuments.find(
    (doc) => doc.uri.toString() === target);
  if (!document) {
    vscode.window.showErrorMessage('Open the Markdown file you want to update from Confluence, then use Pull again.');
    return;
  }
  await pullPageCommand(document.uri);
}

module.exports = { pullPageCommand, handlePullUri };
