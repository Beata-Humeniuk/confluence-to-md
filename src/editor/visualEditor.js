const vscode = require('vscode');
const { splitDocument, normalizeBody, sameBody, mergeBody, linkTarget } = require('../core/visualDocument');
const { parseFrontMatter } = require('../core/frontMatter');
const { parsePageUrl } = require('../core/confluenceClient');
const { pullPageCommand } = require('./pullCommand');
const { publishFromPreview } = require('./previewActions');
const { openPageLinkCommand } = require('./documentLinks');

const VISUAL_EDITOR = 'confluenceToMd.visualEditor';
const FLUSH_TIMEOUT = 1500;

function escapeAttribute(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function webviewHtml(webview, extensionUri, document) {
  const media = vscode.Uri.joinPath(extensionUri, 'media');
  const cdn = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'out', 'vditor')).toString();
  const linkBase = webview.asWebviewUri(vscode.Uri.joinPath(document.uri, '..')).toString() + '/';
  const source = webview.cspSource;
  const policy = [
    "default-src 'none'",
    'img-src ' + source + ' https: data:',
    'style-src ' + source + " 'unsafe-inline'",
    'font-src ' + source + ' data:',
    'connect-src ' + source,
    'script-src ' + source
  ].join('; ');
  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n' +
    '<meta http-equiv="Content-Security-Policy" content="' + policy + '">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
    '<link rel="stylesheet" href="' + cdn + '/dist/index.css">\n' +
    '<link rel="stylesheet" href="' + webview.asWebviewUri(vscode.Uri.joinPath(media, 'visualEditor.css')) + '">\n' +
    '</head>\n<body>\n' +
    '<div id="visual-editor" data-cdn="' + escapeAttribute(cdn) + '" data-link-base="' + escapeAttribute(linkBase) + '"></div>\n' +
    // Vditor would load the icons with a synchronous request, which the
    // webview cannot serve, so the toolbar would show no icons.
    '<script id="vditorIconScript" src="' + cdn + '/dist/js/icons/ant.js"></script>\n' +
    '<script src="' + cdn + '/dist/index.min.js"></script>\n' +
    '<script src="' + webview.asWebviewUri(vscode.Uri.joinPath(media, 'visualEditor.js')) + '"></script>\n' +
    '</body>\n</html>';
}

function bodyEdit(document, body) {
  const text = document.getText();
  const parts = splitDocument(text);
  if (sameBody(parts.body, body)) return null;
  return {
    range: new vscode.Range(document.positionAt(parts.head.length), document.positionAt(text.length)),
    text: mergeBody(parts.body, body)
  };
}

async function openLink(document, href) {
  const link = linkTarget(href);
  if (link.kind === 'external') {
    await vscode.env.openExternal(vscode.Uri.parse(link.target));
  } else if (link.kind === 'confluence') {
    await openPageLinkCommand(link.target, document);
  } else if (link.kind === 'site') {
    const { meta } = parseFrontMatter(document.getText());
    const parsed = meta ? parsePageUrl(meta.url) : null;
    if (parsed) await vscode.env.openExternal(vscode.Uri.parse(parsed.site.origin + link.target));
  } else if (link.kind === 'file') {
    const target = vscode.Uri.joinPath(document.uri, '..', link.target);
    await vscode.commands.executeCommand('vscode.open', target);
  }
}

class VisualEditorProvider {
  constructor(extensionUri) {
    this.extensionUri = extensionUri;
  }

