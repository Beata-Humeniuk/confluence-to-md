const assert = (ok, name) => { if (!ok) { console.error('FAIL: ' + name); process.exit(1); } };
const { pageRefOfHref } = require('../src/pageLink');

const ORIGIN = 'https://confluence.example.com';

const pseudo = pageRefOfHref('confluence:DOC/System%20architecture');
assert(pseudo && pseudo.spaceKey === 'DOC' && pseudo.title === 'System architecture' && !pseudo.pageId,
  'confluence: pseudo-link yields the key and a decoded title');
assert(pageRefOfHref('confluence:Bare%20page').title === 'Bare page', 'confluence: without a space key');

assert(pageRefOfHref('/wiki/spaces/DOC/pages/123456/Title').pageId === '123456', '/spaces/…/pages/ID path');
assert(pageRefOfHref('/wiki/spaces/DOC/pages/123456/Title').spaceKey === 'DOC', 'space key from the path');
assert(pageRefOfHref('/pages/viewpage.action?pageId=777').pageId === '777', 'viewpage.action?pageId=ID');
assert(pageRefOfHref('/display/OPS/Production+runbook').title === 'Production runbook',
  '/display/KEY/Title with pluses as spaces');
assert(pageRefOfHref('/pages/999/anything').pageId === '999', 'any path with a page number');

const abs = pageRefOfHref(ORIGIN + '/pages/viewpage.action?pageId=247434967', ORIGIN);
assert(abs && abs.pageId === '247434967', 'absolute link to the same instance recognised');
assert(pageRefOfHref(ORIGIN + '/spaces/DOC/pages/247434967/page', ORIGIN).pageId === '247434967',
  'absolute link in the new Server/DC format');
assert(pageRefOfHref(ORIGIN + '/confluence/display/OPS/Runbook', ORIGIN).title === 'Runbook',
  'absolute link with a context path');
assert(pageRefOfHref('https://other.example.com/pages/viewpage.action?pageId=1', ORIGIN) === null,
  'a link to another instance is a plain external link');
assert(pageRefOfHref(ORIGIN + '/pages/viewpage.action?pageId=1') === null,
  'without a known instance an absolute link is not guessed at');
assert(pageRefOfHref(ORIGIN + ':8443/pages/viewpage.action?pageId=1', ORIGIN) === null,
  'a different port is a different instance');
assert(pageRefOfHref('https://confluence.example.com:8443/pages/viewpage.action?pageId=5',
  'https://confluence.example.com:8443').pageId === '5', 'non-standard port on both sides');

assert(pageRefOfHref('https://example.com/article', ORIGIN) === null, 'plain external link');
assert(pageRefOfHref(ORIGIN + '/download/attachments/1/file.pdf', ORIGIN) === null, 'an attachment is not a page');
assert(pageRefOfHref('./another-page.md', ORIGIN) === null, 'a link to a file nearby stays unchanged');
assert(pageRefOfHref('#section', ORIGIN) === null, 'an anchor in the same document');
assert(pageRefOfHref('', ORIGIN) === null && pageRefOfHref(null, ORIGIN) === null, 'empty href');

console.log('PASS: page link parsing (relative, absolute, pseudo-scheme) ok');
