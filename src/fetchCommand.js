const vscode = require('vscode');
const { convertHtmlToMd } = require('./htmlToMd');
const { slugify, rewriteConfluenceLinks } = require('./mdDocument');
const { extractLongCodeBlocks } = require('./codeSamples');
const { placeInTree } = require('./pageTree');
const { parsePageUrl, fetchPageByUrl, fetchPageById, fetchPageByTitle } = require('./confluenceClient');
const { downloadFolderUri, followLinksEnabled, imagesMode, appendixHeading } = require('./config');
const { credentialsFor } = require('./credentials');
const { errorMessage } = require('./messages');
const { readSavedPages, confirmOverwrite } = require('./savedPages');
const { pageDocument } = require('./pageDocument');

function pagesWord(n) {
  return n === 1 ? 'page' : 'pages';
}

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

function assignPaths(fetched, saved) {
  const slugById = assignSlugs(fetched, saved);
  const knownPaths = new Map();
  for (const s of saved) {
    if (s.pageId) knownPaths.set(s.pageId, s.relPath);
  }
  const placedPaths = placeInTree(fetched.map((entry) => ({
    id: entry.page.id,
    ancestors: entry.page.ancestors,
    slug: slugById.get(entry.page.id)
  })), knownPaths);

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

async function saveToFolder(folder, fetched, saved, savedById, origin) {
  const { pathById, pathByTitle } = assignPaths(fetched, saved);
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
    'Saved ' + fetched.length + ' ' + pagesWord(fetched.length) + ' to ' +
    vscode.workspace.asRelativePath(folder, false) + '/.' +
    (extracted ? ' Long examples (' + extracted + ') extracted to separate files.' : '') +
    (relinked ? ' Links updated in ' + relinked + ' previously downloaded file(s).' : ''));
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
