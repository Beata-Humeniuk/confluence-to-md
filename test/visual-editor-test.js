const { assert, same } = require('./assert');

const listeners = { change: [], willSave: [], didSave: [] };
const commands = [];
const errors = [];
let text = '';
let duringApply = null;

function Uri() {}

function uri(path) {
  return Object.assign(Object.create(Uri.prototype),
    { scheme: 'file', path, fsPath: path, toString: () => 'file://' + path });
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

const document = {
  uri: uri('/w/page.md'),
  isDirty: false,
  saves: 0,
  save: async () => {
    document.saves += 1;
    document.isDirty = false;
    listeners.didSave.forEach((listener) => listener(document));
    return true;
  },
  getText: () => text,
  positionAt: (offset) => offset
};

function setText(next) {
  text = next;
  document.isDirty = true;
  listeners.change.forEach((listener) => listener({ document, contentChanges: [{}] }));
}

function WorkspaceEdit() { this.edits = []; }
WorkspaceEdit.prototype.replace = function (target, range, value) { this.edits.push({ range, value }); };

function applyEdits(edits) {
  let next = text;
  for (const e of edits.slice().sort((a, b) => b.range.start - a.range.start)) {
    next = next.slice(0, e.range.start) + e.value + next.slice(e.range.end);
  }
  setText(next);
}

const event = (list) => (listener) => {
  list.push(listener);
  return { dispose: () => list.splice(list.indexOf(listener), 1) };
};

function TabInputText(target) { this.uri = target; }
const closedTabs = [];
const textTab = { input: null };

const vscodeStub = {
  TabInputText,
  Uri: Object.assign(Uri, { joinPath, parse: (value) => ({ value }) }),
  Range: function Range(start, end) { this.start = start; this.end = end; },
  TextEdit: { replace: (range, value) => ({ range, value }) },
  WorkspaceEdit,
  window: {
    tabGroups: {
      activeTabGroup: { activeTab: textTab },
      close: async (tab) => { closedTabs.push(tab); return true; }
    },
    showErrorMessage: (message) => { errors.push(message); },
    registerCustomEditorProvider: (viewType, provider) => ({ viewType, provider })
  },
  workspace: {
    applyEdit: async (edit) => {
      applyEdits(edit.edits);
      if (duringApply) {
        const typed = duringApply;
        duringApply = null;
        typed();
      }
      return true;
    },
    getWorkspaceFolder: () => ({ uri: uri('/w') }),
    onDidChangeTextDocument: event(listeners.change),
    onWillSaveTextDocument: event(listeners.willSave),
    onDidSaveTextDocument: event(listeners.didSave)
  },
  env: {
    clipboard: { readText: async () => 'copied *text*' },
    openExternal: async (target) => { commands.push(['openExternal', target.value]); } },
  commands: { executeCommand: async (...args) => { commands.push(args); } }
};

const Module = require('module');
const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  return request === 'vscode' ? 'vscode' : resolve.call(this, request, ...rest);
};
require.cache.vscode = { id: 'vscode', filename: 'vscode', loaded: true, exports: vscodeStub, children: [], paths: [] };

const path = require('path');
const { registerVisualEditor, openVisualEditorCommand } = require('../src/editor/visualEditor');

const extensionUri = uri(path.join(__dirname, '..'));
const { viewType, provider } = registerVisualEditor({ extensionUri });
same(viewType, 'confluenceToMd.visualEditor', 'the custom editor is registered under its view type');

const posted = [];
const states = [];
let receive = null;
let dispose = null;
const panel = {
  webview: {
    cspSource: 'vscode-resource:',
    asWebviewUri: (target) => 'webview:' + target.path,
    postMessage: async (message) => {
      if (message.type === 'state') states.push(message.dirty);
      else posted.push(message);
      return true;
    },
    onDidReceiveMessage: (listener) => {
      receive = listener;
      return { dispose: () => {} };
    }
  },
  onDidDispose: (listener) => { dispose = listener; }
};

const tick = () => new Promise((done) => setTimeout(done, 0));

