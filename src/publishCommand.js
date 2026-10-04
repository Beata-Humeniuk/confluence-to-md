const vscode = require('vscode');
const { mdToStorage } = require('./mdToStorage');
const { parseFrontMatter, serializeFrontMatter } = require('./frontMatter');
const { partPaths, assembleParts } = require('./assembleParts');
const { sampleLinkPaths, inlineSamples } = require('./codeSamples');
const {
  parsePageUrl, fetchPageMeta, fetchPageById, fetchPageByTitle, createPage, updatePage, pageWebUrl
} = require('./confluenceClient');
const { credentialsFor } = require('./credentials');
const { errorMessage, countOf } = require('./messages');
const { mermaidMacro, mermaidVersion } = require('./config');
const { remoteDocument } = require('./remoteDocument');
const { showPageDiff } = require('./pageDiff');
const { titleHeading } = require('./mdDocument');

const COMPARE = 'Compare';
const OVERWRITE = 'Overwrite';

function baseName(path) {
  return String(path || '').split(/[\\/]/).pop() || '';
}

// The first H1 outside fenced code is the page title and leaves the body.
function splitTitleAndBody(mdBody, fallbackTitle) {
  const h1 = titleHeading(mdBody);
  if (!h1) return { title: fallbackTitle, content: mdBody };
  return { title: h1.title, content: mdBody.slice(0, h1.start) + mdBody.slice(h1.end) };
}

function resolveParentPage(creds, parsed) {
  if (parsed.pageId) return fetchPageMeta(creds, parsed.site, parsed.pageId);
  return fetchPageByTitle(creds, parsed.site, parsed.spaceKey, parsed.title);
}

async function readPart(uri) {
  const open = vscode.workspace.textDocuments.find(
    (doc) => doc.uri.toString() === uri.toString());
  if (open) return open.getText();
  return Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8');
}

async function assembleWithParts(uri, body) {
  if (!uri || uri.scheme === 'untitled') return { markdown: body, inlined: [], missing: [] };
  const paths = partPaths(body);
  if (!paths.length) return { markdown: body, inlined: [], missing: [] };
  const folder = vscode.Uri.joinPath(uri, '..');
  const texts = new Map();
  for (const path of paths) {
    const partUri = vscode.Uri.joinPath(folder, ...path.split('/'));
    try {
      texts.set(path, await readPart(partUri));
    } catch (e) {
      texts.set(path, null);
    }
  }
  return assembleParts(body, texts);
}

async function withSampleFiles(uri, markdown) {
  if (!uri || uri.scheme === 'untitled') return markdown;
  const folder = vscode.Uri.joinPath(uri, '..');
  const contents = new Map();
  for (const path of sampleLinkPaths(markdown)) {
    try {
      contents.set(path, await readPart(vscode.Uri.joinPath(folder, ...path.split('/'))));
    } catch (e) {
      contents.set(path, null);
    }
  }
  return inlineSamples(markdown, contents);
}

async function confirmMissingParts(missing) {
  if (!missing.length) return true;
  const publish = 'Publish without them';
  const picked = await vscode.window.showWarningMessage(
    'Part files not found: ' + missing.map((m) => m.path).join(', ') +
    '. They will stay on the page as links to files that do not exist in Confluence.',
    { modal: true }, publish);
  return picked === publish;
}

function editorSource(editor) {
  return {
    uri: editor.document.uri,
    text: editor.document.getText(),
    fileName: baseName(editor.document.fileName),
    editor
  };
}

async function uriSource(uri) {
  return {
    uri,
    text: Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8'),
    fileName: baseName(uri.fsPath || uri.path),
    editor: null
  };
}

async function writeBinding(source, meta) {
  if (!source.editor) {
    const { rawLength, extraLines } = parseFrontMatter(source.text);
    const fm = serializeFrontMatter(meta, extraLines) + (rawLength ? '' : '\n');
    await vscode.workspace.fs.writeFile(
      source.uri, Buffer.from(fm + source.text.slice(rawLength), 'utf8'));
    return;
  }
  const document = source.editor.document;
  const { rawLength, extraLines } = parseFrontMatter(document.getText());
  const fm = serializeFrontMatter(meta, extraLines) + (rawLength ? '' : '\n');
  await source.editor.edit((edit) => {
    edit.replace(new vscode.Range(
      document.positionAt(0), document.positionAt(rawLength)), fm);
  });
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

// Asks before replacing a page that may hold changes the file does not have.
async function confirmOverwrite(source, parsed, creds, localVersion, remoteVersion) {
  const picked = await vscode.window.showWarningMessage(
    overwriteWarning(localVersion, remoteVersion), { modal: true }, COMPARE, OVERWRITE);
  if (picked === COMPARE) await compareWithPage(source, parsed, creds);
  return picked === OVERWRITE;
}

async function publishUpdate(source, meta, title, storage, note) {
  const parsed = parsePageUrl(meta.url);
  if (!parsed || !parsed.pageId) throw new Error('bad-url');
  const creds = await credentialsFor(parsed.site);
  if (!creds) return;

  const current = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'Checking page version…' },
    () => fetchPageMeta(creds, parsed.site, parsed.pageId));
  if (current.version !== meta.version &&
    !await confirmOverwrite(source, parsed, creds, meta.version, current.version)) return;

  const updated = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'Publishing to Confluence…' },
    () => updatePage(creds, parsed.site, parsed.pageId, { title, storage, version: current.version + 1 }));

  const version = updated.version || current.version + 1;
  await writeBinding(source, { url: meta.url, version });
  vscode.window.showInformationMessage('Published "' + title + '" (version ' +
    version + ').' + (note || ''));
  return { url: meta.url, pageId: String(updated.id || parsed.pageId), action: 'updated' };
}

async function publishNew(source, title, storage, note) {
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
  const created = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'Creating page in Confluence…' },
    () => createPage(creds, parsed.site, { title, storage, spaceKey: parent.spaceKey, parentId: parent.id }));

  const spaceKey = created.spaceKey || parent.spaceKey;
  const url = pageWebUrl(parsed.site, spaceKey, created.id);
  await writeBinding(source, { url, version: created.version || 1 });
  vscode.window.showInformationMessage('Created page "' + title + '" in space ' +
    spaceKey + '.' + (note || ''));
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
    const { meta, body } = parseFrontMatter(source.text);

    const assembled = await assembleWithParts(source.uri, body);
    if (!await confirmMissingParts(assembled.missing)) return;
    const markdown = await withSampleFiles(source.uri, assembled.markdown);
    const { title, content } = splitTitleAndBody(
      markdown, source.fileName.replace(/\.md$/i, '') || 'Untitled');
    const storage = mdToStorage(content, { mermaidMacro: mermaidMacro(), mermaidVersion: mermaidVersion() });
    const note = assembled.inlined.length
      ? ' ' + countOf(assembled.inlined.length, 'part file') + ' included in the page.'
      : '';

    return meta
      ? await publishUpdate(source, meta, title, storage, note)
      : await publishNew(source, title, storage, note);
  } catch (e) {
    if (fileUri) throw new Error(errorMessage(e));
    vscode.window.showErrorMessage(errorMessage(e));
  }
}

module.exports = { publishPageCommand };
