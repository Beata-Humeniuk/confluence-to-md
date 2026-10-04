const vscode = require('vscode');
const { convertHtmlToMd } = require('../core/htmlToMd');
const { parsePageUrl, fetchPageByUrl, fetchPageById, fetchPageByTitle } = require('../core/confluenceClient');
const { downloadFolderUri, followLinksEnabled, imagesMode } = require('./config');
const { credentialsFor } = require('./credentials');
const { errorMessage } = require('../core/messages');
const { readSavedPages } = require('./savedPages');
const { pageDocument } = require('./pageDocument');
const { saveToFolder } = require('./downloadFiles');

async function fetchLinkedPages(creds, page, links, savedById, convert, fetched, failures) {
  const picks = await vscode.window.showQuickPick(
    links.map((l) => {
      const known = l.pageId && savedById.get(l.pageId);
      return {
        label: l.title,
        description: known ? 'already in the folder: ' + known.name : (l.spaceKey || page.spaceKey),
        link: l,
        picked: !known
      };
    }),
    { canPickMany: true, placeHolder: 'This page links to other Confluence pages — which ones should be downloaded too?' });
  for (const p of picks || []) {
    try {
      const sub = await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Downloading: ' + p.link.title },
        () => p.link.pageId
          ? fetchPageById(creds, page.site, p.link.pageId)
          : fetchPageByTitle(creds, page.site, p.link.spaceKey || page.spaceKey, p.link.title));
      if (!fetched.some((f) => f.page.id === sub.id)) {
        fetched.push({ page: sub, markdown: convertHtmlToMd(sub.html, convert).markdown });
      }
    } catch (e) {
      failures.push(p.link.title + ' (' + errorMessage(e) + ')');
    }
  }
}

async function openAsOneDocument(fetched) {
  let md = pageDocument(fetched[0].page, fetched[0].markdown);
  for (const entry of fetched.slice(1)) {
    md += '\n---\n\n# ' + entry.page.title + '\n\n' + entry.markdown;
  }
  const doc = await vscode.workspace.openTextDocument({ language: 'markdown', content: md });
  await vscode.window.showTextDocument(doc, { preview: false });
}

async function fetchPageCommand() {
  const folder = downloadFolderUri();
  const url = await vscode.window.showInputBox({
    prompt: 'Paste the full link to a Confluence page (any instance)',
    placeHolder: 'https://…',
    ignoreFocusOut: true
  });
  if (!url) return;

  const parsed = parsePageUrl(url);
  if (!parsed) {
    vscode.window.showErrorMessage(errorMessage(new Error('bad-url')));
    return;
  }
  const creds = await credentialsFor(parsed.site);
  if (!creds) return;

  let page;
  try {
    page = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'Downloading Confluence page…' },
      () => fetchPageByUrl(creds, url.trim()));
  } catch (e) {
    vscode.window.showErrorMessage(errorMessage(e));
    return;
  }

  const convert = { origin: page.site.origin, images: imagesMode() };
  const converted = convertHtmlToMd(page.html, convert);
  const fetched = [{ page, markdown: converted.markdown }];
  const failures = [];

  const saved = folder ? await readSavedPages(folder) : [];
  const savedById = new Map(saved.filter((s) => s.pageId).map((s) => [s.pageId, s]));

  if (followLinksEnabled() && converted.links.length) {
    await fetchLinkedPages(creds, page, converted.links, savedById, convert, fetched, failures);
  }

  if (folder) {
    await saveToFolder(folder, fetched, saved, savedById, page.site.origin);
  } else {
    await openAsOneDocument(fetched);
  }
  if (failures.length) {
    vscode.window.showWarningMessage('Failed to download: ' + failures.join('; '));
  }
}

module.exports = { fetchPageCommand };
