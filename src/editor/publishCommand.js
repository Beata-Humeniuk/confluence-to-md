const vscode = require('vscode');
const { editorSource, uriSource, writeBinding } = require('./publishSource');
const {
  parsePageUrl, fetchPageMeta, fetchPageById, fetchPageByTitle, createPage, updatePage, pageWebUrl
} = require('../core/confluenceClient');
const { credentialsFor } = require('./credentials');
const { errorMessage, countOf } = require('../core/messages');
const { remoteDocument } = require('./remoteDocument');
const { showPageDiff } = require('./pageDiff');
const { prepareDocument, storageOf } = require('./publishDocument');
const { askToPublishLinked, publishLinked, linkedNote } = require('./linkedPages');

const COMPARE = 'Compare';
const OVERWRITE = 'Overwrite';

function resolveParentPage(creds, parsed) {
  if (parsed.pageId) return fetchPageMeta(creds, parsed.site, parsed.pageId);
  return fetchPageByTitle(creds, parsed.site, parsed.spaceKey, parsed.title);
}

function overwriteWarning(localVersion, remoteVersion) {
  const state = localVersion
    ? 'The page has changed in Confluence (version ' + remoteVersion +
      ', your file is based on version ' + localVersion + ').'
    : 'Your file does not record which page version it is based on (Confluence has version ' +
      remoteVersion + ').';
  return state + ' Overwriting replaces any changes made there in the meantime. ' +
    'Compare to review them and bring the ones to keep into your file.';
}

async function compareWithPage(source, parsed, creds) {
  const page = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'Downloading the page from Confluence…' },
    () => fetchPageById(creds, parsed.site, parsed.pageId));
  const remote = await remoteDocument(source.uri, page, source.text);
  await showPageDiff(source.uri, remote.text, page.version);
  vscode.window.showInformationMessage('Bring the changes you want to keep into your file, ' +
    'then publish again and choose ' + OVERWRITE + '.');
}

async function confirmOverwrite(source, parsed, creds, localVersion, remoteVersion) {
  const picked = await vscode.window.showWarningMessage(
    overwriteWarning(localVersion, remoteVersion), { modal: true }, COMPARE, OVERWRITE);
  if (picked === COMPARE) await compareWithPage(source, parsed, creds);
  return picked === OVERWRITE;
}

function linkContext(site, creds, spaceKey, doc) {
  return {
    site, creds, spaceKey,
    published: new Map(),
    seen: new Set([doc.source.uri.toString()]),
    created: []
  };
}

async function publishUpdate(doc, withLinked, note) {
  const { source, meta, title } = doc;
  const parsed = parsePageUrl(meta.url);
  if (!parsed || !parsed.pageId) throw new Error('bad-url');
  const creds = await credentialsFor(parsed.site);
  if (!creds) return;

  const current = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'Checking page version…' },
    () => fetchPageMeta(creds, parsed.site, parsed.pageId));
  if (current.version !== meta.version &&
    !await confirmOverwrite(source, parsed, creds, meta.version, current.version)) return;

  const ctx = linkContext(parsed.site, creds, current.spaceKey, doc);
  if (withLinked) await publishLinked(doc, parsed.pageId, ctx);

  const updated = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'Publishing to Confluence…' },
    () => updatePage(creds, parsed.site, parsed.pageId,
      { title, storage: storageOf(doc, ctx.published), version: current.version + 1 }));

  const version = updated.version || current.version + 1;
  await writeBinding(source, { url: meta.url, version });
  vscode.window.showInformationMessage('Published "' + title + '" (version ' +
    version + ').' + note + linkedNote(ctx));
  return { url: meta.url, pageId: String(updated.id || parsed.pageId), action: 'updated' };
}

async function publishNew(doc, withLinked, note) {
  const { source, title } = doc;
  const parentUrl = await vscode.window.showInputBox({
    prompt: 'New page — paste a link to the parent page in Confluence (the new page will be created under it)',
    placeHolder: 'https://…',
    ignoreFocusOut: true
  });
  if (!parentUrl) return;
  const parsed = parsePageUrl(parentUrl);
  if (!parsed) throw new Error('bad-url');
  const creds = await credentialsFor(parsed.site);
  if (!creds) return;

  const parent = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'Checking parent page…' },
    () => resolveParentPage(creds, parsed));
  const ctx = linkContext(parsed.site, creds, parent.spaceKey, doc);
  const created = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'Creating page in Confluence…' },
    () => createPage(creds, parsed.site,
      { title, storage: storageOf(doc, ctx.published), spaceKey: parent.spaceKey, parentId: parent.id }));

  const spaceKey = created.spaceKey || parent.spaceKey;
  const url = pageWebUrl(parsed.site, spaceKey, created.id);
  let version = created.version || 1;
  ctx.published.set(source.uri.toString(), url);
  await writeBinding(source, { url, version });

  if (withLinked && await publishLinked(doc, created.id, ctx)) {
    const updated = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'Linking the published pages…' },
      () => updatePage(creds, parsed.site, created.id,
        { title, storage: storageOf(doc, ctx.published), version: version + 1 }));
    version = updated.version || version + 1;
    await writeBinding(source, { url, version });
  }
  vscode.window.showInformationMessage('Created page "' + title + '" in space ' +
    spaceKey + '.' + note + linkedNote(ctx));
  return { url, pageId: String(created.id), action: 'created' };
}

async function publishPageCommand(fileUri) {
  const editor = fileUri ? null : vscode.window.activeTextEditor;
  if (!fileUri && !editor) {
    vscode.window.showErrorMessage('Open the Markdown file you want to publish.');
    return;
  }

  try {
    const source = fileUri ? await uriSource(fileUri) : editorSource(editor);
    const doc = await prepareDocument(source);
    if (!doc) return;
    const withLinked = await askToPublishLinked(doc);
    if (withLinked === null) return;
    const note = doc.inlined
      ? ' ' + countOf(doc.inlined, 'part file') + ' included in the page.'
      : '';

    return doc.meta
      ? await publishUpdate(doc, withLinked, note)
      : await publishNew(doc, withLinked, note);
  } catch (e) {
    if (fileUri) throw new Error(errorMessage(e));
    vscode.window.showErrorMessage(errorMessage(e));
  }
}

module.exports = { publishPageCommand };