(async () => {
  const HEAD = '---\nconfluence:\n  url: https://example.atlassian.net/wiki/spaces/DOC/pages/1\n  version: 3\n---\n';
  text = HEAD + '\n# Title\n\nText.\n';
  provider.resolveCustomTextEditor(document, panel);

  const html = panel.webview.html;
  assert(/script-src vscode-resource:(;|")/.test(html), 'scripts load only from the extension');
  assert(/<script id="vditorIconScript" src="[^"]*\/dist\/js\/icons\/ant\.js"><\/script>/.test(html),
    'the toolbar icons are loaded by the page, not by a synchronous request');
  assert(!/unsafe-eval|script-src[^;]*unsafe-inline/.test(html), 'no inline or eval scripts are allowed');
  assert(html.includes('data-link-base="webview:/w/"'), 'relative images resolve against the file folder');

  await receive({ type: 'loaded' });
  same(posted.length, 1, 'the webview gets the document once it has loaded');
  same(posted[0].type, 'init', 'the first message initializes the editor');
  same(posted[0].body, '# Title\n\nText.\n', 'the webview sees the body without the front matter');
  assert(posted[0].bound, 'the webview knows the file is bound to Confluence');

  await receive({ type: 'edit', body: '# Title\n\nNew text.' });
  await tick();
  same(text, HEAD + '\n# Title\n\nNew text.\n', 'an edit replaces only the body and keeps the front matter');
  same(posted.length, 1, 'the echo of an edit is not sent back to the webview');

  setText(HEAD + '\n# Title\n\nChanged on disk.\n');
  same(posted.length, 2, 'a change from outside reaches the webview');
  same(posted[1].type, 'update', 'an outside change updates the editor');
  same(posted[1].body, '# Title\n\nChanged on disk.\n', 'the update carries the new body');

  receive({ type: 'edit', body: 'First' });
  receive({ type: 'edit', body: 'Second' });
  await tick();
  await tick();
  same(text, HEAD + '\nSecond\n', 'quick edits are written in order');
  same(posted.length, 2, 'intermediate states of quick edits are not echoed back');

  setText('# Unbound\n');
  same(posted[2].type, 'init', 'losing the binding re-creates the editor with other buttons');
  assert(!posted[2].bound, 'the webview knows the file is no longer bound');

  const waits = [];
  listeners.willSave.forEach((listener) => listener({ document, waitUntil: (p) => waits.push(p) }));
  same(posted[3].type, 'flush', 'saving asks the webview for its latest text');
  await receive({ type: 'edit', body: '# Unbound\n\nTyped just before saving.', flush: true });
  const saveEdits = await waits[0];
  same(saveEdits.length, 1, 'the latest text is saved');
  applyEdits(saveEdits);
  same(text, '# Unbound\n\nTyped just before saving.\n', 'the save includes the last keystrokes');
  same(posted.length, 4, 'the saved text is not echoed back');
  posted.length = 0;

  const quiet = [];
  listeners.willSave.forEach((listener) => listener({ document, waitUntil: (p) => quiet.push(p) }));
  await receive({ type: 'edit', body: null, flush: true });
  same((await quiet[0]).length, 0, 'saving without typing in the visual editor leaves the file as it is');

  duringApply = () => setText('# Typed in the text editor\n');
  receive({ type: 'edit', body: 'Queued' });
  await tick();
  await tick();
  same(posted[posted.length - 1].type, 'update', 'a change made while edits were queued still reaches the webview');
  same(posted[posted.length - 1].body, '# Typed in the text editor\n', 'the webview gets the text typed meanwhile');

  await receive({ type: 'command', name: 'source' });
  same(commands.pop()[2], 'default', 'the source button reopens the file in the text editor');
  await receive({ type: 'openLink', href: 'steps/step%201.md#top' });
  same(commands.pop()[1].path, '/w/steps/step 1.md', 'a relative link opens the linked file');
  await receive({ type: 'openLink', href: 'https://example.com/' });
  same(commands.pop()[1], 'https://example.com/', 'a web link opens in the browser');

  same(states[states.length - 1], true, 'the webview knows the file has unsaved changes');
  await receive({ type: 'command', name: 'save' });
  same(document.saves, 1, 'the Save button saves the file');
  same(states[states.length - 1], false, 'after saving the webview shows the file as saved');

  posted.length = 0;
  await receive({ type: 'pastePlain' });
  same(JSON.stringify(posted), JSON.stringify([{ type: 'pasteText', text: 'copied *text*' }]),
    'Ctrl+Shift+V gets the clipboard text from VS Code');

  commands.length = 0;
  textTab.input = new TabInputText(document.uri);
  await openVisualEditorCommand(document.uri);
  same(commands[0][2], 'confluenceToMd.visualEditor', 'the command opens the visual editor');
  same(closedTabs[0], textTab, 'the visual editor replaces the text editor tab instead of opening a second one');
  textTab.input = new TabInputText(uri('/w/other.md'));
  await openVisualEditorCommand(document.uri);
  same(closedTabs.length, 1, 'a tab of another file is left open');

  dispose();
  same(listeners.change.length + listeners.willSave.length + listeners.didSave.length, 0,
    'closing the editor stops listening');
  same(errors.length, 0, 'no errors: ' + errors.join('; '));
  console.log('PASS: visual editor keeps the file and the webview in sync');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
