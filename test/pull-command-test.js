const assert = (ok, name) => { if (!ok) { console.error('FAIL: ' + name); process.exit(1); } };

// A VS Code stub, just enough to drive pullCommand end to end: open documents
// backed by an in-memory disk, recorded popups, and the answer to the prompt.
const disk = new Map();
const info = [];
const errors = [];
const warnings = [];
const answers = { warning: undefined };
let routes = [];
let docs = [];

// Like VS Code, toString() percent-encodes path segments (a Windows drive
// becomes /c%3A/), and parse() decodes them again.
function uri(path) {
  return {
    scheme: 'file', authority: '', path, fsPath: path,
    toString: () => 'file://' + path.split('/').map(encodeURIComponent).join('/')
  };
}

function parse(text) {
  if (!/^file:\/\//.test(text)) throw new Error('not a file URI: ' + text);
  return uri(text.slice('file://'.length).split('/').map(decodeURIComponent).join('/'));
}

function joinPath(base, ...parts) {
  const out = [];
  for (const segment of (base.path + '/' + parts.join('/')).split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') out.pop();
    else out.push(segment);
  }
  return uri('/' + out.join('/'));
}

function openDoc(path, dirty) {
  const doc = {
    uri: uri(path),
    isDirty: !!dirty,
    saved: 0,
    getText: () => disk.get(path),
    positionAt: (offset) => offset,
    save: async () => { doc.saved++; doc.isDirty = false; return true; }
  };
  docs.push(doc);
  return doc;
}

function WorkspaceEdit() { this.edits = []; }
WorkspaceEdit.prototype.replace = function (target, range, text) { this.edits.push({ target, range, text }); };

const vscodeStub = {
  Uri: { file: uri, joinPath, parse },
  Range: function Range(start, end) { this.start = start; this.end = end; },
  WorkspaceEdit,
  ProgressLocation: { Notification: 15 },
  FileType: { File: 1, Directory: 2 },
  window: {
    activeTextEditor: null,
    showInformationMessage: (message) => { info.push(message); },
    showErrorMessage: (message) => { errors.push(message); },
    showWarningMessage: async (message) => { warnings.push(message); return answers.warning; },
    withProgress: (options, task) => task()
  },
  workspace: {
    get textDocuments() { return docs; },
    openTextDocument: async (target) => docs.find((d) => d.uri.path === target.path) || openDoc(target.path),
    applyEdit: async (edit) => {
      for (const e of edit.edits) {
        const text = disk.get(e.target.path);
        disk.set(e.target.path, text.slice(0, e.range.start) + e.text + text.slice(e.range.end));
      }
      return true;
    },
    asRelativePath: (target) => target.path.replace(/^\/w\//, ''),
    getConfiguration: () => ({ get: (key) => ({ token: 'T', email: 'a@b.com', downloadFolder: '/w' })[key] }),
    fs: {
      readFile: async (target) => {
        if (!disk.has(target.path)) throw new Error('EntryNotFound: ' + target.path);
        return Buffer.from(disk.get(target.path), 'utf8');
      },
      writeFile: async (target, bytes) => { disk.set(target.path, Buffer.from(bytes).toString('utf8')); },
      createDirectory: async () => {},
      readDirectory: async (folder) => {
        const prefix = folder.path.replace(/\/+$/, '') + '/';
        const entries = new Map();
        for (const path of disk.keys()) {
          if (!path.startsWith(prefix)) continue;
          const rest = path.slice(prefix.length).split('/');
          entries.set(rest[0], rest.length > 1 ? 2 : 1);
        }
        return Array.from(entries);
      }
    },
    getWorkspaceFolder: () => null,
    workspaceFolders: []
  },
  commands: { executeCommand: async () => {} }
};

const Module = require('module');
const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  return request === 'vscode' ? 'vscode' : resolve.call(this, request, ...rest);
};
require.cache.vscode = { id: 'vscode', filename: 'vscode', loaded: true, exports: vscodeStub, children: [], paths: [] };

const sent = [];
global.fetch = async (url, options) => {
  const method = (options && options.method) || 'GET';
  sent.push({ method, url, body: options && options.body ? JSON.parse(options.body) : null });
  const route = routes.find((r) => (r.method || 'GET') === method && url.indexOf(r.match) >= 0);
  const status = route ? 200 : 404;
  return { ok: status === 200, status, url, json: async () => (route && route.body) || {} };
};

const { pullPageCommand } = require('../src/pullCommand');
const { handlePreviewUri } = require('../src/previewActions');
const { actionLink } = require('../src/previewButton');

function reset() {
  disk.clear();
  info.length = 0;
  errors.length = 0;
  warnings.length = 0;
  routes = [];
  sent.length = 0;
  docs = [];
  answers.warning = undefined;
}

const SITE = 'https://acme.atlassian.net/wiki';
const PAGE_URL = SITE + '/spaces/DOC/pages/12345';
const LOCAL = '---\nconfluence:\n  url: ' + PAGE_URL + '\n  version: 3\ntype: confluence-page\n' +
  'generated: 2026-01-01\nsourceId: 12345\nowner: team-docs\ntags:\n  - release\nmanaged: true\n---\n\n# Release notes\n\nOld body.\n';
const OTHER = '---\nconfluence:\n  url: ' + SITE + '/spaces/DOC/pages/777\n  version: 1\nsourceId: 777\n---\n\n# Glossary\n\nTerms.\n';

function page(version, html) {
  return {
    match: '/rest/api/content/12345',
    body: {
      id: '12345', title: 'Release notes', space: { key: 'DOC' }, version: { number: version },
      body: { export_view: { value: html } }, ancestors: []
    }
  };
}

async function main() {
  // A newer version in Confluence replaces the file once the user agrees.
  reset();
  disk.set('/w/notes/release-notes.md', LOCAL);
  disk.set('/w/glossary.md', OTHER);
  routes = [page(5, '<p>New body with the <a href="' + SITE + '/spaces/DOC/pages/777/Glossary">glossary</a>.</p>')];
  answers.warning = 'Pull';
  await pullPageCommand(uri('/w/notes/release-notes.md'));
  let text = disk.get('/w/notes/release-notes.md');
  assert(!errors.length, 'no errors, got: ' + errors.join(' | '));
  assert(warnings.length === 1 && warnings[0].includes('version 5') && warnings[0].includes('version 3'),
    'the user is asked first, with both versions');
  assert(text.includes('  url: ' + PAGE_URL + '\n  version: 5\n'), 'the binding moves to the pulled version');
  assert(text.includes('New body with the [glossary](../glossary.md).'), 'content is replaced and links to saved pages stay relative, got: ' + text);
  assert(!text.includes('Old body'), 'old content is gone');
  assert(text.includes('# Release notes'), 'the title is kept as the H1');
  assert(!text.includes('generated: 2026-01-01'), 'generated date is refreshed');
  assert(text.includes('owner: team-docs\ntags:\n  - release\n'), 'custom front matter keys survive, nested lines included');
  assert((text.match(/^sourceId:/mg) || []).length === 1, 'keys the page sets are not duplicated');
  assert(docs[0].saved === 1, 'the document is saved');
  assert(info.some((m) => m.includes('version 5') && m.includes('was 3')), 'a summary names the versions');

  // Declining the prompt leaves the file alone.
  reset();
  disk.set('/w/notes/release-notes.md', LOCAL);
  routes = [page(5, '<p>New.</p>')];
  await pullPageCommand(uri('/w/notes/release-notes.md'));
  assert(disk.get('/w/notes/release-notes.md') === LOCAL, 'cancelled pull does not touch the file');

  // Same version: nothing to do, no prompt.
  reset();
  disk.set('/w/notes/release-notes.md', LOCAL);
  routes = [page(3, '<p>Same.</p>')];
  await pullPageCommand(uri('/w/notes/release-notes.md'));
  assert(!warnings.length, 'no prompt when already up to date');
  assert(info.some((m) => m.includes('Already up to date')), 'says it is up to date');
  assert(disk.get('/w/notes/release-notes.md') === LOCAL, 'up-to-date file is untouched');

  // Same version but unsaved edits: pulling means discarding them, so ask.
  reset();
  disk.set('/w/notes/release-notes.md', LOCAL);
  openDoc('/w/notes/release-notes.md', true);
  routes = [page(3, '<p>Same.</p>')];
  answers.warning = 'Pull';
  await pullPageCommand(uri('/w/notes/release-notes.md'));
  assert(warnings.length === 1 && warnings[0].includes('unsaved'), 'unsaved changes are called out');
  assert(disk.get('/w/notes/release-notes.md').includes('Same.'), 'confirmed pull discards unsaved edits');

  // An unbound file cannot be pulled.
  reset();
  disk.set('/w/plain.md', '# Plain\n');
  await pullPageCommand(uri('/w/plain.md'));
  assert(errors.length === 1 && errors[0].includes('not bound'), 'unbound file is refused');

  // The preview button's URI only pulls a file that is open.
  reset();
  disk.set('/w/notes/release-notes.md', LOCAL);
  routes = [page(5, '<p>New.</p>')];
  answers.warning = 'Pull';
  const link = { path: '/pull', query: 'file=' + encodeURIComponent('file:///w/notes/release-notes.md') };
  await handlePreviewUri(link);
  assert(errors.length === 1 && disk.get('/w/notes/release-notes.md') === LOCAL, 'a closed file is not pulled from a link');
  errors.length = 0;
  openDoc('/w/notes/release-notes.md');
  await handlePreviewUri(link);
  assert(!errors.length && disk.get('/w/notes/release-notes.md').includes('version: 5'), 'an open file is pulled from the preview link');

  // A Windows path, as the preview button encodes it and as VS Code hands the
  // link over: the query arrives decoded once.
  reset();
  const WIN = '/c:/Users/Ann Lee/docs/release-notes.md';
  disk.set(WIN, LOCAL);
  openDoc(WIN);
  routes = [page(5, '<p>New.</p>')];
  answers.warning = 'Pull';
  const button = actionLink('vscode', 'beatahumeniuk.confluence-to-md', 'pull', uri(WIN).toString());
  await handlePreviewUri({ path: '/pull', query: decodeURIComponent(button.split('?')[1]) });
  assert(!errors.length, 'a Windows file is found from the preview link, got: ' + errors.join(' | '));
  assert(disk.get(WIN).includes('version: 5'), 'the Windows file is pulled');
  disk.set(WIN, LOCAL);
  await handlePreviewUri({ path: '/pull', query: button.split('?')[1] });
  assert(!errors.length && disk.get(WIN).includes('version: 5'), 'a still-encoded query works too');

  await handlePreviewUri({ path: '/other', query: '' });
  assert(!errors.length, 'unknown URI paths are ignored');

  // Publish from the preview: asks first, saves unsaved edits, then publishes.
  reset();
  disk.set('/w/notes/release-notes.md', LOCAL);
  const doc = openDoc('/w/notes/release-notes.md', true);
  const push = { path: '/publish', query: 'file=' + encodeURIComponent('file:///w/notes/release-notes.md') };
  routes = [page(3, ''), { method: 'PUT', match: '/rest/api/content/12345', body: { id: '12345', version: { number: 4 } } }];
  await handlePreviewUri(push);
  assert(warnings.length === 1 && warnings[0].includes('unsaved'), 'push asks first and mentions unsaved changes');
  assert(!sent.some((r) => r.method === 'PUT') && doc.saved === 0, 'declined push neither saves nor publishes');
  answers.warning = 'Publish';
  await handlePreviewUri(push);
  assert(doc.saved === 1, 'unsaved edits are saved before publishing');
  const put = sent.find((r) => r.method === 'PUT');
  assert(put && put.body.version.number === 4 && put.body.title === 'Release notes', 'the page is published as the next version');
  assert(disk.get('/w/notes/release-notes.md').includes('version: 4'), 'the binding records the published version');
  assert(!errors.length, 'no errors on push, got: ' + errors.join(' | '));

  // A failed publish is shown, not thrown.
  reset();
  disk.set('/w/notes/release-notes.md', LOCAL);
  openDoc('/w/notes/release-notes.md');
  answers.warning = 'Publish';
  await handlePreviewUri(push);
  assert(errors.length === 1 && errors[0].includes('not found'), 'publish errors reach the user, got: ' + errors.join(' | '));

  console.log('pull command: OK');
}

main().catch((e) => { console.error(e); process.exit(1); });
