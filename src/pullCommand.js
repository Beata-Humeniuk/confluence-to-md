const vscode = require('vscode');
const { parseFrontMatter } = require('./frontMatter');
const { parsePageUrl, fetchPageById } = require('./confluenceClient');
const { credentialsFor } = require('./credentials');
const { errorMessage } = require('./messages');
const { remoteDocument, samplesFolder } = require('./remoteDocument');
const { showPageDiff } = require('./pageDiff');

const PULL = 'Pull';
const COMPARE = 'Compare';

function askToPull(document, localVersion, remoteVersion) {
  return vscode.window.showWarningMessage(
    'Update "' + vscode.workspace.asRelativePath(document.uri, false) + '" to version ' +
    remoteVersion + ' from Confluence' + (localVersion ? ' (your copy is version ' + localVersion + ')' : '') +
    '? The file content is replaced' +
    (document.isDirty ? ', including your unsaved changes.' : '; changes you have not published are lost.') +
    ' Compare to review the differences first.',
    { modal: true }, COMPARE, PULL);
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
  const remote = await remoteDocument(document.uri, page, document.getText());
  const picked = await askToPull(document, meta.version, page.version);
  if (picked === COMPARE) {
    await showPageDiff(document.uri, remote.text, page.version);
    return;
  }
  if (picked !== PULL) return;

  await writeDocument(document, remote.text);
  await writeSamples(document.uri, remote.samples);

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

module.exports = { pullPageCommand };
