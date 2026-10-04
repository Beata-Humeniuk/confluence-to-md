const vscode = require('vscode');

const PAGE_DIFF_SCHEME = 'confluence-page';
const contents = new Map();
let revision = 0;

const pageDiffContentProvider = {
  provideTextDocumentContent: (uri) => contents.get(uri.path) || ''
};

async function showPageDiff(localUri, remoteText, version) {
  contents.set(localUri.path, remoteText);
  const remoteUri = vscode.Uri.from(
    { scheme: PAGE_DIFF_SCHEME, path: localUri.path, query: String(++revision) });
  const name = localUri.path.split('/').pop();
  await vscode.commands.executeCommand('vscode.diff', remoteUri, localUri,
    name + ': Confluence (version ' + version + ') ↔ your file');
}

module.exports = { PAGE_DIFF_SCHEME, pageDiffContentProvider, showPageDiff };
