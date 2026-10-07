const vscode = require('vscode');
const { slugify, rewriteConfluenceLinks } = require('../core/mdDocument');
const { extractLongCodeBlocks } = require('../core/codeSamples');
const { placeInTree } = require('../core/pageTree');
const { appendixHeading } = require('./config');
const { countOf } = require('../core/messages');
const { confirmOverwrite } = require('./savedPages');
const { pageDocument } = require('./pageDocument');

function assignSlugs(fetched, saved) {
  const slugById = new Map();
  const takenSlugs = new Map();
  for (const s of saved) {
    takenSlugs.set(s.slug, s.pageId);
    if (s.pageId) slugById.set(s.pageId, s.slug);
  }
  for (const entry of fetched) {
    let slug = slugById.get(entry.page.id) || slugify(entry.page.title);
    const owner = takenSlugs.get(slug);
    if (owner && owner !== entry.page.id) slug += '-' + entry.page.id;
    takenSlugs.set(slug, entry.page.id);
    slugById.set(entry.page.id, slug);
  }
  return slugById;
}

function assignPaths(fetched, saved, baseDir) {
  const slugById = assignSlugs(fetched, saved);
  const knownPaths = new Map();
  for (const s of saved) {
    if (s.pageId) knownPaths.set(s.pageId, s.relPath);
  }
  const placedPaths = placeInTree(fetched.map((entry) => ({
    id: entry.page.id,
    ancestors: entry.page.ancestors,
    slug: slugById.get(entry.page.id)
  })), knownPaths, baseDir);

  const pathById = new Map(knownPaths);
  const pathByTitle = new Map();
  for (const s of saved) {
    if (s.title) pathByTitle.set(s.title, s.relPath);
  }
  for (const entry of fetched) {
    pathById.set(entry.page.id, placedPaths.get(entry.page.id));
    pathByTitle.set(entry.page.title, placedPaths.get(entry.page.id));
  }
  return { pathById, pathByTitle };
}

function fileFor(folder, entry, relPath, rewrite) {
  const segments = relPath.split('/');
  const slug = segments[segments.length - 1];
  const dir = segments.slice(0, -1);
  const extracted = extractLongCodeBlocks(rewrite(entry.markdown, dir.join('/')),
    slug + '.samples', { appendixHeading: appendixHeading() });
  return {
    name: relPath + '.md',
    relPath,
    dirUri: dir.length ? vscode.Uri.joinPath(folder, ...dir) : folder,
    pageId: entry.page.id,
    uri: vscode.Uri.joinPath(folder, ...dir, slug + '.md'),
    content: pageDocument(entry.page, extracted.markdown),
    samples: extracted.samples.map((s) => ({
      uri: vscode.Uri.joinPath(folder, ...dir, slug + '.samples', s.name),
      content: s.content
    })),
    samplesUri: vscode.Uri.joinPath(folder, ...dir, slug + '.samples')
  };
}

async function writeFile(file) {
  await vscode.workspace.fs.createDirectory(file.dirUri);
  await vscode.workspace.fs.writeFile(file.uri, Buffer.from(file.content, 'utf8'));
  if (file.samples.length) {
    await vscode.workspace.fs.createDirectory(file.samplesUri);
    for (const sample of file.samples) {
      await vscode.workspace.fs.writeFile(sample.uri, Buffer.from(sample.content, 'utf8'));
    }
  }
}

async function relinkSavedPages(saved, written, rewrite) {
  let relinked = 0;
  for (const s of saved) {
    if (written.has(s.relPath)) continue;
    const updated = rewrite(s.text, s.dir);
    if (updated === s.text) continue;
    await vscode.workspace.fs.writeFile(s.uri, Buffer.from(updated, 'utf8'));
    relinked += 1;
  }
  return relinked;
}

async function saveToFolder(folder, fetched, saved, savedById, origin, subfolder) {
  const baseDir = (subfolder || []).join('/');
  const { pathById, pathByTitle } = assignPaths(fetched, saved, baseDir);
  const rewrite = (md, fromDir) => rewriteConfluenceLinks(md, pathByTitle,
    { slugById: pathById, origin, fromDir });
  const files = fetched.map((entry) => fileFor(folder, entry, pathById.get(entry.page.id), rewrite));
  if (!await confirmOverwrite(files, savedById)) return;

  for (const file of files) {
    await writeFile(file);
  }
  const written = new Set(files.map((f) => f.relPath));
  const relinked = await relinkSavedPages(saved, written, rewrite);

  await vscode.window.showTextDocument(
    await vscode.workspace.openTextDocument(files[0].uri), { preview: false });
  const extracted = files.reduce((n, f) => n + f.samples.length, 0);
  vscode.window.showInformationMessage(
    'Saved ' + countOf(fetched.length, 'page') + ' to ' +
    vscode.workspace.asRelativePath(folder, false) + '/' + (baseDir ? baseDir + '/' : '') + '.' +
    (extracted ? ' Long examples (' + extracted + ') extracted to separate files.' : '') +
    (relinked ? ' Links updated in ' + relinked + ' previously downloaded file(s).' : ''));
}

module.exports = { saveToFolder };
