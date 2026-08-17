const vscode = require('vscode');
const { parseFrontMatter } = require('./frontMatter');
const { parsePageUrl, fetchPageMeta, fetchPageByTitle } = require('./confluenceClient');
const { credentialsFor } = require('./credentials');
const { errorMessage } = require('./messages');
const { pageToMd } = require('./pageDocument');

function parseConfluenceTarget(target) {
  const parts = String(target).replace(/^confluence:/, '').split('/');
  let title = parts[parts.length - 1], spaceKey = parts.length > 1 ? parts[0] : '';
  try {
    title = decodeURIComponent(title);
    spaceKey = decodeURIComponent(spaceKey);
  } catch (e) { }
  return { title, spaceKey };
}

function provideDocumentLinks(doc) {
  const { meta } = parseFrontMatter(doc.getText());
  const parsedSelf = meta ? parsePageUrl(meta.url) : null;
  const out = [];
  const text = doc.getText();
  const re = /\]\((confluence:[^()\s]+|\/[^()\s]+)\)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const target = m[1];
    const range = new vscode.Range(
      doc.positionAt(m.index + 2), doc.positionAt(m.index + 2 + target.length));
    if (target.indexOf('confluence:') === 0) {
      const link = new vscode.DocumentLink(range, vscode.Uri.parse(
        'command:confluenceToMd.openPageLink?' + encodeURIComponent(JSON.stringify([target]))));
      link.tooltip = 'Download and open the Confluence page as Markdown';
      out.push(link);
    } else if (parsedSelf) {
      const link = new vscode.DocumentLink(range, vscode.Uri.parse(parsedSelf.site.origin + target));
      link.tooltip = 'Open in Confluence (browser)';
      out.push(link);
    }
  }
  return out;
}

async function openPageLinkCommand(rawTarget) {
  const editor = vscode.window.activeTextEditor;
  const { meta } = parseFrontMatter(editor ? editor.document.getText() : '');
  if (!meta) {
    vscode.window.showErrorMessage('Cannot tell which Confluence instance this link belongs to — the file has no front matter block (download the page with the "Confluence: Download Page" command).');
    return;
  }
  const parsed = parsePageUrl(meta.url);
  if (!parsed) {
    vscode.window.showErrorMessage(errorMessage(new Error('bad-url')));
    return;
  }
  const creds = await credentialsFor(parsed.site);
  if (!creds) return;

  const t = parseConfluenceTarget(rawTarget);
  try {
    let spaceKey = t.spaceKey || parsed.spaceKey || '';
    if (!spaceKey && parsed.pageId) {
      spaceKey = (await fetchPageMeta(creds, parsed.site, parsed.pageId)).spaceKey;
    }
    const page = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'Downloading: ' + t.title },
      () => fetchPageByTitle(creds, parsed.site, spaceKey, t.title));
    const doc = await vscode.workspace.openTextDocument({ language: 'markdown', content: pageToMd(page).md });
    await vscode.window.showTextDocument(doc, { preview: false });
  } catch (e) {
    vscode.window.showErrorMessage(errorMessage(e));
  }
}

module.exports = { provideDocumentLinks, openPageLinkCommand };