  resolveCustomTextEditor(document, panel) {
    const webview = panel.webview;
    const folder = vscode.workspace.getWorkspaceFolder(document.uri);
    webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'out', 'vditor'),
        vscode.Uri.joinPath(this.extensionUri, 'media'),
        folder ? folder.uri : vscode.Uri.joinPath(document.uri, '..')
      ]
    };
    webview.html = webviewHtml(webview, this.extensionUri, document);

    // The body the webview shows. Document changes that only echo the
    // webview's own edits are not sent back, so the cursor stays put.
    let shown = null;
    let bound = false;
    let writing = Promise.resolve();
    let queued = 0;
    let flushWaiter = null;

    const post = (type) => {
      const parts = splitDocument(document.getText());
      shown = normalizeBody(parts.body);
      bound = parts.bound;
      webview.postMessage({ type, body: shown, bound });
    };

    const write = (body) => {
      shown = normalizeBody(body);
      queued += 1;
      writing = writing.then(async () => {
        const change = bodyEdit(document, shown);
        if (!change) return;
        const edit = new vscode.WorkspaceEdit();
        edit.replace(document.uri, change.range, change.text);
        if (!await vscode.workspace.applyEdit(edit)) throw new Error('the edit was rejected');
      }).catch((e) => {
        vscode.window.showErrorMessage('Could not update ' + document.uri.fsPath + ': ' + e.message);
      }).finally(() => {
        queued -= 1;
        // A change typed in the text editor while edits were queued.
        if (!queued && !sameBody(splitDocument(document.getText()).body, shown)) post('update');
      });
    };

    const commands = {
      source: () => vscode.commands.executeCommand('vscode.openWith', document.uri, 'default'),
      pull: () => pullPageCommand(document.uri),
      publish: () => publishFromPreview(document)
    };

    const subscriptions = [
      webview.onDidReceiveMessage(async (message) => {
        if (message.type === 'loaded') {
          post('init');
        } else if (message.type === 'edit') {
          if (message.flush) {
            if (message.body !== null) shown = normalizeBody(message.body);
            if (flushWaiter) flushWaiter();
            flushWaiter = null;
          } else {
            write(message.body);
          }
        } else if (message.type === 'command' && commands[message.name]) {
          await writing;
          try {
            await commands[message.name]();
          } catch (e) {
            vscode.window.showErrorMessage(e.message);
          }
        } else if (message.type === 'openLink') {
          try {
            await openLink(document, message.href);
          } catch (e) {
            vscode.window.showErrorMessage(e.message);
          }
        } else if (message.type === 'pastePlain') {
          // The webview cannot always read the clipboard itself.
          webview.postMessage({ type: 'pasteText', text: await vscode.env.clipboard.readText() });
        }
      }),
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (e.document.uri.toString() !== document.uri.toString() || !e.contentChanges.length) return;
        if (queued || shown === null) return;
        const parts = splitDocument(document.getText());
        if (parts.bound !== bound) post('init');
        else if (!sameBody(parts.body, shown)) post('update');
      }),
      // Saving asks the webview for its latest text first, so a save right
      // after typing does not miss the last keystrokes.
      vscode.workspace.onWillSaveTextDocument((e) => {
        if (e.document.uri.toString() !== document.uri.toString() || shown === null) return;
        e.waitUntil(new Promise((resolve) => {
          const timer = setTimeout(() => {
            flushWaiter = null;
            resolve();
          }, FLUSH_TIMEOUT);
          flushWaiter = () => {
            clearTimeout(timer);
            resolve(writing);
          };
          webview.postMessage({ type: 'flush' });
        }).then(() => {
          const change = bodyEdit(document, shown);
          return change ? [vscode.TextEdit.replace(change.range, change.text)] : [];
        }));
      })
    ];
    panel.onDidDispose(() => subscriptions.forEach((s) => s.dispose()));
  }
}

function registerVisualEditor(context) {
  return vscode.window.registerCustomEditorProvider(VISUAL_EDITOR,
    new VisualEditorProvider(context.extensionUri),
    { webviewOptions: { retainContextWhenHidden: true } });
}

async function openVisualEditorCommand(uri) {
  const target = uri instanceof vscode.Uri ? uri
    : vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.uri;
  if (!target) {
    vscode.window.showErrorMessage('Open a Markdown file first.');
    return;
  }
  await vscode.commands.executeCommand('vscode.openWith', target, VISUAL_EDITOR);
}

async function openMarkdownSourceCommand(uri) {
  const target = uri instanceof vscode.Uri ? uri : activeVisualEditorUri();
  if (!target) return;
  await vscode.commands.executeCommand('vscode.openWith', target, 'default');
}

function activeVisualEditorUri() {
  const tab = vscode.window.tabGroups && vscode.window.tabGroups.activeTabGroup.activeTab;
  const input = tab && tab.input;
  return input && input.viewType === VISUAL_EDITOR ? input.uri : null;
}

module.exports = { registerVisualEditor, openVisualEditorCommand, openMarkdownSourceCommand, VISUAL_EDITOR };
