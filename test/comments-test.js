const { mdToStorage } = require('../src/core/mdToStorage');
const { convertHtmlToMd } = require('../src/core/htmlToMd');
const { assert } = require('./assert');

const md = '| Field | Map | Note |\n|---|---|---|\n' +
  '| prd | 1 | <!-- AI: IGNORE THIS SECTION --> TODO: update a & <b> <!-- AI: END IGNORE --> |\n\n' +
  'Text <!-- hidden --> stays, `<!-- in code -->` too.\n\n<!-- a block\nover two lines -->\n\nAfter.\n\n' +
  '```\n<!-- fenced -->\n```\n';
const storage = mdToStorage(md);

assert(storage.includes('<td><ac:placeholder>AI: IGNORE THIS SECTION</ac:placeholder> TODO: update a &amp; &lt;b&gt; ' +
  '<ac:placeholder>AI: END IGNORE</ac:placeholder></td>'),
  'a comment in a cell is instruction text, the note next to it is page text, got: ' + storage);
assert(storage.includes('<p>Text <ac:placeholder>hidden</ac:placeholder> stays'), 'an inline comment is instruction text');
assert(storage.includes('<p><ac:placeholder>a block\nover two lines</ac:placeholder></p>'), 'a comment block is instruction text');

assert(storage.includes('<code>&lt;!-- in code --&gt;</code>'), 'a comment in inline code is kept as text');
assert(storage.includes('<![CDATA[<!-- fenced -->]]>'), 'a comment in a code block is kept as written');

// Confluence renders instruction text as nothing, so the client renders the
// storage again with markers and puts the comments back.
const sent = [];
global.fetch = async (url, options) => {
  const method = (options && options.method) || 'GET';
  const body = options && options.body ? JSON.parse(options.body) : null;
  sent.push({ method, url, body });
  const json = method === 'GET'
    ? { id: '42', title: 'P', space: { key: 'DOC' }, version: { number: 3 },
      body: { export_view: { value: '<p>view</p>' }, storage: { value: storage } } }
    : { value: body.value.replace(/<ac:structured-macro[\s\S]*?<\/ac:structured-macro>/g, '<pre>&lt;!-- fenced --&gt;</pre>'),
      representation: 'export_view' };
  return { ok: true, status: 200, url, json: async () => json };
};

const { fetchPageById } = require('../src/core/confluenceClient');
const site = { origin: 'https://c.example.com', basePath: '', cloud: false };

(async () => {
  const page = await fetchPageById({ token: 'T', email: '' }, site, '42');
  assert(sent[1] && sent[1].url.includes('/contentbody/convert/export_view'), 'storage rendered again for the comments');
  assert(!sent[1].body.value.includes('ac:placeholder'), 'comments sent as markers');
  const out = convertHtmlToMd(page.html).markdown;
  assert(out.includes('| 1   | <!-- AI: IGNORE THIS SECTION --> TODO: update a & \\<b> <!-- AI: END IGNORE --> |'),
    'the comments come back in the cell around the note, got:\n' + out);
  assert(out.includes('Text <!-- hidden --> stays'), 'an inline comment comes back');
  assert(out.includes('<!-- a block\nover two lines -->'), 'a comment block comes back with its line breaks');

  global.fetch = async (url) => ({ ok: true, status: 200, url,
    json: async () => ({ id: '7', body: { export_view: { value: '<p>plain</p>' }, storage: { value: '<p>plain</p>' } } }) });
  const plain = await fetchPageById({ token: 'T', email: '' }, site, '7');
  assert(plain.html === '<p>plain</p>', 'a page without comments is not rendered again');

  console.log('PASS: HTML comments are published as instruction text and pulled back');
})().catch((e) => { console.error('FAIL: ' + e.stack); process.exit(1); });
