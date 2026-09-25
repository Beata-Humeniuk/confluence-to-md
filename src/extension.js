const vscode = require('vscode');
const { fetchPageCommand } = require('./fetchCommand');
const { publishPageCommand } = require('./publishCommand');
const { pullPageCommand, handlePullUri } = require('./pullCommand');
const { provideDocumentLinks, openPageLinkCommand } = require('./documentLinks');
const { previewPullButton } = require('./previewButton');

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand('confluenceToMd.fetchPage', fetchPageCommand),
    vscode.commands.registerCommand('confluenceToMd.publishPage', publishPageCommand),
    vscode.commands.registerCommand('confluenceToMd.pullPage', pullPageCommand),
    vscode.commands.registerCommand('confluenceToMd.openPageLink', openPageLinkCommand),
    vscode.languages.registerDocumentLinkProvider({ language: 'markdown' }, { provideDocumentLinks }),
    vscode.window.registerUriHandler({ handleUri: handlePullUri })
  );
  return {
    extendMarkdownIt: (md) => previewPullButton(md,
      { uriScheme: vscode.env.uriScheme, extensionId: context.extension.id })
  };
}

function deactivate() {}

module.exports = { activate, deactivate };
