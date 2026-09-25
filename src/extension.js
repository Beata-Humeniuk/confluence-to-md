const vscode = require('vscode');
const { fetchPageCommand } = require('./fetchCommand');
const { publishPageCommand } = require('./publishCommand');
const { pullPageCommand } = require('./pullCommand');
const { handlePreviewUri } = require('./previewActions');
const { provideDocumentLinks, openPageLinkCommand } = require('./documentLinks');
const { previewButtons } = require('./previewButton');

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand('confluenceToMd.fetchPage', fetchPageCommand),
    vscode.commands.registerCommand('confluenceToMd.publishPage', publishPageCommand),
    vscode.commands.registerCommand('confluenceToMd.pullPage', pullPageCommand),
    vscode.commands.registerCommand('confluenceToMd.openPageLink', openPageLinkCommand),
    vscode.languages.registerDocumentLinkProvider({ language: 'markdown' }, { provideDocumentLinks }),
    vscode.window.registerUriHandler({ handleUri: handlePreviewUri })
  );
  return {
    extendMarkdownIt: (md) => previewButtons(md,
      { uriScheme: vscode.env.uriScheme, extensionId: context.extension.id })
  };
}

function deactivate() {}

module.exports = { activate, deactivate };
