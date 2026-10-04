const { mdToStorage } = require('../src/mdToStorage');
const { convertHtmlToMd } = require('../src/htmlToMd');
const { hasMermaid, mermaidPlaceholders, restoreMermaid } = require('../src/mermaid');

const { assert } = require('./assert');

const diagram = 'flowchart TD\n  A["Start & <go>"] -->|yes| B[End]';
const md = 'Intro\n\n```mermaid\n' + diagram + '\n```\n\n```js\nlet a = 1;\n```\n';

const published = mdToStorage(md, { mermaidMacro: 'mermaid-macro' });
assert(published.includes('<ac:structured-macro ac:name="mermaid-macro" ac:schema-version="1">' +
  '<ac:plain-text-body><![CDATA[' + diagram + ']]></ac:plain-text-body></ac:structured-macro>'),
  'mermaid block published as the configured macro with the source as-is');
assert(published.includes('ac:name="code"') && published.includes('let a = 1;'), 'other code blocks stay code macros');

const plain = mdToStorage(md);
assert(!plain.includes('mermaid-macro') && plain.includes('<ac:parameter ac:name="language">mermaid</ac:parameter>'),
  'without a macro name mermaid stays a code macro');
assert(mdToStorage(md, { mermaidMacro: 'custom' }).includes('ac:name="custom"'), 'macro name is configurable');

assert(hasMermaid(published) && !hasMermaid(plain), 'mermaid macro detected in storage');
const marked = mermaidPlaceholders('<p>a</p>' + published);
assert(marked.sources.length === 1 && marked.sources[0] === diagram, 'diagram source extracted from CDATA');
assert(!marked.storage.includes('mermaid-macro') && marked.storage.includes('<p>CTMDMERMAID0X</p>'),
  'macro replaced with a placeholder');

const escaped = mermaidPlaceholders('<ac:structured-macro ac:name="mermaid"><ac:plain-text-body>' +
  'graph LR\nA --&gt; B</ac:plain-text-body></ac:structured-macro>');
assert(escaped.sources[0] === 'graph LR\nA --> B', 'source without CDATA is decoded');

const view = '<p>Intro</p><p class="auto-cursor-target">CTMDMERMAID0X</p><pre>let a = 1;</pre>';
const restored = restoreMermaid(view, marked.sources);
const out = convertHtmlToMd(restored).markdown;
assert(out.includes('```mermaid\n' + diagram + '\n```'), 'rendered page converts back to a mermaid block:\n' + out);

const direct = convertHtmlToMd('<p>x</p>' + published).markdown;
assert(direct.includes('```mermaid\n' + diagram + '\n```'), 'unrendered mermaid macro converts to a mermaid block:\n' + direct);

// Client: a page with a Mermaid macro is rendered again with placeholders.
const sent = [];
global.fetch = async (url, options) => {
  const method = (options && options.method) || 'GET';
  const body = options && options.body ? JSON.parse(options.body) : null;
  sent.push({ method, url, body });
  let json;
  if (method === 'GET') {
    json = {
      id: '42', title: 'P', space: { key: 'DOC' }, version: { number: 3 },
      body: { export_view: { value: '<p>Intro</p><div class="mermaid-rendered"><svg></svg></div>' }, storage: { value: '<p>Intro</p>' + published } }
    };
  } else {
    json = { value: '<p>Intro</p><p>CTMDMERMAID0X</p>', representation: 'export_view' };
  }
  return { ok: true, status: 200, url, json: async () => json };
};

const { fetchPageById } = require('../src/confluenceClient');
const site = { origin: 'https://c.example.com', basePath: '', cloud: false };

(async () => {
  const page = await fetchPageById({ token: 'T', email: '' }, site, '42');
  assert(sent[0].url.includes('body.storage'), 'storage requested with the page');
  assert(sent[1] && sent[1].method === 'POST' && sent[1].url.includes('/rest/api/contentbody/convert/export_view?contentIdContext=42'),
    'storage with placeholders converted by Confluence');
  assert(sent[1].body.representation === 'storage' && !sent[1].body.value.includes('mermaid-macro'), 'placeholders sent');
  assert(convertHtmlToMd(page.html).markdown.includes('```mermaid\n' + diagram + '\n```'), 'downloaded page has a mermaid block');

  global.fetch = async (url, options) => {
    if (options && options.method === 'POST') return { ok: false, status: 500, url, json: async () => ({}) };
    return { ok: true, status: 200, url, json: async () => ({ id: '42', body: { export_view: { value: '<p>view</p>' }, storage: { value: published } } }) };
  };
  const fallback = await fetchPageById({ token: 'T', email: '' }, site, '42');
  assert(fallback.html === '<p>view</p>', 'failed conversion keeps export_view');

  console.log('PASS: mermaid diagrams (publish, download, fallback) ok');
})().catch((e) => { console.error('FAIL: ' + e.stack); process.exit(1); });
