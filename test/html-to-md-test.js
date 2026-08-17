const { convertHtmlToMd } = require('../src/htmlToMd');

const assert = (cond, msg) => { if (!cond) { console.error('FAIL: ' + msg); process.exit(1); } };

const storage = [
  '<h1>Tytu&#322; strony</h1>',
  '<p>Plain <strong>bold text</strong> and <em>italic text</em>, code <code>x &lt; 7</code>.</p>',
  '<ac:structured-macro ac:name="code" ac:schema-version="1">',
  '<ac:parameter ac:name="language">java</ac:parameter>',
  '<ac:plain-text-body><![CDATA[if (a < b) { return "x&y"; }]]></ac:plain-text-body>',
  '</ac:structured-macro>',
  '<ac:structured-macro ac:name="info"><ac:rich-text-body><p>Wa&#380;na notka.</p></ac:rich-text-body></ac:structured-macro>',
  '<table><tbody>',
  '<tr><th>Field</th><th>Description</th></tr>',
  '<tr><td>id</td><td>identifier | key</td></tr>',
  '</tbody></table>',
  '<ul><li>one</li><li>two<ol><li>two-a</li><li>two-b</li></ol></li></ul>',
  '<ac:task-list><ac:task><ac:task-status>complete</ac:task-status><ac:task-body>done</ac:task-body></ac:task>',
  '<ac:task><ac:task-status>incomplete</ac:task-status><ac:task-body>to do</ac:task-body></ac:task></ac:task-list>',
  '<p>See <ac:link><ri:page ri:content-title="Architecture" ri:space-key="DOC"/>',
  '<ac:plain-text-link-body><![CDATA[architecture overview]]></ac:plain-text-link-body></ac:link>',
  ' and <a href="https://example.com">stron&#281; www</a>.</p>',
  '<p><ac:image><ri:attachment ri:filename="diagram.png"/></ac:image></p>',
  '<hr/>',
  '<p>The end.</p>'
].join('\n');

const { markdown: md, links } = convertHtmlToMd(storage);

assert(md.includes('# Tytuł strony'), 'heading + entity decode');
assert(md.includes('**bold text**') && md.includes('*italic text*'), 'inline bold/italic');
assert(md.includes('`x < 7`'), 'inline code with entities decoded');
assert(md.includes('```java') && md.includes('if (a < b) { return "x&y"; }'), 'code macro -> fenced block, CDATA verbatim');
assert(md.includes('> Ważna notka.') && !md.includes('**Info:**'),
  'info panel -> plain blockquote, no label from the extension');
assert(/\| Field\s*\| Description\s*\|/.test(md) && /\|\s*---\s*\|\s*---\s*\|/.test(md), 'table with header row');
assert(md.includes('identifier \\| key'), 'pipes escaped in cells');
assert(/^-\s+one$/m.test(md) && /^-\s+two$/m.test(md) && /^\s+1\.\s+two-a$/m.test(md) && /^\s+2\.\s+two-b$/m.test(md),
  'nested ordered list under unordered');
assert(md.includes('- [x] done') && md.includes('- [ ] to do'), 'task list');
assert(md.includes('[architecture overview](confluence:DOC/Architecture)'),
  'page link rendered with label, space key in pseudo-scheme');
assert(md.includes('[stronę www](https://example.com)'), 'external link');
assert(!md.includes('diagram.png') && !md.includes('!['),
  'a storage image leaves no note behind');
assert(/^---$/m.test(md), 'hr');
assert(!/<[a-z]/.test(md.replace(/```[\s\S]*?```/g, '')), 'no leftover tags outside code blocks');
assert(links.length === 1 && links[0].title === 'Architecture' && links[0].spaceKey === 'DOC',
  'page link collected for follow-up fetch');

const plain = convertHtmlToMd('<p>just text</p>');
assert(plain.markdown.trim() === 'just text', 'simple paragraph');

const exportView = [
  '<h2>Section</h2>',
  '<div class="code panel pdl"><div class="codeContent panelContent pdl">',
  '<pre class="syntaxhighlighter-pre" data-syntaxhighlighter-params="brush: js; gutter: false; theme: Confluence">const a = 1 &lt; 2;</pre>',
  '</div></div>',
  '<div class="confluence-information-macro confluence-information-macro-warning">',
  '<span class="aui-icon aui-icon-small"></span>',
  '<div class="confluence-information-macro-body"><p>Do not do this.</p></div></div>',
  '<ul class="inline-task-list"><li class="checked">done</li><li>to do</li></ul>',
  '<p>See <a href="/wiki/spaces/DOC/pages/123456/Architecture">the architecture</a>',
  ' and <a href="/display/OPS/Runbook">runbook</a>',
  ' plus <a href="/pages/viewpage.action?pageId=777">the old page</a>.</p>',
  '<p><img src="/wiki/download/attachments/1/diagram.png?version=2" alt=""></p>'
].join('\n');

