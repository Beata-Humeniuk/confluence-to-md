const os = require('os');
const vscode = require('vscode');
const { parseDownloadFolder } = require('./downloadFolder');

function settings() {
  return vscode.workspace.getConfiguration('confluenceToMd');
}

function activeFileFolderUri() {
  const editor = vscode.window.activeTextEditor;
  const uri = editor && editor.document && editor.document.uri;
  if (!uri || uri.scheme === 'untitled') return null;
  return vscode.Uri.joinPath(uri, '..');
}

function workspaceFolderUri() {
  const editor = vscode.window.activeTextEditor;
  const own = editor && editor.document && vscode.workspace.getWorkspaceFolder(editor.document.uri);
  const folder = own || (vscode.workspace.workspaceFolders || [])[0];
  return folder ? folder.uri : null;
}

function downloadFolderUri() {
  const target = parseDownloadFolder(settings().get('downloadFolder'), os.homedir());
  if (target.kind === 'absolute') return vscode.Uri.file(target.path);
  if (target.kind === 'relative') {
    const base = workspaceFolderUri() || activeFileFolderUri();
    return base ? vscode.Uri.joinPath(base, ...target.segments) : null;
  }
  return activeFileFolderUri() || workspaceFolderUri();
}

function followLinksEnabled() {
  return settings().get('followLinks') !== false;
}

function configuredToken() {
  const token = String(settings().get('token') || '').trim();
  return token || null;
}

function configuredEmail() {
  return settings().get('email') || '';
}

function imagesMode() {
  return settings().get('images') || 'skip';
}

function appendixHeading() {
  return String(settings().get('appendixHeading') || '').trim();
}

module.exports = {
  downloadFolderUri, followLinksEnabled, configuredToken, configuredEmail,
  imagesMode, appendixHeading
};
