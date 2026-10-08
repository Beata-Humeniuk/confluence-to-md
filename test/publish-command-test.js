const { assert } = require('./assert');
const { errorMessage } = require('../src/core/messages');

const disk = new Map();
const sent = [];
const info = [];
const errors = [];
const answers = { input: undefined, warning: undefined };
const warnings = [];
const commands = [];
let routes = [];

function uri(path) {
  return { scheme: 'file', path, fsPath: path, toString: () => 'file://' + path };
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

function fakeEditor(path, text) {
  const editor = {
    text,
    edits: 0,
    document: {
      uri: uri(path),
      fileName: path,
      getText: () => editor.text,
      positionAt: (offset) => offset
    },
    edit: async (apply) => {
      editor.edits++;
      apply({ replace: (range, replacement) => { editor.text = replacement + editor.text.slice(range.end); } });
      return true;
    }
  };
  return editor;
}

const vscodeStub = {
  Uri: { file: uri, joinPath, from: (parts) => parts },
  Range: function Range(start, end) { this.start = start; this.end = end; },
  ProgressLocation: { Notification: 15 },
  window: {
    activeTextEditor: null,
    showInformationMessage: (message) => { info.push(message); },
    showErrorMessage: (message) => { errors.push(message); },
    showWarningMessage: async (message) => { warnings.push(message); return answers.warning; },
    showInputBox: async () => answers.input,
    withProgress: (options, task) => task()
  },
  workspace: {
    textDocuments: [],
    asRelativePath: (target) => target.path.replace(/^\/w\//, ''),
    getConfiguration: () => ({ get: (key) => ({ token: 'T', email: 'a@b.com' })[key] }),
    fs: {
      readFile: async (target) => {
        if (!disk.has(target.path)) throw new Error('EntryNotFound: ' + target.path);
        return Buffer.from(disk.get(target.path), 'utf8');
      },
      writeFile: async (target, bytes) => { disk.set(target.path, Buffer.from(bytes).toString('utf8')); }
    },
    getWorkspaceFolder: () => null,
    workspaceFolders: []
  },
  commands: { executeCommand: async (...args) => { commands.push(args); } },
  languages: { registerDocumentLinkProvider: () => {} }
};

const Module = require('module');
const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  return request === 'vscode' ? 'vscode' : resolve.call(this, request, ...rest);
};
require.cache.vscode = { id: 'vscode', filename: 'vscode', loaded: true, exports: vscodeStub, children: [], paths: [] };

global.fetch = async (url, options) => {
  const method = (options && options.method) || 'GET';
  sent.push({ method, url, body: options && options.body ? JSON.parse(options.body) : null });
  const route = routes.find((r) => r.method === method && url.indexOf(r.match) >= 0);
  const status = route ? (route.status || 200) : 404;
  return { ok: status >= 200 && status < 300, status, url, json: async () => (route && (typeof route.body === 'function' ? route.body() : route.body)) || {} };
};

const { publishPageCommand } = require('../src/editor/publishCommand');

function reset() {
  disk.clear();
  sent.length = 0;
  info.length = 0;
  errors.length = 0;
  routes = [];
  answers.input = undefined;
  answers.warning = undefined;
  warnings.length = 0;
  commands.length = 0;
  vscodeStub.window.activeTextEditor = null;
  vscodeStub.workspace.textDocuments = [];
}

async function rejection(run) {
  try {
    await run();
  } catch (e) {
    return e;
  }
  return null;
}

const SITE = 'https://acme.atlassian.net/wiki';
const PAGE_URL = SITE + '/spaces/DOC/pages/12345';
const BOUND = '---\nconfluence:\n  url: ' + PAGE_URL + '\n  version: 3\n---\n\n# Release notes\n\nBody.\n';
const META = { method: 'GET', match: '/rest/api/content/12345', body: { id: '12345', space: { key: 'DOC' }, version: { number: 3 } } };
const UPDATED = { method: 'PUT', match: '/rest/api/content/12345', body: { id: '12345', space: { key: 'DOC' }, version: { number: 4 } } };

async function main() {
  reset();
  disk.set('/w/doc.md', BOUND);
  routes = [META, UPDATED];
  let result = await publishPageCommand(uri('/w/doc.md'));
  assert(result && result.action === 'updated', 'bound file published by URI reports an update');
  assert(result.url === PAGE_URL, 'update returns the bound page url, got: ' + (result && result.url));
  assert(result.pageId === '12345', 'update returns the page id as a string');
  assert(Object.keys(result).sort().join() === 'action,pageId,url', 'result carries exactly the documented keys');
  assert(disk.get('/w/doc.md').includes('version: 4'), 'the new version is written back to the file on disk');
  assert(disk.get('/w/doc.md').includes('# Release notes'), 'the body survives the binding rewrite');
  assert(!errors.length, 'no error popup on the programmatic path');
  const put = sent.find((r) => r.method === 'PUT');
  assert(put.body.version.number === 4, 'the update is sent as the next version');
  assert(put.body.title === 'Release notes', 'the H1 becomes the page title');

  reset();
  disk.set('/w/doc.md', BOUND);
  const bystander = fakeEditor('/w/other.md', '# Something else\n');
  vscodeStub.window.activeTextEditor = bystander;
  routes = [META, UPDATED];
  await publishPageCommand(uri('/w/doc.md'));
  assert(bystander.edits === 0 && bystander.text === '# Something else\n',
    'publishing by URI leaves the active editor alone');

  reset();
  disk.set('/w/new-page.md', '# New page\n\nBody.\n');
  answers.input = SITE + '/spaces/DOC/pages/900';
  routes = [
    { method: 'GET', match: '/rest/api/content/900', body: { id: '900', space: { key: 'DOC' }, version: { number: 2 } } },
    { method: 'POST', match: '/rest/api/content', body: { id: '777', space: { key: 'DOC' }, version: { number: 1 } } }
  ];
  result = await publishPageCommand(uri('/w/new-page.md'));
  assert(result && result.action === 'created', 'unbound file published by URI reports a creation');
  assert(result.url === SITE + '/spaces/DOC/pages/777', 'create returns the new page url, got: ' + (result && result.url));
  assert(result.pageId === '777', 'create returns the new page id');
  const written = disk.get('/w/new-page.md');
  assert(written.startsWith('---\nconfluence:\n'), 'the binding is prepended to a file that had none');
  assert(written.includes('pages/777') && written.includes('version: 1'), 'the binding names the created page');
  assert(written.includes('# New page') && written.includes('Body.'), 'the original text is kept below the binding');
  const post = sent.find((r) => r.method === 'POST');
  assert(post.body.ancestors[0].id === '900', 'the new page is created under the parent that was pasted');
  assert(post.body.space.key === 'DOC', 'the new page lands in the parent space');

  reset();
  disk.set('/w/pkg/api.md', '---\nconfluence:\n  url: ' + PAGE_URL + '\n  version: 3\n---\n\n# API\n\n## Steps\n\n- [Validation](parts/step-01.md)\n');
  disk.set('/w/pkg/parts/step-01.md', '---\ntype: guide-part\n---\n\n## Validation\n\nCheck the payload.\n');
  routes = [META, UPDATED];
  result = await publishPageCommand(uri('/w/pkg/api.md'));
  assert(result && result.action === 'updated', 'a split document publishes by URI');
  assert(sent.find((r) => r.method === 'PUT').body.body.storage.value.includes('Check the payload.'),
    'the part is inlined into the page that is sent');
  assert(info.length === 1 && /1 part file included/.test(info[0]),
    'the assembled page is reported, got: ' + info[0]);

  reset();
  disk.set('/w/doc.md', '---\nconfluence:\n  url: ' + PAGE_URL + '\n  version: 3\n---\n\n```sh\n# install first\nnpm ci\n```\n\n# Real title\n\nBody.\n');
  routes = [META, UPDATED];
  await publishPageCommand(uri('/w/doc.md'));
  const titled = sent.find((r) => r.method === 'PUT').body;
  assert(titled.title === 'Real title', 'the title comes from the heading outside the code block, got: ' + titled.title);
  assert(titled.body.storage.value.includes('# install first') && !titled.body.storage.value.includes('Real title'),
    'the code block keeps its comment and the title leaves the body');

  reset();
  disk.set('/w/docs/index.md', BOUND + '\nSee [Account](uslugi/konto.md), [Up](../top.md) and [Draft](draft.md).\n');
  disk.set('/w/docs/uslugi/konto.md', '---\nconfluence:\n  url: ' + SITE + '/spaces/DOC/pages/501\n  version: 2\n---\n\n# Konto\n');
  disk.set('/w/top.md', '---\nconfluence:\n  url: ' + SITE + '/spaces/DOC/pages/502\n  version: 1\n---\n\n# Top\n');
  disk.set('/w/docs/draft.md', '# Not published yet\n');
  routes = [META, UPDATED];
  await publishPageCommand(uri('/w/docs/index.md'));
  assert(warnings.length === 1 && warnings[0].includes('docs/draft.md') && !warnings[0].includes('konto'),
    'publishing asks about linked files that are not in Confluence yet, got: ' + warnings.join(' | '));
  assert(!sent.some((r) => r.method === 'PUT' || r.method === 'POST'), 'cancelling that question publishes nothing');
  answers.warning = 'Only this page';
  await publishPageCommand(uri('/w/docs/index.md'));
  assert(!sent.some((r) => r.method === 'POST'), '"Only this page" creates no linked pages');
  const linked = sent.find((r) => r.method === 'PUT').body.body.storage.value;
  assert(linked.includes('<a href="' + SITE + '/spaces/DOC/pages/501">Account</a>') &&
    linked.includes('<a href="' + SITE + '/spaces/DOC/pages/502">Up</a>'),
    'links to other published Markdown files point at their Confluence pages, got: ' + linked);
  assert(!linked.includes('.md') && linked.includes('and Draft.'), 'a link to an unpublished file keeps only its text');

  reset();
  disk.set('/w/docs/index.md', BOUND + '\nSee [Account](uslugi/konto.md) and [Draft](draft.md).\n');
  disk.set('/w/docs/uslugi/konto.md', '# Konto\n\nBack to [index](../index.md), on to [Details](details.md).\n');
  disk.set('/w/docs/uslugi/details.md', '# Details\n\nSee [Konto](konto.md).\n');
  disk.set('/w/docs/draft.md', '# Draft\n\nSee [Konto](uslugi/konto.md).\n');
  let nextId = 600;
  routes = [
    META, UPDATED,
    { method: 'POST', match: '/rest/api/content', body: () => ({ id: String(nextId++), space: { key: 'DOC' }, version: { number: 1 } }) },
    { method: 'PUT', match: '/rest/api/content/6', body: { version: { number: 2 } } }
  ];
  answers.warning = 'Publish all';
  result = await publishPageCommand(uri('/w/docs/index.md'));
  assert(warnings.length === 1 && warnings[0].includes('3 files'), 'the question lists linked files found further down, got: ' + warnings[0]);
  const posts = sent.filter((r) => r.method === 'POST').map((r) => r.body);
  assert(posts.map((p) => p.title).join('|') === 'Konto|Details|Draft',
    'every unpublished linked file is created once, got: ' + posts.map((p) => p.title).join('|'));
  assert(posts[0].ancestors[0].id === '12345' && posts[1].ancestors[0].id === '600' && posts[2].ancestors[0].id === '12345',
    'linked pages go under the page that links to them');
  assert(posts[0].body.storage.value.includes('href="' + PAGE_URL + '"'), 'a link back to the published page points at it');
  assert(disk.get('/w/docs/uslugi/konto.md').startsWith('---\nconfluence:\n  url: ' + SITE + '/spaces/DOC/pages/600\n  version: 2\n'),
    'a linked page is bound and updated once its own links exist, got: ' + disk.get('/w/docs/uslugi/konto.md'));
  assert(disk.get('/w/docs/uslugi/details.md').includes('pages/601') && disk.get('/w/docs/draft.md').includes('pages/602'),
    'every created page is recorded in its file');
  const konto = sent.filter((r) => r.method === 'PUT' && r.url.includes('/content/600')).pop().body.body.storage.value;
  assert(konto.includes('href="' + SITE + '/spaces/DOC/pages/601"'), 'the second pass links the page created below it');
  const index = sent.filter((r) => r.method === 'PUT' && r.url.includes('/content/12345')).pop().body.body.storage.value;
  assert(index.includes('pages/600">Account</a>') && index.includes('pages/602">Draft</a>'),
    'the published page links to the new pages, got: ' + index);
  assert(info.length === 1 && info[0].includes('Also published 3 linked pages'), 'the summary names the linked pages, got: ' + info[0]);

  reset();
  disk.set('/w/doc.md', BOUND);
  routes = [META, { method: 'PUT', match: '/rest/api/content/12345', status: 400, body: { message: 'Error parsing xhtml' } }];
  const rejected = await rejection(() => publishPageCommand(uri('/w/doc.md')));
  assert(rejected && rejected.message === 'Confluence rejected the request (400): Error parsing xhtml',
    'the reason Confluence gives is shown, got: ' + (rejected && rejected.message));

  reset();
  disk.set('/w/new-page.md', '# New page\n\nBody.\n');
  answers.input = undefined;
  result = await publishPageCommand(uri('/w/new-page.md'));
  assert(result === undefined, 'cancelling the parent prompt resolves to undefined');
  assert(!sent.length, 'nothing is sent to Confluence after a cancel');
  assert(disk.get('/w/new-page.md') === '# New page\n\nBody.\n', 'the file is left untouched after a cancel');

  reset();
  disk.set('/w/doc.md', BOUND);
  routes = [{ method: 'GET', match: '/rest/api/content/12345', body: { id: '12345', space: { key: 'DOC' }, version: { number: 9 } } }];
  answers.warning = undefined;
  result = await publishPageCommand(uri('/w/doc.md'));
  assert(result === undefined, 'declining the remote-change warning resolves to undefined');
  assert(!sent.some((r) => r.method === 'PUT'), 'a declined overwrite sends no update');
  assert(disk.get('/w/doc.md') === BOUND, 'a declined overwrite leaves the file as it was');

  reset();
  disk.set('/w/doc.md', BOUND);
  routes = [{ method: 'GET', match: '/rest/api/content/12345', body: {
    id: '12345', title: 'Release notes', space: { key: 'DOC' }, version: { number: 9 },
    body: { export_view: { value: '<p>Edited by someone else.</p>' } } } }];
  answers.warning = 'Compare';
  result = await publishPageCommand(uri('/w/doc.md'));
  assert(result === undefined, 'comparing resolves to undefined');
  assert(warnings.length === 1 && warnings[0].includes('version 9') && warnings[0].includes('version 3'),
    'the warning names both versions, got: ' + warnings[0]);
  assert(!sent.some((r) => r.method === 'PUT'), 'comparing sends no update');
  assert(disk.get('/w/doc.md') === BOUND, 'comparing leaves the file as it was');
  assert(commands.length === 1 && commands[0][0] === 'vscode.diff' && commands[0][2].path === '/w/doc.md',
    'a diff with the file is opened');
  const { pageDiffContentProvider } = require('../src/editor/pageDiff');
  assert(pageDiffContentProvider.provideTextDocumentContent(commands[0][1]).includes('Edited by someone else.'),
    'the diff shows the page as it is in Confluence');
  assert(info.some((m) => /publish again/.test(m)), 'the next step is explained');

  reset();
  disk.set('/w/doc.md', BOUND);
  routes = [{ method: 'GET', match: '/rest/api/content/12345', body: { id: '12345', version: { number: 9 } } },
    { method: 'PUT', match: '/rest/api/content/12345', body: { id: '12345', version: { number: 10 } } }];
  answers.warning = 'Overwrite';
  result = await publishPageCommand(uri('/w/doc.md'));
  assert(result && result.action === 'updated', 'a confirmed overwrite publishes');
  assert(sent.find((r) => r.method === 'PUT').body.version.number === 10, 'the overwrite is the next page version');

  reset();
  disk.set('/w/doc.md', BOUND.replace('  version: 3\n', ''));
  routes = [META];
  result = await publishPageCommand(uri('/w/doc.md'));
  assert(result === undefined && !sent.some((r) => r.method === 'PUT'),
    'a file without a version is not published without asking');
  assert(warnings.length === 1 && /does not record which page version/.test(warnings[0]),
    'the warning explains the missing version, got: ' + warnings[0]);

  reset();
  disk.set('/w/doc.md', BOUND.replace('Body.', '[export.xml](doc.samples/export.xml)'));
  disk.set('/w/doc.samples/export.xml', '<a>1</a>\n');
  routes = [META, UPDATED];
  await publishPageCommand(uri('/w/doc.md'));
  const storage = sent.find((r) => r.method === 'PUT').body.body.storage.value;
  assert(storage.includes('<![CDATA[<a>1</a>]]>') && storage.includes('<ac:parameter ac:name="language">xml</ac:parameter>'),
    'the sample file is published as a code block, got: ' + storage);
  assert(!storage.includes('doc.samples'), 'no link to the local sample file reaches Confluence');

  reset();
  disk.set('/w/doc.md', BOUND);
  routes = [{ method: 'GET', match: '/rest/api/content/12345', status: 401 }];
  let failure = await rejection(() => publishPageCommand(uri('/w/doc.md')));
  assert(failure instanceof Error, 'a Confluence failure rejects the command');
  assert(failure.message === errorMessage(new Error('auth')),
    'the rejection carries the popup text, got: ' + (failure && failure.message));
  assert(!errors.length, 'the popup stays with the interactive path');

  reset();
  failure = await rejection(() => publishPageCommand(uri('/w/missing.md')));
  assert(failure instanceof Error && /^Error: EntryNotFound/.test(failure.message),
    'an unreadable URI rejects through the same wrapping, got: ' + (failure && failure.message));

  reset();
  disk.set('/w/doc.md', BOUND);
  routes = [META, { method: 'PUT', match: '/rest/api/content/12345', body: { version: { number: 4 } } }];
  result = await publishPageCommand(uri('/w/doc.md'));
  assert(result.pageId === '12345', 'the page id falls back to the bound one, got: ' + result.pageId);

  reset();
  const editor = fakeEditor('/w/doc.md', BOUND);
  vscodeStub.window.activeTextEditor = editor;
  routes = [META, UPDATED];
  result = await publishPageCommand();
  assert(result && result.action === 'updated', 'the interactive path still publishes');
  assert(editor.edits === 1 && editor.text.includes('version: 4'), 'the binding is written through the open editor');
  assert(!disk.has('/w/doc.md'), 'the interactive path does not write the file behind the editor');
  assert(info.length === 1 && /version 4/.test(info[0]), 'the interactive path still reports success');

  reset();
  vscodeStub.window.activeTextEditor = fakeEditor('/w/doc.md', BOUND);
  routes = [{ method: 'GET', match: '/rest/api/content/12345', status: 401 }];
  result = await publishPageCommand();
  assert(result === undefined, 'an interactive failure resolves rather than rejecting');
  assert(errors.length === 1 && errors[0] === errorMessage(new Error('auth')),
    'an interactive failure still shows the error popup');

  reset();
  result = await publishPageCommand();
  assert(result === undefined && errors.length === 1 && /Open the Markdown file/.test(errors[0]),
    'without an editor and without a URI the user is told to open a file');

  console.log('PASS: publish command (programmatic URI path, return shape, cancel, failure) ok');
}

main().catch((e) => {
  console.error('FAIL: publish command test threw: ' + (e && e.stack || e));
  process.exit(1);
});
