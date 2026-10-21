const { assert, same } = require('./assert');
const MarkdownIt = require('markdown-it');
const { convertHtmlToMd } = require('../src/core/htmlToMd');
const { mdToStorage } = require('../src/core/mdToStorage');
const { tableSpans } = require('../src/core/tableSpans');

const storage = [
  '<table><colgroup><col /><col /><col /></colgroup><tbody>',
  '<tr><th>Name</th><th>Status</th><th>Notes</th></tr>',
  '<tr><td colspan="2"><p>Both columns</p></td><td><p>x</p></td></tr>',
  '<tr><td rowspan="2"><p>Two rows</p></td><td><p style="text-align: center;">mid</p></td><td><p>y</p></td></tr>',
  '<tr><td><p style="text-align: center;">c</p></td><td><p>z</p></td></tr>',
  '</tbody></table>'
].join('');

const md = convertHtmlToMd(storage).markdown;
const lines = md.trim().split('\n').map((line) => line.replace(/\s+/g, ' '));
same(lines[1], '| --- | :---: | --- |', 'a column whose cells are centered is centered in Markdown');
same(lines[2], '| Both columns | << | x |', 'a cell merged across columns marks the covered cell with <<');
same(lines[3], '| Two rows | mid | y |', 'the row with a tall cell keeps its cells in place');
same(lines[4], '| ^^ | c | z |', 'a cell merged across rows marks the covered cell with ^^');

const back = mdToStorage(md);
assert(back.includes('<td colspan="2">Both columns</td>'), 'publishing turns << back into colspan');
assert(back.includes('<td rowspan="2">Two rows</td>'), 'publishing turns ^^ back into rowspan');
assert(!/<td>(?:&lt;&lt;|\^\^)<\/td>/.test(back), 'the markers are not published as text');
assert(back.includes('<td><p style="text-align: center;">mid</p></td>'),
  'an aligned column is published the way Confluence aligns cells');
same((back.match(/<td/g) || []).length, 7, 'only the real cells are published');

const block = mdToStorage('| A | B | C |\n| - | - | - |\n| big | << | 1 |\n| ^^ | << | 2 |\n');
assert(block.includes('<td colspan="2" rowspan="2">big</td>'), 'a block over two rows and columns');
same((block.match(/<td/g) || []).length, 3, 'a block keeps one cell for each merged area');

const header = mdToStorage('| A | B |\n| - | - |\n| ^^ | 1 |\n');
assert(header.includes('<td>^^</td>'), 'a body cell cannot merge into the header row');
const edge = mdToStorage('| A | B |\n| - | - |\n| << | 1 |\n');
assert(edge.includes('<td>&lt;&lt;</td>'), 'a marker with nothing to merge into stays text');
const ragged = mdToStorage('| A | B | C |\n| - | - | - |\n| a | << | 1 |\n| ^^ | 2 | 3 |\n');
assert(!/colspan|rowspan/.test(ragged), 'markers that do not form a rectangle are left as text');

const preview = new MarkdownIt().use(tableSpans).render('| A | B |\n| - | - |\n| wide | << |\n');
assert(preview.includes('<td colspan="2">wide</td>'), 'the Markdown preview shows merged cells');

const mixed = convertHtmlToMd('<table><tbody><tr><th>A</th></tr><tr><td><p style="text-align: right;">1</p><p>2</p></td></tr></tbody></table>').markdown;
assert(/\| --- \|/.test(mixed), 'a cell with paragraphs aligned differently is not aligned');

console.log('PASS: merged and aligned table cells');
