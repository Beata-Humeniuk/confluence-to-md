const assert = (ok, name) => { if (!ok) { console.error('FAIL: ' + name); process.exit(1); } };
const { errorMessage } = require('../src/messages');

// A VS Code stub, just enough to drive publishCommand end to end: an in-memory
// disk, recorded popups, and answers the prompts hand back.
const disk = new Map();
const sent = [];
const info = [];
const errors = [];
const answers = { input: undefined, warning: undefined };
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
  Uri: { file: uri, joinPath },
  Range: function Range(start, end) { this.start = start; this.end = end; },
  ProgressLocation: { Notification: 15 },
  window: {
    activeTextEditor: null,
    showInformationMessage: (message) => { info.push(message); },
    showErrorMessage: (message) => { errors.push(message); },
    showWarningMessage: async () => answers.warning,
    showInputBox: async () => answers.input,
    withProgress: (options, task) => task()
  },
  workspace: {
    textDocuments: [],
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
  commands: { executeCommand: async () => {} },
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
  return { ok: status >= 200 && status < 300, status, url, json: async () => (route && route.body) || {} };
};

const { publishPageCommand } = require('../src/publishCommand');

function reset() {
  disk.clear();
  sent.length = 0;
  info.length = 0;
  errors.length = 0;
  routes = [];
  answers.input = undefined;
  answers.warning = undefined;
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
  // A caller hands us a URI: the file is published straight from disk, with no
  // editor open on it at all.
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

  // The active editor belongs to another file and must not be touched.
  reset();
  disk.set('/w/doc.md', BOUND);
  const bystander = fakeEditor('/w/other.md', '# Something else\n');
  vscodeStub.window.activeTextEditor = bystander;
  routes = [META, UPDATED];
  await publishPageCommand(uri('/w/doc.md'));
  assert(bystander.edits === 0 && bystander.text === '# Something else\n',
    'publishing by URI leaves the active editor alone');

  // No binding yet: the parent page is asked for and the new binding lands in
  // the file the caller pointed at.
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

  // A split document is assembled into one page on the URI path too.
  reset();
  disk.set('/w/pkg/api.md', '---\nconfluence:\n  url: ' + PAGE_URL + '\n  version: 3\n---\n\n# API\n\n## Steps\n\n- [Validation](parts/step-01.md)\n');
  disk.set('/w/pkg/parts/step-01.md', '---\ntype: api-part\n---\n\n## Validation\n\nCheck the payload.\n');
  routes = [META, UPDATED];
  result = await publishPageCommand(uri('/w/pkg/api.md'));
  assert(result && result.action === 'updated', 'a split document publishes by URI');
  assert(sent.find((r) => r.method === 'PUT').body.body.storage.value.includes('Check the payload.'),
    'the part is inlined into the page that is sent');
  assert(info.length === 1 && /1 part from the package/.test(info[0]),
    'the assembled page is reported, got: ' + info[0]);

  // Cancelling a prompt is not a failure: the command resolves to undefined and
  // nothing is published.
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

  // A failure rejects with the message the interactive path would have shown.
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

  // Confluence does not always echo the page in the update response.
  reset();
  disk.set('/w/doc.md', BOUND);
  routes = [META, { method: 'PUT', match: '/rest/api/content/12345', body: { version: { number: 4 } } }];
  result = await publishPageCommand(uri('/w/doc.md'));
  assert(result.pageId === '12345', 'the page id falls back to the bound one, got: ' + result.pageId);

  // The interactive path is unchanged: it edits the open document and keeps its
  // own popups.
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
