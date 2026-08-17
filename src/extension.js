const vscode = require('vscode');
const { fetchPageCommand } = require('./fetchCommand');
const { publishPageCommand } = require('./publishCommand');
const { provideDocumentLinks, openPageLinkCommand } = require('./documentLinks');

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand('confluenceToMd.fetchPage', fetchPageCommand),
    vscode.commands.registerCommand('confluenceToMd.publishPage', publishPageCommand),
    vscode.commands.registerCommand('confluenceToMd.openPageLink', openPageLinkCommand),
    vscode.languages.registerDocumentLinkProvider({ language: 'markdown' }, { provideDocumentLinks })
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
