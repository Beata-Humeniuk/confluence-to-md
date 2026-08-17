const assert = (ok, name) => { if (!ok) { console.error('FAIL: ' + name); process.exit(1); } };
const { slugify, rewriteConfluenceLinks, detectDocType } = require('../src/mdDocument');
const { parseFrontMatter, serializeFrontMatter } = require('../src/frontMatter');

assert(slugify('Contract signing process') === 'contract-signing-process', 'slug from title');
assert(slugify('Załącznik: żółć — 100%') === 'zalacznik-zolc-100', 'slug strips diacritics and symbols');
assert(slugify('???') === 'page', 'slug fallback for empty result');

const slugs = new Map([['Słownik pojęć', 'slownik-pojec']]);
const body = 'See [glossary](confluence:S%C5%82ownik%20poj%C4%99%C4%87) and [another page](confluence:Other%20page).';
const rewritten = rewriteConfluenceLinks(body, slugs);
assert(rewritten.includes('[glossary](./slownik-pojec.md)'), 'fetched page link rewritten to relative md');
assert(rewritten.includes('[another page](confluence:Other%20page)'), 'unfetched page link left as-is');

const ORIGIN = 'https://confluence.example.com';
const byId = new Map([['247434967', 'linked-page']]);
const urls = [
  'See [the service](' + ORIGIN + '/pages/viewpage.action?pageId=247434967)',
  'and [the same one differently](/spaces/DOC/pages/247434967/linked-page)',
  'and [not fetched](' + ORIGIN + '/pages/viewpage.action?pageId=999)',
  'and [foreign](https://other.example.com/pages/viewpage.action?pageId=247434967)',
  'and [plain](https://example.com/article).'
].join(' ');
const linked = rewriteConfluenceLinks(urls, new Map(), { slugById: byId, origin: ORIGIN });
assert(linked.includes('[the service](./linked-page.md)'),
  'absolute link to a downloaded page becomes a file next to it');
assert(linked.includes('[the same one differently](./linked-page.md)'),
  'the same page in another URL shape resolves to the same file');
assert(linked.includes('[not fetched](' + ORIGIN + '/pages/viewpage.action?pageId=999)'),
  'a page that was not downloaded keeps its Confluence address');
assert(linked.includes('[foreign](https://other.example.com/pages/viewpage.action?pageId=247434967)'),
  'same page id on another instance is not the same page');
assert(linked.includes('[plain](https://example.com/article)'), 'external link untouched');

const titled = rewriteConfluenceLinks('[runbook](/display/OPS/Production+runbook)',
  new Map([['Production runbook', 'production-runbook']]), { origin: ORIGIN });
assert(titled === '[runbook](./production-runbook.md)', 'display link matched by page title');

const treePaths = new Map([['247434967', 'catalogue/books']]);
const fromRoot = rewriteConfluenceLinks('[books](' + ORIGIN + '/pages/viewpage.action?pageId=247434967)',
  new Map(), { slugById: treePaths, origin: ORIGIN });
assert(fromRoot === '[books](./catalogue/books.md)',
  'link from the folder root descends into the subfolder, got: ' + fromRoot);
const fromSibling = rewriteConfluenceLinks('[books](' + ORIGIN + '/pages/viewpage.action?pageId=247434967)',
  new Map(), { slugById: treePaths, origin: ORIGIN, fromDir: 'catalogue' });
assert(fromSibling === '[books](./books.md)',
  'link from the same subfolder stays neighbourly, got: ' + fromSibling);
const fromElsewhere = rewriteConfluenceLinks('[books](' + ORIGIN + '/pages/viewpage.action?pageId=247434967)',
  new Map(), { slugById: treePaths, origin: ORIGIN, fromDir: 'other/place' });
assert(fromElsewhere === '[books](../../catalogue/books.md)',
  'link from another subfolder climbs through .., got: ' + fromElsewhere);

const bound = '---\nconfluence:\n  url: ' + ORIGIN + '/pages/viewpage.action?pageId=247434967\n  version: 9\n---\n' +
  '[nearby](./slownik-pojec.md)\n';
assert(rewriteConfluenceLinks(bound, new Map(), { slugById: byId, origin: ORIGIN }) === bound,
  'front matter url and relative file links left alone');

const viewBullet = '- **Name** (`Input`) — required\n';
assert(detectDocType('## 1. View structure\n' + viewBullet, 'Anything') === 'view-design',
  'view design detected by its English section');
assert(detectDocType('# UI: Antrag\n## 1. Struktur der Ansicht\n' + viewBullet, 'UI: Antrag') === 'view-design',
  'view design detected when the section texts were configured to another language');
assert(detectDocType('## 1. View structure\n', 'Anything') === 'confluence-page',
  'a heading alone is not a view design without component rows');
assert(detectDocType('## 1. Struktur der Ansicht\n' + viewBullet, 'Anything') === 'confluence-page',
  'component rows alone, with no recognisable heading, are not enough');
assert(detectDocType('## Field mappings\n', '') === 'field-mapping', 'field mapping detected by section');
assert(detectDocType('## Data model\n## Endpoints\n', '') === 'contract', 'contract detected by sections');
assert(detectDocType('Plain text', 'Note') === 'confluence-page', 'plain page falls back');

const extras = ['type: view-design', 'generator: confluence-to-md@0.6.0', 'managed: true'];
const doc = serializeFrontMatter({ url: 'https://example.atlassian.net/wiki/x/1', version: 7 }, extras) +
  '\n# Title\n\nContent.';
const parsed = parseFrontMatter(doc);
assert(parsed.meta && parsed.meta.url === 'https://example.atlassian.net/wiki/x/1' && parsed.meta.version === 7,
  'confluence binding parsed back');
assert(parsed.extraLines.join('\n') === extras.join('\n'), 'descriptive keys kept apart from the binding');
const republished = serializeFrontMatter({ url: parsed.meta.url, version: 8 }, parsed.extraLines);
assert(republished.includes('version: 8') && republished.includes('type: view-design'),
  'version bump preserves the descriptive keys');

console.log('PASS: md document (slug, links, doc type, frontmatter roundtrip) ok');
