const vscode = require('vscode');
const { pullPageCommand } = require('./pullCommand');
const { publishPageCommand } = require('./publishCommand');
const { fileUriCandidates } = require('../core/previewButton');
const { parseFrontMatter } = require('../core/frontMatter');

async function saveAndPublish(document) {
  try {
    if (document.isDirty && !await document.save()) return;
    await publishPageCommand(document.uri);
  } catch (e) {
    vscode.window.showErrorMessage(e.message);
  }
}

async function publishFromPreview(document) {
  if (!parseFrontMatter(document.getText()).meta) return saveAndPublish(document);
  const publish = 'Publish';
  const picked = await vscode.window.showWarningMessage(
    'Publish "' + vscode.workspace.asRelativePath(document.uri, false) + '" to Confluence?' +
    (document.isDirty ? ' Your unsaved changes are saved first.' : ''),
    { modal: true }, publish);
  if (picked !== publish) return;
  await saveAndPublish(document);
}

const ACTIONS = {
  '/pull': (document) => pullPageCommand(document.uri),
  '/publish': publishFromPreview
};

async function handlePreviewUri(uri) {
  const action = ACTIONS[uri.path];
  if (!action) return;
  const targets = new Set();
  for (const candidate of fileUriCandidates(uri.query)) {
    try {
      targets.add(vscode.Uri.parse(candidate).toString());
    } catch (e) { }
  }
  const document = vscode.workspace.textDocuments.find(
    (doc) => targets.has(doc.uri.toString()));
  if (!document) {
    vscode.window.showErrorMessage('Open the Markdown file in VS Code, then use the button in its preview again.');
    return;
  }
  await action(document);
}

module.exports = { handlePreviewUri };
