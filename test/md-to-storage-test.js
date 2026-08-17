const { mdToStorage } = require('../src/mdToStorage');
const { convertHtmlToMd } = require('../src/htmlToMd');
const { parseFrontMatter, serializeFrontMatter } = require('../src/frontMatter');

const assert = (cond, msg) => { if (!cond) { console.error('FAIL: ' + msg); process.exit(1); } };

const md = [
  '## Main section',
  '',
  'A paragraph with **bold**, *italics*, ~~strikethrough~~ and `code x < 7`.',
  '',
  '```java',
  'if (a < b) { return "x&y"; } // ]]> in code too',
  '```',
  '',
  '| Field | Description |',
  '| --- | --- |',
  '| id | identifier \\| key |',
  '',
  '- one',
  '- two',
  '  1. two-a',
  '',
  'Tasks:',
  '',
  '- [x] done',
  '- [ ] to do',
  '',
  '[link](https://example.com) and [architecture](confluence:DOC/Architecture)',
  'plus a bare https://example.atlassian.net/wiki/spaces/DOC/pages/99 pasted from the address bar',
  '',
  '---',
  '',
  'The end.'
].join('\n');

const storage = mdToStorage(md);

assert(storage.includes('<h2>Main section</h2>'), 'heading -> h2');
assert(storage.includes('<strong>bold</strong>') && storage.includes('<em>italics</em>'),
  'bold/italic -> strong/em');
assert(storage.includes('<s>strikethrough</s>'), 'strikethrough -> s');
assert(storage.includes('<code>code x &lt; 7</code>'), 'inline code escaped');
assert(storage.includes('ac:name="code"') &&
  storage.includes('<ac:parameter ac:name="language">java</ac:parameter>'),
  'fenced block -> code macro with language');
assert(storage.includes('<![CDATA[if (a < b) { return "x&y"; } // ]]]]><![CDATA[> in code too]]>'),
  'code content in CDATA, ]]> split safely');
assert(storage.includes('<table>') && storage.includes('<th>Field</th>') &&
  storage.includes('<td>identifier | key</td>'), 'table with header and unescaped pipe');
assert(storage.includes('<ol>') && storage.includes('<li>two-a</li>'), 'nested ordered list');
assert(storage.includes('<ac:task-list>') &&
  storage.includes('<ac:task-status>complete</ac:task-status><ac:task-body>done</ac:task-body>') &&
  storage.includes('<ac:task-status>incomplete</ac:task-status><ac:task-body>to do</ac:task-body>'),
  'task list -> ac:task-list');
assert(storage.includes('<a href="https://example.com">link</a>'), 'link kept');
assert(storage.includes('<ac:link><ri:page ri:content-title="Architecture" ri:space-key="DOC" />' +
  '<ac:link-body>architecture</ac:link-body></ac:link>'),
  'confluence: pseudo-link -> native ac:link with space key');
assert(storage.includes('<a href="https://example.atlassian.net/wiki/spaces/DOC/pages/99">' +
  'https://example.atlassian.net/wiki/spaces/DOC/pages/99</a>'),
  'bare pasted URL becomes a link (linkify)');
assert(storage.includes('<hr />'), 'hr self-closed (XHTML)');
assert(!storage.includes('[x]') && !storage.includes('[ ]'), 'no leftover task markers');

const back = convertHtmlToMd(storage).markdown;
assert(back.includes('## Main section'), 'roundtrip: heading preserved');
assert(back.includes('```java') && back.includes('if (a < b) { return "x&y"; } // ]]> in code too'),
  'roundtrip: code block with language and content preserved verbatim');
assert(back.includes('**bold**') && back.includes('`code x < 7`'), 'roundtrip: inline formatting');
assert(back.includes('- [x] done') && back.includes('- [ ] to do'), 'roundtrip: task list');
assert(back.includes('identifier \\| key'), 'roundtrip: table cell');
assert(back.includes('[architecture](confluence:DOC/Architecture)'),
  'roundtrip: confluence page link preserved with space key');

const fm = serializeFrontMatter({ url: 'https://acme.atlassian.net/wiki/spaces/DOC/pages/123', version: 7 });
const doc = fm + '\n# Title\n\nContent.\n';
const parsed = parseFrontMatter(doc);
assert(parsed.meta && parsed.meta.url === 'https://acme.atlassian.net/wiki/spaces/DOC/pages/123' &&
  parsed.meta.version === 7, 'front matter roundtrip');
assert(parsed.body.indexOf('# Title') === 1, 'front matter stripped from body');
assert(doc.slice(0, parsed.rawLength) === fm, 'rawLength covers exactly the front matter block');
assert(parseFrontMatter('# Plain file\n').meta === null, 'no front matter -> meta null');

const own = '---\ntype: view-analysis\nmanaged: true\n---\n\n# UI: Login\n\nContent.\n';
const foreign = parseFrontMatter(own);
assert(foreign.meta === null, 'front matter without a confluence block -> no binding');
assert(foreign.body.indexOf('# UI: Login') === 1, 'its keys do not land in the published body');
assert(own.slice(0, foreign.rawLength) === '---\ntype: view-analysis\nmanaged: true\n---\n',
  'rawLength covers the whole block, so publishing replaces it instead of stacking on it');
assert(serializeFrontMatter({ url: 'https://acme.atlassian.net/wiki/spaces/DOC/pages/5', version: 1 },
  foreign.extraLines) === '---\nconfluence:\n  url: https://acme.atlassian.net/wiki/spaces/DOC/pages/5\n' +
  '  version: 1\ntype: view-analysis\nmanaged: true\n---\n',
  'binding is merged into the block the file already had');

const anchored = mdToStorage('[Country](#1.%20Book%20details)\n');
assert(anchored.includes('<ac:link ac:anchor="1. Book details">' +
  '<ac:link-body>Country</ac:link-body></ac:link>'), 'in-page anchor -> ac:link with ac:anchor');
assert(!anchored.includes('<a href="#'), 'no raw anchor href left');

console.log('PASS: md->storage converter + front matter ok');