const ev = convertHtmlToMd(exportView);
assert(ev.markdown.includes('## Section'), 'export_view heading');
assert(ev.markdown.includes('```js') && ev.markdown.includes('const a = 1 < 2;'),
  'export_view code panel -> fenced block with brush language');
assert(ev.markdown.includes('> Do not do this.') && !ev.markdown.includes('**Warning:**'),
  'export_view warning panel -> plain blockquote, no label');
assert(ev.markdown.includes('- [x] done') && ev.markdown.includes('- [ ] to do'),
  'export_view inline task list');
assert(ev.markdown.includes('[the architecture](/wiki/spaces/DOC/pages/123456/Architecture)'),
  'export_view page link keeps original href');
assert(!ev.markdown.includes('diagram.png'), 'export_view: a skipped image leaves nothing behind');
assert(ev.links.length === 3, 'all three confluence links collected');
const byId = ev.links.find((l) => l.pageId === '123456');
assert(byId && byId.spaceKey === 'DOC' && byId.title === 'the architecture', 'space link collected with pageId');
const byTitle = ev.links.find((l) => l.spaceKey === 'OPS');
assert(byTitle && byTitle.title === 'Runbook' && !byTitle.pageId, 'display link collected with title');
const legacy = ev.links.find((l) => l.pageId === '777');
assert(legacy && legacy.title === 'the old page', 'viewpage.action link collected with link text as title');

const ORIGIN = 'https://confluence.example.com';
const absolute = [
  '<p><a href="' + ORIGIN + '/pages/viewpage.action?pageId=247434967">linked-page</a>',
  ' and <a href="' + ORIGIN + '/spaces/DOC/pages/259990050/notes">notes</a>',
  ' plus <a href="https://other.example.com/pages/viewpage.action?pageId=1">foreign instance</a>.</p>'
].join('\n');

const withOrigin = convertHtmlToMd(absolute, { origin: ORIGIN });
assert(withOrigin.links.length === 2, 'absolute links to the same instance collected for follow-up fetch');
const first = withOrigin.links.find((l) => l.pageId === '247434967');
assert(first && first.title === 'linked-page', 'title taken from link text when the address carries none');
assert(withOrigin.links.find((l) => l.pageId === '259990050'), 'second absolute link collected');
assert(withOrigin.markdown.includes('](' + ORIGIN + '/pages/viewpage.action?pageId=247434967)'),
  'address in md stays original — only saving to a folder rewrites it to files');

const noOrigin = convertHtmlToMd(absolute);
assert(noOrigin.links.length === 0, 'without a known instance absolute links stay plain links');

const withImages = [
  '<p>Before.</p>',
  '<p><img src="/download/attachments/1/image-2026-5-26_11-27-19.png?version=2" alt=""></p>',
  '<p>After.</p>',
  '<table><tbody><tr><td><img src="/download/attachments/1/icon.png" alt=""></td><td>label</td></tr></tbody></table>'
].join('\n');

const skipped = convertHtmlToMd(withImages).markdown;
assert(!skipped.includes('![') && !skipped.includes('.png'), 'by default nothing remains of an image');
assert(skipped.includes('Before.') && skipped.includes('After.'), 'text around the image stays');
assert(/\|\s*\|\s*label\s*\|/.test(skipped), 'a skipped image leaves an empty cell, not a broken table');

const linked = convertHtmlToMd(withImages, { images: 'link', origin: ORIGIN }).markdown;
assert(linked.includes('![image-2026-5-26_11-27-19.png](' + ORIGIN +
  '/download/attachments/1/image-2026-5-26_11-27-19.png?version=2)'),
  'link mode: attachment address completed with the instance');
assert(convertHtmlToMd('<p><img src="https://example.com/a.png" alt="chart"></p>',
  { images: 'link', origin: ORIGIN }).markdown.includes('![chart](https://example.com/a.png)'),
  'link mode: foreign address and alt stay unchanged');
assert(!convertHtmlToMd('<p><ac:image><ri:attachment ri:filename="diagram.png"/></ac:image></p>',
  { images: 'link' }).markdown.includes('diagram'),
  'link mode: storage format carries no address, so the image vanishes without a note');

