const fs = require('fs');
const path = require('path');
const { partPaths, assembleParts } = require('../src/assembleParts');
const { mdToStorage } = require('../src/mdToStorage');
const { parseFrontMatter } = require('../src/frontMatter');

const assert = (cond, msg) => { if (!cond) { console.error('FAIL: ' + msg); process.exit(1); } };

function packageOf(indexPath) {
  const dir = path.dirname(indexPath);
  const body = parseFrontMatter(fs.readFileSync(indexPath, 'utf8')).body;
  const texts = new Map();
  for (const rel of partPaths(body)) {
    const file = path.join(dir, rel);
    texts.set(rel, fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null);
  }
  return assembleParts(body, texts);
}

const EXAMPLES = path.join(__dirname, 'fixtures', 'packages');

const view = packageOf(path.join(EXAMPLES, 'ui', 'add-book', 'add-book.md'));

assert(view.inlined.length === 5, 'view: all five sections inlined, got ' + view.inlined.length);
assert(view.missing.length === 0, 'view: nothing reported missing');
assert(view.markdown.indexOf('(sections/') < 0, 'view: no link to a section file survives');
assert(view.markdown.indexOf('## Contents') < 0, 'view: contents heading goes with its list');
assert(/^# UI: Add book$/m.test(view.markdown), 'view: H1 stays — it is the page title');
assert(view.markdown.indexOf('## 1. Book details') >= 0 &&
  view.markdown.indexOf('## 5. Open questions') >= 0, 'view: sections land in reading order');
assert(view.markdown.indexOf('## 1. Book details') < view.markdown.indexOf('## 2. Loan parameters'),
  'view: order of the index is the order on the page');
assert(view.markdown.indexOf('type: view-design-part') < 0, 'view: part front matter is dropped');
assert(view.markdown.indexOf('| Component | Endpoint | Field |') >= 0, 'view: section content is there');

assert(view.markdown.indexOf('](section-01.md)') < 0, 'view: cross-part link is rewritten');
assert(view.markdown.indexOf('[Genre](#1.%20Book%20details%20(Section))') >= 0,
  'view: link to a section becomes an anchor to its heading');

const viewStorage = mdToStorage(view.markdown);
assert(viewStorage.indexOf('<ac:link ac:anchor="1. Book details (Section)">') >= 0,
  'view: anchor goes out as a native Confluence link');
assert(viewStorage.indexOf('<a href="#') < 0, 'view: no raw anchor href in storage');

const flow = packageOf(path.join(EXAMPLES, 'api', 'books', 'api.md'));

assert(flow.inlined.length === 6, 'flow: every linked part inlined, got ' + flow.inlined.length);
assert(flow.markdown.indexOf('(parts/') < 0, 'flow: no link to a part file survives');
assert(/^## Flow$/m.test(flow.markdown), 'flow: Flow heading stays — it carries the diagram');
assert(flow.markdown.indexOf('```mermaid') >= 0, 'flow: diagram stays');
assert(flow.markdown.indexOf('## Input data (request)') <
  flow.markdown.indexOf('## 1. Request validation'), 'flow: request before the steps');
assert(flow.markdown.indexOf('## Open questions') >
  flow.markdown.indexOf('## Responses'), 'flow: open questions last');

assert(flow.markdown.match(/```mermaid[\s\S]*?```/)[0].indexOf('## ') < 0,
  'flow: nothing inlined inside the fenced diagram');

const readme = [
  '# Installation',
  '',
  '- [Configuration](configuration.md)',
  '- [FAQ](faq.md)'
].join('\n');
const plain = assembleParts(readme, {
  'configuration.md': '# Configuration\n\nContent.\n',
  'faq.md': '---\ntitle: FAQ\n---\n\n# FAQ\n'
});
assert(plain.markdown === readme, 'a list of links to plain files is left alone');
assert(plain.inlined.length === 0, 'nothing inlined without a part front matter');

const part = '---\ntype: view-design-part\nparent: ../index.md\n---\n\n## Section\n\nContent.\n';
const declared = assembleParts('# Title\n\n1. [Section](sections/a.md)\n', { 'sections/a.md': part });
assert(declared.inlined.length === 1, 'a file declaring itself a part is inlined');
assert(declared.markdown.indexOf('## Section') >= 0, 'part content lands in the page');

const byParent = assembleParts('# Title\n\n1. [Section](sections/a.md)\n',
  { 'sections/a.md': '---\nparent: ../index.md\n---\n\n## Section\n' });
assert(byParent.inlined.length === 1, 'parent: alone is enough to call a file a part');

const hole = assembleParts(
  '# Title\n\n## Contents\n\n1. [Present](sections/a.md)\n2. [Missing](sections/b.md)\n',
  { 'sections/a.md': part, 'sections/b.md': null });
assert(hole.inlined.length === 1 && hole.missing.length === 1, 'the unreadable part is reported');
assert(hole.missing[0].path === 'sections/b.md', 'reported by path');
assert(hole.markdown.indexOf('[Missing](sections/b.md)') >= 0, 'the row that could not be filled stays');
assert(/^## Contents$/m.test(hole.markdown), 'heading stays while a row is still under it');

const foreign = assembleParts(
  '# Title\n\n1. [Section](sections/a.md)\n2. [Notes](notes.md)\n',
  { 'sections/a.md': part, 'notes.md': null });
assert(foreign.missing.length === 0, 'a broken link outside the parts directory is not reported');

const twice = assembleParts('# Title\n\n1. [Section](sections/a.md)\n2. [Same one](sections/a.md)\n',
  { 'sections/a.md': part });
assert((twice.markdown.match(/## Section/g) || []).length === 1, 'part inlined once');
assert(twice.markdown.indexOf('[Same one](#Section)') >= 0, 'second link becomes an anchor');

const outside = assembleParts('# Title\n\n1. [Above](../other/file.md)\n2. [Web](https://x/y.md)\n',
  { '../other/file.md': part });
assert(outside.inlined.length === 0, 'a path climbing above the index is not a part of this package');
assert(partPaths('1. [Web](https://example.com/a.md)\n').length === 0, 'absolute links ignored');
assert(partPaths('A sentence with a [link](sections/a.md) inside.\n').length === 0,
  'a link inside a sentence is not a table of contents row');
assert(partPaths('- [Section](sections/a.md) — with extra text\n').length === 0,
  'a row carrying its own text is not a table of contents row');

console.log('PASS: split package assembled into one page ok');
