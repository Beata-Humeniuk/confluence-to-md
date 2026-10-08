const vscode = require('vscode');
const { parseFrontMatter } = require('../core/frontMatter');
const { createPage, updatePage, pageWebUrl } = require('../core/confluenceClient');
const { uriSource, writeBinding, readLinkedFiles } = require('./publishSource');
const { prepareDocument, storageOf } = require('./publishDocument');

const PUBLISH_ALL = 'Publish all';
const ONLY_THIS = 'Only this page';

function unpublishedOf(linked, ctx) {
  const out = [];
  for (const file of linked.values()) {
    if (!file || file.meta) continue;
    const key = file.uri.toString();
    if (ctx.published.has(key) || ctx.seen.has(key) || out.some((f) => f.uri.toString() === key)) continue;
    out.push(file);
  }
  return out;
}

async function collectUnpublished(doc) {
  const ctx = { published: new Map(), seen: new Set([doc.source.uri.toString()]) };
  const found = [];
  let queue = unpublishedOf(doc.linked, ctx);
  while (queue.length) {
    const next = [];
    for (const file of queue) {
      ctx.seen.add(file.uri.toString());
      found.push(file);
      const source = await uriSource(file.uri);
      const linked = await readLinkedFiles(file.uri, parseFrontMatter(source.text).body);
      next.push(...unpublishedOf(linked, ctx));
    }
    queue = next;
  }
  return found;
}

async function askToPublishLinked(doc) {
  const files = await collectUnpublished(doc);
  if (!files.length) return false;
  const names = files.map((f) => vscode.workspace.asRelativePath(f.uri, false));
  const picked = await vscode.window.showWarningMessage(
    '"' + doc.title + '" links to ' + (files.length === 1 ? 'a file' : files.length + ' files') +
    ' not yet in Confluence: ' + names.join(', ') + '. Publish ' + (files.length === 1 ? 'it' : 'them') +
    ' as pages under it and link to ' + (files.length === 1 ? 'it' : 'them') + '?',
    { modal: true }, PUBLISH_ALL, ONLY_THIS);
  if (!picked) return null;
  return picked === PUBLISH_ALL;
}

async function publishLinked(doc, parentId, ctx) {
  let count = 0;
  for (const file of unpublishedOf(doc.linked, ctx)) {
    ctx.seen.add(file.uri.toString());
    const child = await prepareDocument(await uriSource(file.uri));
    if (!child) continue;
    const created = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'Creating page "' + child.title + '"…' },
      () => createPage(ctx.creds, ctx.site,
        { title: child.title, storage: storageOf(child, ctx.published), spaceKey: ctx.spaceKey, parentId }));
    const url = pageWebUrl(ctx.site, created.spaceKey || ctx.spaceKey, created.id);
    let version = created.version || 1;
    ctx.published.set(file.uri.toString(), url);
    ctx.created.push(child.title);
    await writeBinding(child.source, { url, version });
    count += 1;
    if (await publishLinked(child, created.id, ctx)) {
      const updated = await updatePage(ctx.creds, ctx.site, created.id,
        { title: child.title, storage: storageOf(child, ctx.published), version: version + 1 });
      version = updated.version || version + 1;
      await writeBinding(child.source, { url, version });
    }
  }
  return count;
}

function linkedNote(ctx) {
  if (!ctx.created.length) return '';
  return ' Also published ' + (ctx.created.length === 1 ? 'a linked page' : ctx.created.length + ' linked pages') +
    ': ' + ctx.created.map((t) => '"' + t + '"').join(', ') + '.';
}

module.exports = { askToPublishLinked, publishLinked, linkedNote };
