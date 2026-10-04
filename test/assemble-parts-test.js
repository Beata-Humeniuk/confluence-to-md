const fs = require('fs');
const path = require('path');
const { assert } = require('./assert');
const { partPaths, assembleParts } = require('../src/core/assembleParts');
const { mdToStorage } = require('../src/core/mdToStorage');
const { parseFrontMatter } = require('../src/core/frontMatter');

function assembled(indexPath) {
  const dir = path.dirname(indexPath);
  const body = parseFrontMatter(fs.readFileSync(indexPath, 'utf8')).body;
  const texts = new Map();
  for (const rel of partPaths(body)) {
    const file = path.join(dir, rel);
    texts.set(rel, fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null);
  }
  return assembleParts(body, texts);
}

const FIXTURES = path.join(__dirname, 'fixtures');

const handbook = assembled(path.join(FIXTURES, 'handbook', 'handbook.md'));

assert(handbook.inlined.length === 5, 'handbook: all five sections inlined, got ' + handbook.inlined.length);
assert(handbook.missing.length === 0, 'handbook: nothing reported missing');
assert(handbook.markdown.indexOf('(sections/') < 0, 'handbook: no link to a section file survives');
assert(handbook.markdown.indexOf('## Contents') < 0, 'handbook: contents heading goes with its list');
assert(/^# Handbook: Getting started$/m.test(handbook.markdown), 'handbook: H1 stays — it is the page title');
assert(handbook.markdown.indexOf('## 1. Installation') >= 0 &&
  handbook.markdown.indexOf('## 5. Open questions') >= 0, 'handbook: sections land in reading order');
assert(handbook.markdown.indexOf('## 1. Installation') < handbook.markdown.indexOf('## 2. Configuration'),
  'handbook: order of the index is the order on the page');
assert(handbook.markdown.indexOf('type: handbook-part') < 0, 'handbook: part front matter is dropped');
assert(handbook.markdown.indexOf('| Step | Command | Expected | Notes |') >= 0, 'handbook: section content is there');

assert(handbook.markdown.indexOf('](section-01.md)') < 0, 'handbook: cross-part link is rewritten');
assert(handbook.markdown.indexOf('[Sign in](#1.%20Installation%20(Chapter))') >= 0,
  'handbook: link to a section becomes an anchor to its heading');

const handbookStorage = mdToStorage(handbook.markdown);
assert(handbookStorage.indexOf('<ac:link ac:anchor="1. Installation (Chapter)">') >= 0,
  'handbook: anchor goes out as a native Confluence link');
assert(handbookStorage.indexOf('<a href="#') < 0, 'handbook: no raw anchor href in storage');

const runbook = assembled(path.join(FIXTURES, 'runbook', 'deploy.md'));

assert(runbook.inlined.length === 6, 'runbook: every linked step inlined, got ' + runbook.inlined.length);
assert(runbook.markdown.indexOf('(steps/') < 0, 'runbook: no link to a step file survives');
assert(/^## Flow$/m.test(runbook.markdown), 'runbook: Flow heading stays — it carries the diagram');
assert(runbook.markdown.indexOf('```mermaid') >= 0, 'runbook: diagram stays');
assert(runbook.markdown.indexOf('## Before you start') <
  runbook.markdown.indexOf('## 1. Freeze'), 'runbook: preparation before the steps');
assert(runbook.markdown.indexOf('## Open questions') >
  runbook.markdown.indexOf('## Rollback'), 'runbook: open questions last');

assert(runbook.markdown.match(/```mermaid[\s\S]*?```/)[0].indexOf('## ') < 0,
  'runbook: nothing inlined inside the fenced diagram');

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

const part = '---\ntype: guide-part\nparent: ../index.md\n---\n\n## Section\n\nContent.\n';
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
assert(outside.inlined.length === 0, 'a path climbing above the index is not a part of this document');
assert(partPaths('1. [Web](https://example.com/a.md)\n').length === 0, 'absolute links ignored');
assert(partPaths('A sentence with a [link](sections/a.md) inside.\n').length === 0,
  'a link inside a sentence is not a table of contents row');
assert(partPaths('- [Section](sections/a.md) — with extra text\n').length === 0,
  'a row carrying its own text is not a table of contents row');

console.log('PASS: split document assembled into one page ok');
