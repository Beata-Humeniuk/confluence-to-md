const vscode = require('vscode');
const { parseFrontMatter } = require('./frontMatter');
const { parsePageUrl } = require('./confluenceClient');

async function fileExists(uri) {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch (e) {
    return false;
  }
}

async function confirmOverwrite(files, savedById) {
  const clashing = [];
  for (const file of files) {
    const known = savedById.get(file.pageId);
    if (known && known.relPath === file.relPath) continue;
    if (await fileExists(file.uri)) clashing.push(file.name);
  }
  if (!clashing.length) return true;
  const overwrite = 'Overwrite';
  const picked = await vscode.window.showWarningMessage(
    'The target folder already contains: ' + clashing.join(', ') + '. Overwrite?',
    { modal: true }, overwrite);
  return picked === overwrite;
}

async function readSavedPages(folder) {
  const out = [];
  await walkSavedPages(folder, '', out);
  return out;
}

async function walkSavedPages(folder, dir, out) {
  let entries;
  try {
    entries = await vscode.workspace.fs.readDirectory(folder);
  } catch (e) {
    return;
  }
  for (const [name, kind] of entries) {
    if (kind === vscode.FileType.Directory) {
      if (/\.samples$/i.test(name) || name[0] === '.') continue;
      await walkSavedPages(vscode.Uri.joinPath(folder, name),
        dir ? dir + '/' + name : name, out);
      continue;
    }
    if (kind !== vscode.FileType.File || !/\.md$/i.test(name)) continue;
    const uri = vscode.Uri.joinPath(folder, name);
    let text;
    try {
      text = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8');
    } catch (e) {
      continue;
    }
    const { meta, body, extraLines } = parseFrontMatter(text);
    if (!meta) continue;
    const parsed = parsePageUrl(meta.url);
    const sourceId = (extraLines.join('\n').match(/^sourceId:\s*(\d+)\s*$/m) || [])[1] || '';
    const slug = name.replace(/\.md$/i, '');
    out.push({
      name,
      uri,
      text,
      slug,
      dir,
      relPath: dir ? dir + '/' + slug : slug,
      pageId: sourceId || (parsed && parsed.pageId) || '',
      title: ((body.match(/^#[ \t]+(.+)$/m) || [])[1] || '').trim()
    });
  }
}

module.exports = { readSavedPages, confirmOverwrite };