const jiraTable = [
  '<table class="wrapped confluenceTable"><colgroup class=""><col class=""><col class=""></colgroup><tbody>',
  '<tr class=""><th class="confluenceTh"><h5 id="US:xId">Requirement version id</h5></th>',
  '<th class="confluenceTh"><h5 id="US:xLink">JIRA link</h5></th></tr>',
  '<tr class=""><td class="confluenceTd"><div class="content-wrapper"><p>',
  '<style>.jira-issue { padding: 0 0 2px; } .jira-issue img { padding-right: 5px; }</style>',
  '<span class="jira-issue" data-jira-key="PROJ-12109">',
  '<a href="https://jira.example.com/browse/PROJ-12109" class="jira-issue-key">',
  '<img class="icon" src="https://jira.example.com/icon.png">PROJ-12109</a>',
  ' - <span class="summary">Custom fields</span>',
  '<span class="jira-status"><span class="aui-lozenge">Done</span></span></span>',
  '</p></div></td>',
  '<td class="confluenceTd"><div class="content-wrapper">',
  '<style type="text/css">.icon { background-position: left center; }</style>',
  '<div id="refresh-module-186557" class="refresh-module-id jira-table"><div class="jira-issues">',
  '<table class="jira-issues"><tbody><tr><th>Key</th><th>Summary</th></tr>',
  '<tr><td><a href="https://jira.example.com/browse/PROJ-8">PROJ-8</a></td><td>Monthly report export</td></tr>',
  '</tbody></table>',
  '<span class="total-issues-count"><a rel="nofollow" href="https://jira.example.com/q">1 issue</a></span>',
  '</div></div></div></td></tr></tbody></table>'
].join('');

const jira = convertHtmlToMd(jiraTable, { origin: 'https://jira.example.com' }).markdown;

assert(!jira.includes('joplin-table-wrapper') && !jira.includes('confluenceTd'),
  'an <h5> heading in a cell no longer dumps the whole table as raw HTML');
assert(!jira.includes('padding-right') && !jira.includes('background-position'),
  'a macro stylesheet does not enter the content as text');
assert(/\| Requirement version id \| JIRA link \|/.test(jira) && /\|\s*---\s*\|\s*---\s*\|/.test(jira),
  'colgroup no longer breaks the header row');
assert(jira.includes('[PROJ-12109](https://jira.example.com/browse/PROJ-12109)'),
  'issue key stays a link');
assert(jira.includes('Custom fields Done') && !jira.includes('fieldsDone'),
  'status does not glue onto the issue title');
assert(jira.includes('[PROJ-8](https://jira.example.com/browse/PROJ-8) — Monthly report export'),
  'issue list from the macro flattened to one line, content kept');
assert(jira.split('\n').filter((l) => l.trim()).length === 3,
  'the whole table fits in three Markdown rows');

assert(!convertHtmlToMd('<p>a</p><script>alert(1)</script><p>b</p>').markdown.includes('alert'),
  'a script on the page does not reach the file');

const tocView = [
  '<div class="toc-macro rbtoc"><ul>',
  '<li><a href="#ApiSpec-Scopeofchanges">Scope of changes</a></li>',
  '<li><a href="#ApiSpec-Za%C5%82%C4%85czniki">Załączniki</a>',
  '<ul><li><a href="#ApiSpec-S%C5%82ownikpoj%C4%99%C4%87">Słownik pojęć</a></li></ul></li>',
  '<li><a href="#ApiSpec-Changehistory">Change history</a></li>',
  '<li><a href="#ApiSpec-Changehistory.1">Change history</a></li>',
  '<li><a href="#ApiSpec-Missingsection">Missing section</a></li>',
  '</ul></div>',
  '<h2>Scope of changes</h2><p>a</p>',
  '<h2>Załączniki</h2><p>b</p>',
  '<h3>Słownik pojęć</h3><p>c</p>',
  '<h2>Change history</h2><p>d</p>',
  '<h2>Change history</h2><p>e</p>',
  '<pre data-code-language="">do not touch [x](#ApiSpec-Scopeofchanges)</pre>'
].join('\n');

const toc = convertHtmlToMd(tocView).markdown;
assert(toc.includes('[Scope of changes](#scope-of-changes)'), 'TOC anchor rewritten to the preview anchor');
assert(toc.includes('[Załączniki](#załączniki)'),
  'non-ASCII characters stay in the anchor (that is how the preview derives it)');
assert(toc.includes('[Słownik pojęć](#słownik-pojęć)'),
  'URL-encoded href anchor matched after decoding');
assert(toc.includes('](#change-history)') && toc.includes('](#change-history-1)'),
  'duplicate heading: Confluence `.1` anchor -> preview `-1`');
assert(toc.includes('#ApiSpec-Missingsection'),
  'a link to a section that does not exist stays unchanged');
assert(toc.includes('do not touch [x](#ApiSpec-Scopeofchanges)'),
  'code block content is not rewritten');

console.log('PASS: html->md converter (storage + export_view) ok');
