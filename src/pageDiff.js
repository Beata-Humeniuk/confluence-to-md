const vscode = require('vscode');

// Read-only documents holding the Confluence side of a comparison, keyed by
// the path of the file they are compared with.
const PAGE_DIFF_SCHEME = 'confluence-page';
const contents = new Map();
let revision = 0;

const pageDiffContentProvider = {
  provideTextDocumentContent: (uri) => contents.get(uri.path) || ''
};

// Opens a diff with the page on the left and the editable file on the right,
// so changes made in Confluence can be brought into the file.
async function showPageDiff(localUri, remoteText, version) {
  contents.set(localUri.path, remoteText);
  const remoteUri = vscode.Uri.from(
    { scheme: PAGE_DIFF_SCHEME, path: localUri.path, query: String(++revision) });
  const name = localUri.path.split('/').pop();
  await vscode.commands.executeCommand('vscode.diff', remoteUri, localUri,
    name + ': Confluence (version ' + version + ') ↔ your file');
}

module.exports = { PAGE_DIFF_SCHEME, pageDiffContentProvider, showPageDiff };
