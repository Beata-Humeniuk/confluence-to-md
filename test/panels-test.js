const { assert, same } = require('./assert');
const MarkdownIt = require('markdown-it');
const { convertHtmlToMd } = require('../src/core/htmlToMd');
const { mdToStorage } = require('../src/core/mdToStorage');
const { storageToHtml } = require('../src/core/storageHtml');
const { panels } = require('../src/core/panels');

function exportPanel(kind, title, body) {
  return '<div class="confluence-information-macro confluence-information-macro-' + kind +
    ' conf-macro output-block" data-macro-name="' + kind + '">' +
    (title ? '<p class="title conf-macro-render">' + title + '</p>' : '') +
    '<span class="aui-icon aui-icon-small confluence-information-macro-icon"></span>' +
    '<div class="confluence-information-macro-body"><p>' + body + '</p></div></div>';
}

const md = convertHtmlToMd([
  exportPanel('note', 'Nowy model', 'Należy dodać te pola.'),
  exportPanel('information', '', 'Info text.'),
  exportPanel('tip', '', 'Tip text.'),
  exportPanel('warning', 'Uwaga', 'Error text.')
].join('')).markdown;
assert(md.includes('> [!WARNING] Nowy model\n> Należy dodać te pola.'), 'a Warning panel (note macro) with its title');
assert(md.includes('> [!NOTE]\n> Info text.'), 'an Info panel');
assert(md.includes('> [!TIP]\n> Tip text.'), 'a Success panel (tip macro)');
assert(md.includes('> [!CAUTION] Uwaga\n> Error text.'), 'an Error panel (warning macro)');
assert(!md.includes('class="title"') && md.split('Nowy model').length === 2, 'the title appears once, on the marker line');

const fromStorage = convertHtmlToMd(storageToHtml(
  '<ac:structured-macro ac:name="note"><ac:parameter ac:name="title">T</ac:parameter>' +
  '<ac:rich-text-body><p>Body</p></ac:rich-text-body></ac:structured-macro>')).markdown;
assert(fromStorage.includes('> [!WARNING] T\n> Body'), 'a panel macro from the storage format keeps its type and title');

const published = mdToStorage(md);
assert(published.includes('<ac:structured-macro ac:name="note" ac:schema-version="1">' +
  '<ac:parameter ac:name="title">Nowy model</ac:parameter><ac:rich-text-body>\n<p>Należy dodać te pola.</p>'),
  'publishing turns [!WARNING] back into a note macro with its title');
assert(published.includes('ac:name="info"') && published.includes('ac:name="tip"') && published.includes('ac:name="warning"'),
  'each panel type is published as its macro');
assert(!published.includes('[!') && !published.includes('<blockquote>'), 'no markers or quotes are left');
assert(mdToStorage('> [!IMPORTANT]\n> x\n').includes('ac:name="info"'), 'IMPORTANT, which Confluence lacks, becomes an Info panel');
assert(mdToStorage('> [!NOTE]\n>\n> x\n').includes('<ac:rich-text-body>\n<p>x</p>'), 'a blank line after the marker is fine');
assert(mdToStorage('> plain\n').includes('<blockquote>'), 'a plain quote stays a quote');

const cell = convertHtmlToMd('<table><tbody><tr><th>A</th><th>B</th></tr><tr><td>x</td><td><p>before</p>' +
  exportPanel('note', 'Nowy model', 'inside') + '<p>after</p></td></tr></tbody></table>').markdown;
assert(cell.includes('before<br><br>> [!WARNING] Nowy model<br>> inside<br><br>after'),
  'a panel in a table cell is written as quoted lines in the cell');
const cellBack = mdToStorage(cell);
assert(cellBack.includes('<td><p>before</p><ac:structured-macro ac:name="note" ac:schema-version="1">' +
  '<ac:parameter ac:name="title">Nowy model</ac:parameter><ac:rich-text-body><p>inside</p>' +
  '</ac:rich-text-body></ac:structured-macro><p>after</p></td>'),
  'publishing turns the quoted lines in a cell back into a panel');

const br = mdToStorage('| A |\n| - |\n| one<br>two |\n');
assert(/<td>one<br \/>\n?two<\/td>/.test(br), 'a <br> in a cell is published as a line break, not as text');

const mention = mdToStorage('Ask [@Beata](https://x.atlassian.net/wiki/people/557058:ab-12?ref=confluence).\n');
assert(mention.includes('<ac:link><ri:user ri:account-id="557058:ab-12" /></ac:link>'),
  'a link to a Confluence profile is published as a mention');

const preview = new MarkdownIt().use(panels).render('> [!WARNING] Nowy model\n> text\n');
assert(preview.includes('<div class="confluence-to-md-panel confluence-to-md-panel-warning">') &&
  preview.includes('<p class="confluence-to-md-panel-title">Nowy model</p>') && preview.includes('<p>text</p>'),
  'the Markdown preview shows the panel with its title');
same(new MarkdownIt().use(panels).render('> [!TIP]\n> t\n').match(/panel-title">([^<]*)/)[1], 'Tip',
  'a panel without a title shows its type');

console.log('PASS: Confluence panels');
