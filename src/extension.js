const vscode = require('vscode');
const { fetchPageCommand } = require('./editor/fetchCommand');
const { publishPageCommand } = require('./editor/publishCommand');
const { pullPageCommand } = require('./editor/pullCommand');
const { handlePreviewUri } = require('./editor/previewActions');
const { provideDocumentLinks, openPageLinkCommand } = require('./editor/documentLinks');
const { previewButtons } = require('./core/previewButton');
const { PAGE_DIFF_SCHEME, pageDiffContentProvider } = require('./editor/pageDiff');

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand('confluenceToMd.fetchPage', fetchPageCommand),
    vscode.commands.registerCommand('confluenceToMd.publishPage', publishPageCommand),
    vscode.commands.registerCommand('confluenceToMd.pullPage', pullPageCommand),
    vscode.commands.registerCommand('confluenceToMd.openPageLink', openPageLinkCommand),
    vscode.languages.registerDocumentLinkProvider({ language: 'markdown' }, { provideDocumentLinks }),
    vscode.window.registerUriHandler({ handleUri: handlePreviewUri }),
    vscode.workspace.registerTextDocumentContentProvider(PAGE_DIFF_SCHEME, pageDiffContentProvider)
  );
  return {
    extendMarkdownIt: (md) => previewButtons(md,
      { uriScheme: vscode.env.uriScheme, extensionId: context.extension.id })
  };
}

function deactivate() {}

module.exports = { activate, deactivate };
