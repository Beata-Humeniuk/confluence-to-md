const { same, assert } = require('./assert');
const { splitDocument, normalizeBody, sameBody, mergeBody, linkTarget } = require('../src/core/visualDocument');

const bound = '---\nconfluence:\n  url: https://example.atlassian.net/wiki/spaces/DOC/pages/1\n  version: 3\n---\n# Title\n\nText.\n';
const parts = splitDocument(bound);
assert(parts.bound, 'a confluence: block binds the document');
same(parts.head + parts.body, bound, 'head and body rebuild the file');
same(parts.body, '# Title\n\nText.\n', 'the body starts after the front matter');

const plain = splitDocument('# Title\r\n\r\nText.\r\n');
assert(!plain.bound, 'a file without front matter is not bound');
same(plain.head, '', 'no front matter means an empty head');
same(plain.body, '# Title\n\nText.\n', 'the body uses LF line endings');

const other = splitDocument('---\ntitle: Notes\n---\nBody\n');
assert(!other.bound, 'front matter without a confluence: block does not bind');
same(other.head, '---\ntitle: Notes\n---\n', 'any front matter stays out of the visual editor');

same(normalizeBody('Text\n\n\n'), 'Text\n', 'one trailing newline');
same(normalizeBody('Text'), 'Text\n', 'a missing trailing newline is added');
same(normalizeBody('\n\n'), '', 'an empty body stays empty');
assert(sameBody('A\r\nB', 'A\nB\n'), 'line endings and trailing newlines do not count as edits');
assert(!sameBody('A', 'B'), 'different text is an edit');

same(normalizeBody('\n\n# Title\n'), '# Title\n', 'leading blank lines do not count');
same(mergeBody('\n# Old\n', '# New'), '\n# New\n', 'the blank line after the front matter stays');
same(mergeBody('# Old\n', '# New\n'), '# New\n', 'no blank line is added');

same(linkTarget('https://example.com/x').kind, 'external', 'web links open in the browser');
same(linkTarget('mailto:someone@example.com').kind, 'external', 'mail links open outside');
same(linkTarget('confluence:Other%20page').kind, 'confluence', 'confluence: links download the page');
same(linkTarget('/spaces/DOC/pages/1').kind, 'site', 'root-relative links belong to the Confluence site');
same(linkTarget('#section').kind, 'none', 'anchors stay in the editor');
same(linkTarget('javascript:alert(1)').kind, 'none', 'other schemes are ignored');
const file = linkTarget('../steps/step%2001.md#intro');
same(file.kind, 'file', 'relative links open files');
same(file.target, '../steps/step 01.md', 'the file path drops the anchor and is decoded');

console.log('PASS: visual editor document helpers');
