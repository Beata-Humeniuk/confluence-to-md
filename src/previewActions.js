const vscode = require('vscode');
const { pullPageCommand } = require('./pullCommand');
const { publishPageCommand } = require('./publishCommand');
const { fileUriOf } = require('./previewButton');

async function pushFromPreview(document) {
  const push = 'Push';
  const picked = await vscode.window.showWarningMessage(
    'Publish "' + vscode.workspace.asRelativePath(document.uri, false) + '" to Confluence?' +
    (document.isDirty ? ' Your unsaved changes are saved first.' : ''),
    { modal: true }, push);
  if (picked !== push) return;
  try {
    if (document.isDirty && !await document.save()) return;
    await publishPageCommand(document.uri);
  } catch (e) {
    vscode.window.showErrorMessage(e.message);
  }
}

const ACTIONS = {
  '/pull': (document) => pullPageCommand(document.uri),
  '/push': pushFromPreview
};

// The preview's buttons open vscode://<extension>/<action>?file=<uri>. Only a
// file that is already open is acted on, so a link from elsewhere cannot reach
// files the user is not looking at.
async function handlePreviewUri(uri) {
  const action = ACTIONS[uri.path];
  if (!action) return;
  const target = fileUriOf(uri.query);
  const document = target && vscode.workspace.textDocuments.find(
    (doc) => doc.uri.toString() === target);
  if (!document) {
    vscode.window.showErrorMessage('Open the Markdown file in VS Code, then use the button in its preview again.');
    return;
  }
  await action(document);
}

module.exports = { handlePreviewUri };
