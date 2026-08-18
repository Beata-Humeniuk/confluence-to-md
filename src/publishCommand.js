const vscode = require('vscode');
const { mdToStorage } = require('./mdToStorage');
const { parseFrontMatter, serializeFrontMatter } = require('./frontMatter');
const { partPaths, assembleParts } = require('./assembleParts');
const { parsePageUrl, fetchPageMeta, fetchPageByTitle, createPage, updatePage, pageWebUrl } = require('./confluenceClient');
const { credentialsFor } = require('./credentials');
const { errorMessage } = require('./messages');

function partsWord(n) {
  return n === 1 ? 'part' : 'parts';
}

function splitTitleAndBody(mdBody, fallbackTitle) {
  const h1 = mdBody.match(/^#[ \t]+(.+)\r?\n?/m);
  if (!h1) return { title: fallbackTitle, content: mdBody };
  return { title: h1[1].trim(), content: mdBody.replace(h1[0], '') };
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

async function assemblePackage(doc, body) {
  const uri = doc && doc.uri;
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

async function confirmMissingParts(missing) {
  if (!missing.length) return true;
  const publish = 'Publish without them';
  const picked = await vscode.window.showWarningMessage(
    'Part files not found: ' + missing.map((m) => m.path).join(', ') +
    '. They will stay on the page as links to files that do not exist in Confluence.',
    { modal: true }, publish);
  return picked === publish;
}

async function writeFrontMatterToEditor(editor, meta) {
  const text = editor.document.getText();
  const { rawLength, extraLines } = parseFrontMatter(text);
  const fm = serializeFrontMatter(meta, extraLines) + (rawLength ? '' : '\n');
  await editor.edit((edit) => {
    edit.replace(new vscode.Range(
      editor.document.positionAt(0), editor.document.positionAt(rawLength)), fm);
  });
}

async function writeFrontMatterToUri(uri, text, meta) {
  const { rawLength, extraLines } = parseFrontMatter(text);
  const fm = serializeFrontMatter(meta, extraLines) + (rawLength ? '' : '\n');
  const newText = fm + text.slice(rawLength);
  await vscode.workspace.fs.writeFile(uri, Buffer.from(newText, 'utf8'));
}

async function publishUpdate(meta, title, storage, note, editor) {
  const parsed = parsePageUrl(meta.url);
  if (!parsed || !parsed.pageId) throw new Error('bad-url');
  const creds = await credentialsFor(parsed.site);
  if (!creds) return;

  const current = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'Checking page version…' },
    () => fetchPageMeta(creds, parsed.site, parsed.pageId));
  if (meta.version && current.version !== meta.version) {
    const overwrite = 'Overwrite';
    const picked = await vscode.window.showWarningMessage(
      'The page has changed in Confluence (version ' + current.version + ', your local copy knows ' + meta.version + '). Overwrite?',
      { modal: true }, overwrite);
    if (picked !== overwrite) return;
  }

  const updated = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'Publishing to Confluence…' },
    () => updatePage(creds, parsed.site, parsed.pageId, { title, storage, version: current.version + 1 }));

  const finalVersion = updated.version || current.version + 1;

  if (editor) {
    await writeFrontMatterToEditor(editor, { url: meta.url, version: finalVersion });
    vscode.window.showInformationMessage('Published "' + title + '" (version ' +
      finalVersion + ').' + (note || ''));
  }

  return { url: meta.url, pageId: updated.id, version: finalVersion, action: 'updated' };
}

async function publishNew(title, storage, note, editor) {
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
  const finalVersion = created.version || 1;

  if (editor) {
    await writeFrontMatterToEditor(editor, { url, version: finalVersion });
    vscode.window.showInformationMessage('Created page "' + title + '" in space ' +
      spaceKey + '.' + (note || ''));
  }

  return { url, pageId: created.id, version: finalVersion, action: 'created' };
}

async function publishPageCommand(fileUri) {
  let editor, text, fileName, docUri;

  if (fileUri) {
    text = Buffer.from(await vscode.workspace.fs.readFile(fileUri)).toString('utf8');
    fileName = (fileUri.fsPath || '').split(/[\\/]/).pop() || '';
    docUri = fileUri;
  } else {
    editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('Open the Markdown file you want to publish.');
      return;
    }
    text = editor.document.getText();
    fileName = (editor.document.fileName || '').split(/[\\/]/).pop() || '';
    docUri = editor.document.uri;
  }

  try {
    const { meta, body } = parseFrontMatter(text);

    const assembled = await assemblePackage({ uri: docUri }, body);
    if (!await confirmMissingParts(assembled.missing)) return;

    const { title, content } = splitTitleAndBody(
      assembled.markdown, fileName.replace(/\.md$/i, '') || 'Untitled');
    const storage = mdToStorage(content);
    const note = assembled.inlined.length
      ? ' The page carries the whole design: ' + assembled.inlined.length + ' ' +
        partsWord(assembled.inlined.length) + ' from the package included.'
      : '';

    let result;
    if (meta) {
      result = await publishUpdate(meta, title, storage, note, editor);
    } else {
      result = await publishNew(title, storage, note, editor);
    }

    if (fileUri && result) {
      await writeFrontMatterToUri(docUri, text, { url: result.url, version: result.version });
    }

    if (result) {
      return { url: result.url, pageId: result.pageId, action: result.action };
    }
  } catch (e) {
    if (fileUri) {
      throw e;
    }
    vscode.window.showErrorMessage(errorMessage(e));
  }
}

module.exports = { publishPageCommand };
