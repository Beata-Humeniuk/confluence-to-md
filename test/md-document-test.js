const { assert } = require('./assert');
const { slugify, rewriteConfluenceLinks, titleHeading } = require('../src/core/mdDocument');
const { parseFrontMatter, serializeFrontMatter } = require('../src/core/frontMatter');

assert(slugify('Contract signing process') === 'contract-signing-process', 'slug from title');
assert(slugify('Załącznik: żółć — 100%') === 'zalacznik-zolc-100', 'slug strips diacritics and symbols');
assert(slugify('???') === 'page', 'slug fallback for empty result');

const slugs = new Map([['Słownik pojęć', 'slownik-pojec']]);
const body = 'See [glossary](confluence:S%C5%82ownik%20poj%C4%99%C4%87) and [another page](confluence:Other%20page).';
const rewritten = rewriteConfluenceLinks(body, slugs);
assert(rewritten.includes('[glossary](./slownik-pojec.md)'), 'fetched page link rewritten to relative md');
assert(rewritten.includes('[another page](confluence:Other%20page)'), 'unfetched page link left as-is');

const ORIGIN = 'https://confluence.example.com';
const byId = new Map([['1001', 'linked-page']]);
const urls = [
  'See [the service](' + ORIGIN + '/pages/viewpage.action?pageId=1001)',
  'and [the same one differently](/spaces/DOC/pages/1001/linked-page)',
  'and [not fetched](' + ORIGIN + '/pages/viewpage.action?pageId=999)',
  'and [foreign](https://other.example.com/pages/viewpage.action?pageId=1001)',
  'and [plain](https://example.com/article).'
].join(' ');
const linked = rewriteConfluenceLinks(urls, new Map(), { slugById: byId, origin: ORIGIN });
assert(linked.includes('[the service](./linked-page.md)'),
  'absolute link to a downloaded page becomes a file next to it');
assert(linked.includes('[the same one differently](./linked-page.md)'),
  'the same page in another URL shape resolves to the same file');
assert(linked.includes('[not fetched](' + ORIGIN + '/pages/viewpage.action?pageId=999)'),
  'a page that was not downloaded keeps its Confluence address');
assert(linked.includes('[foreign](https://other.example.com/pages/viewpage.action?pageId=1001)'),
  'same page id on another instance is not the same page');
assert(linked.includes('[plain](https://example.com/article)'), 'external link untouched');

const titled = rewriteConfluenceLinks('[runbook](/display/OPS/Production+runbook)',
  new Map([['Production runbook', 'production-runbook']]), { origin: ORIGIN });
assert(titled === '[runbook](./production-runbook.md)', 'display link matched by page title');

const treePaths = new Map([['1001', 'catalogue/books']]);
const fromRoot = rewriteConfluenceLinks('[books](' + ORIGIN + '/pages/viewpage.action?pageId=1001)',
  new Map(), { slugById: treePaths, origin: ORIGIN });
assert(fromRoot === '[books](./catalogue/books.md)',
  'link from the folder root descends into the subfolder, got: ' + fromRoot);
const fromSibling = rewriteConfluenceLinks('[books](' + ORIGIN + '/pages/viewpage.action?pageId=1001)',
  new Map(), { slugById: treePaths, origin: ORIGIN, fromDir: 'catalogue' });
assert(fromSibling === '[books](./books.md)',
  'link from the same subfolder stays neighbourly, got: ' + fromSibling);
const fromElsewhere = rewriteConfluenceLinks('[books](' + ORIGIN + '/pages/viewpage.action?pageId=1001)',
  new Map(), { slugById: treePaths, origin: ORIGIN, fromDir: 'other/place' });
assert(fromElsewhere === '[books](../../catalogue/books.md)',
  'link from another subfolder climbs through .., got: ' + fromElsewhere);

const bound = '---\nconfluence:\n  url: ' + ORIGIN + '/pages/viewpage.action?pageId=1001\n  version: 9\n---\n' +
  '[nearby](./slownik-pojec.md)\n';
assert(rewriteConfluenceLinks(bound, new Map(), { slugById: byId, origin: ORIGIN }) === bound,
  'front matter url and relative file links left alone');

const heading = titleHeading('Intro\n\n# The title  \n\nBody\n');
assert(heading && heading.title === 'The title', 'the first H1 is the title, trailing spaces dropped');
assert('Intro\n\n# The title  \n\nBody\n'.slice(heading.start, heading.end) === '# The title  \n',
  'the offsets cover exactly the heading line');
const fencedFirst = titleHeading('```sh\n# not a title\n```\n# Title\n');
assert(fencedFirst && fencedFirst.title === 'Title', 'a # line inside a code block is skipped, got: ' + (fencedFirst && fencedFirst.title));
assert(titleHeading('~~~\n# code\n~~~\n') === null, 'no heading outside code means no title');
assert(titleHeading('# Windows\r\nBody\r\n').title === 'Windows', 'CRLF line endings do not reach the title');
assert(titleHeading('## Not top level\n#NoSpace\n') === null, 'only a level-one heading with a space counts');

const extras = ['type: confluence-page', 'generator: confluence-to-md@0.6.0', 'space: DOC'];
const doc = serializeFrontMatter({ url: 'https://example.atlassian.net/wiki/x/1', version: 7 }, extras) +
  '\n# Title\n\nContent.';
const parsed = parseFrontMatter(doc);
assert(parsed.meta && parsed.meta.url === 'https://example.atlassian.net/wiki/x/1' && parsed.meta.version === 7,
  'confluence binding parsed back');
assert(parsed.extraLines.join('\n') === extras.join('\n'), 'descriptive keys kept apart from the binding');
const republished = serializeFrontMatter({ url: parsed.meta.url, version: 8 }, parsed.extraLines);
assert(republished.includes('version: 8') && republished.includes('space: DOC'),
  'version bump preserves the descriptive keys');

console.log('PASS: md document (slug, links, title, frontmatter roundtrip) ok');
