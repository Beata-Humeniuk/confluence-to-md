const MarkdownIt = require('markdown-it');
const { convertHtmlToMd } = require('../src/core/htmlToMd');
const { mdToStorage } = require('../src/core/mdToStorage');
const { tocMacro } = require('../src/core/tocMacro');
const { assert, same } = require('./assert');

const EXPAND = (title) => '<ac:structured-macro ac:name="expand" ac:schema-version="1">' +
  (title ? '<ac:parameter ac:name="title">' + title + '</ac:parameter>' : '') + '<ac:rich-text-body>\n';
const END = '</ac:rich-text-body></ac:structured-macro>';
const TOC = '<ac:structured-macro ac:name="toc" ac:schema-version="1" />';

// Pulling: the page's HTML (export_view), as Confluence renders the macros.
const view = [
  '<div class="toc-macro client-side-toc-macro conf-macro output-block" data-hasbody="false" data-macro-name="toc"> </div>',
  '<h2>Section</h2>',
  '<div id="expander-1" class="expand-container">',
  '<div id="expander-control-1" class="expand-control"><span class="expand-icon aui-icon">&nbsp;</span>',
  '<span class="expand-control-text">Details &amp; more</span></div>',
  '<div id="expander-content-1" class="expand-content expand-hidden"><p>Hidden <strong>text</strong></p>',
  '<div class="expand-container"><div class="expand-control"><span class="expand-control-text">Inner</span></div>',
  '<div class="expand-content"><ul><li>a</li></ul></div></div>',
  '</div></div>',
  '<p>After</p>'
].join('\n');

same(convertHtmlToMd(view).markdown, [
  '[toc]',
  '',
  '## Section',
  '',
  '<details>',
  '<summary>Details &amp; more</summary>',
  '',
  'Hidden **text**',
  '',
  '<details>',
  '<summary>Inner</summary>',
  '',
  '-   a',
  '',
  '</details>',
  '',
  '</details>',
  '',
  'After',
  ''
].join('\n'), 'an expand is pulled as <details> and an empty table of contents as [toc]');

assert(convertHtmlToMd('<div class="toc-macro rbtoc1"><ul><li><a href="#P-A">A</a></li></ul></div><h2>A</h2>')
  .markdown.startsWith('[toc]\n\n## A'), 'a table of contents with its list is pulled as [toc]');

assert(convertHtmlToMd('<details><summary>Plain</summary><p>x</p></details>').markdown
  .startsWith('<details>\n<summary>Plain</summary>\n\nx\n\n</details>'), 'HTML <details> is pulled as it is');

const cell = convertHtmlToMd('<table><tbody><tr><td><div class="expand-container"><div class="expand-control">' +
  '<span class="expand-control-text">In a cell</span></div><div class="expand-content"><p>x</p></div></div></td>' +
  '<td><div class="toc-macro"></div></td></tr></tbody></table>').markdown;
assert(cell.includes('| **In a cell**<br>x | [toc] |'), 'in a cell, an expand is its title and text\n' + cell);

// Pulling from storage, which the page's HTML may still hold.
same(convertHtmlToMd('<ac:structured-macro ac:name="toc" ac:schema-version="1">' +
  '<ac:parameter ac:name="maxLevel">2</ac:parameter></ac:structured-macro>' +
  '<ac:structured-macro ac:name="expand"><ac:parameter ac:name="title">T</ac:parameter><ac:rich-text-body>' +
  '<ac:structured-macro ac:name="info"><ac:rich-text-body><p>i</p></ac:rich-text-body></ac:structured-macro>' +
  '<p>p</p></ac:rich-text-body></ac:structured-macro>').markdown,
'[toc]\n\n<details>\n<summary>T</summary>\n\n> [!NOTE]\n> i\n\np\n\n</details>\n', 'macros in storage');

// Publishing.
same(mdToStorage('[toc]\n\n## A\n\n<details>\n<summary>Details &amp; more</summary>\n\nHidden **text**\n\n' +
  '<details>\n<summary>Inner</summary>\n\n- a\n\n</details>\n\n</details>\n\nAfter'),
TOC + '\n<h2>A</h2>\n' + EXPAND('Details &amp; more') + '<p>Hidden <strong>text</strong></p>\n' +
  EXPAND('Inner') + '<ul>\n<li>a</li>\n</ul>\n' + END + '\n' + END + '\n<p>After</p>',
'[toc] and <details> are published as the toc and expand macros');

same(mdToStorage('<details><summary>Same line</summary>\n\ntext\n</details>'),
  EXPAND('Same line') + '<p>text</p>\n' + END, 'summary on the line of <details>, and </details> after text');
same(mdToStorage('<details>\n\nno title\n\n</details>'), EXPAND('') + '<p>no title</p>\n' + END,
  'an expand without a title');
same(mdToStorage('</details>\n\nstray'), '<p>stray</p>', 'a </details> without its <details> is left out');
same(mdToStorage('<details>\n<summary>Open</summary>\n\ntext'), EXPAND('Open') + '<p>text</p>\n' + END,
  'an expand left open is closed at the end of the page');
same(mdToStorage('> <details>\n> <summary>Q</summary>\n>\n> q\n\n</details>'),
  '<blockquote>\n' + EXPAND('Q') + '<p>q</p>\n' + END + '\n</blockquote>',
  'an expand closes in the block it opened in');
assert(mdToStorage('```\n<details>\n[toc]\n```').includes('<![CDATA[<details>\n[toc]]]>'), 'code keeps both as written');
assert(mdToStorage('[TOC]') === TOC, '[TOC] in capitals');
same(mdToStorage('text [toc] text\n\n`[toc]`'), '<p>text [toc] text</p>\n<p><code>[toc]</code></p>',
  '[toc] inside text or code stays text');
assert(mdToStorage('| a |\n| --- |\n| [toc] |').includes('<td>' + TOC + '</td>'), '[toc] alone in a cell');

// Round trip: pulled Markdown publishes the same macros.
const round = mdToStorage(convertHtmlToMd(view).markdown);
assert(round.startsWith(TOC) && round.split('ac:name="expand"').length === 3, 'round trip keeps the macros');

// The Markdown preview lists the headings in place of [toc].
const preview = tocMacro(new MarkdownIt()).render('[toc]\n\n# Główny\n\n## A `b`\n\n### C\n\n## A b\n');
assert(preview.startsWith('<div class="confluence-to-md-toc"><ul><li><a href="#główny">Główny</a>' +
  '<ul><li><a href="#a-b">A b</a><ul><li><a href="#c">C</a></li></ul></li><li><a href="#a-b-1">A b</a></li>' +
  '</ul></li></ul></div>'), 'the preview lists the headings\n' + preview);

console.log('PASS: expand and table of contents macros');
