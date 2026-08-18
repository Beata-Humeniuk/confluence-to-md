const assert = (cond, msg) => { if (!cond) { console.error('FAIL: ' + msg); process.exit(1); } };
const { parseFrontMatter, serializeFrontMatter } = require('../src/frontMatter');
const { mdToStorage } = require('../src/mdToStorage');
const { parsePageUrl } = require('../src/confluenceClient');

// Test: frontmatter parsing and serialization for programmatic API
const sampleDoc = '---\nconfluence:\n  url: https://example.atlassian.net/wiki/spaces/DOC/pages/12345\n  version: 3\n---\n\n# Hello\n\nContent here.';
const parsed = parseFrontMatter(sampleDoc);
assert(parsed.meta && parsed.meta.url === 'https://example.atlassian.net/wiki/spaces/DOC/pages/12345',
  'existing page meta parsed from document');
assert(parsed.meta.version === 3, 'version preserved as number');
assert(parsed.body.trim() === '# Hello\n\nContent here.', 'body extracted correctly');

// Test: new document without binding
const newDoc = '# My Page\n\nContent.';
const newParsed = parseFrontMatter(newDoc);
assert(newParsed.meta === null, 'undefined meta for new document (needs parent URL)');
assert(newParsed.body === newDoc, 'entire content is body when no frontmatter');

// Test: serialization preserves structure for update
const updateMeta = { url: 'https://example.atlassian.net/wiki/spaces/DOC/pages/12345', version: 4 };
const updateSerialized = serializeFrontMatter(updateMeta, []);
assert(updateSerialized.includes('url: https://example.atlassian.net/wiki/spaces/DOC/pages/12345'),
  'updated page url preserved in frontmatter');
assert(updateSerialized.includes('version: 4'), 'incremented version written');

// Test: serialization for newly created page
const createMeta = { url: 'https://example.atlassian.net/wiki/spaces/DOC/pages/99999', version: 1 };
const createSerialized = serializeFrontMatter(createMeta, ['type: confluence-page']);
assert(createSerialized.includes('url: https://example.atlassian.net/wiki/spaces/DOC/pages/99999'),
  'new page url in frontmatter');
assert(createSerialized.includes('version: 1'), 'initial version for created page');
assert(createSerialized.includes('type: confluence-page'), 'document type preserved');

// Test: roundtrip preserves metadata and extras
const fullDoc = createSerialized + '\n# Title\n\nContent';
const reParsed = parseFrontMatter(fullDoc);
assert(reParsed.meta.url === createMeta.url, 'url roundtrips');
assert(reParsed.meta.version === createMeta.version, 'version roundtrips');
assert(reParsed.extraLines.includes('type: confluence-page'), 'extra metadata preserved');

// Test: markdown conversion for storage format (basic check)
const mdContent = '# Title\n\nA paragraph with **bold** and `code`.';
const storage = mdToStorage(mdContent);
assert(typeof storage === 'string', 'mdToStorage returns string');
assert(storage.includes('<h1>'), 'heading converted to HTML');
assert(storage.includes('<strong>'), 'bold markdown converted');
assert(storage.includes('bold'), 'content preserved in storage format');

// Test: page URL parsing for validation
const pageUrl = 'https://example.atlassian.net/wiki/spaces/DOC/pages/12345/Page+Name';
const parsed_url = parsePageUrl(pageUrl);
assert(parsed_url && parsed_url.pageId === '12345', 'page URL parsed for validation');
assert(parsed_url.spaceKey === 'DOC', 'space key extracted from URL');

console.log('PASS: publish command (API contract for programmatic path) ok');
