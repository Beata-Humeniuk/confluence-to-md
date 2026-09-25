const assert = (ok, name) => { if (!ok) { console.error('FAIL: ' + name); process.exit(1); } };
const MarkdownIt = require('markdown-it');
const { previewButtons, actionLink, fileUriOf } = require('../src/previewButton');

const md = previewButtons(new MarkdownIt({ html: true }),
  { uriScheme: 'vscode', extensionId: 'beatahumeniuk.confluence-to-md' });
const doc = { scheme: 'file', toString: () => 'file:///w/My%20page.md' };
const BOUND = '---\nconfluence:\n  url: https://acme.atlassian.net/wiki/spaces/DOC/pages/12345\n  version: 7\n---\n\n# Title\n\nBody.\n';

let html = md.render(BOUND, { currentDocument: doc });
assert(html.indexOf('<div class="confluence-to-md-actions">') === 0, 'a bound file starts with the buttons, got: ' + html);
assert(html.includes('href="vscode://beatahumeniuk.confluence-to-md/pull?file=file%3A%2F%2F%2Fw%2FMy%2520page.md"'),
  'the pull button links back to the extension with the previewed file');
assert(html.includes('href="vscode://beatahumeniuk.confluence-to-md/push?file=file%3A%2F%2F%2Fw%2FMy%2520page.md"'),
  'the push button links back to the extension with the previewed file');
assert(html.includes('version 7'), 'the tooltip names the local version');
assert(html.includes('<h1>Title</h1>'), 'the page itself still renders');

assert(!md.render('# Title\n\nBody.\n', { currentDocument: doc }).includes('confluence-to-md-actions'),
  'a file without front matter gets no button');
assert(!md.render('---\ntype: note\n---\n\n# Title\n', { currentDocument: doc }).includes('confluence-to-md-actions'),
  'front matter without a confluence binding gets no button');
assert(!md.render(BOUND, {}).includes('confluence-to-md-actions'), 'no button when the preview does not say which file it shows');
assert(!md.render(BOUND, { currentDocument: { scheme: 'untitled', toString: () => 'untitled:Untitled-1' } }).includes('confluence-to-md-actions'),
  'no button for an unsaved document');

const link = actionLink('vscode-insiders', 'a.b', 'pull', 'file:///x/a&b.md');
assert(link === 'vscode-insiders://a.b/pull?file=file%3A%2F%2F%2Fx%2Fa%26b.md', 'the link uses the editor URI scheme');
assert(fileUriOf(link.split('?')[1]) === 'file:///x/a&b.md', 'the file round-trips through the query');
assert(fileUriOf('') === '', 'an empty query names no file');

console.log('preview button: OK');
