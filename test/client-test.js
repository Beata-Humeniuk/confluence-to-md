const { parsePageUrl, isCloud, authFor, authHeader, apiRoot } = require('../src/confluenceClient');

const assert = (cond, msg) => { if (!cond) { console.error('FAIL: ' + msg); process.exit(1); } };

const cloud = parsePageUrl('https://acme.atlassian.net/wiki/spaces/DOC/pages/123456/My+Page?focused=true');
assert(cloud && cloud.pageId === '123456' && cloud.spaceKey === 'DOC', 'cloud link parsed');
assert(cloud.site.origin === 'https://acme.atlassian.net' && cloud.site.basePath === '/wiki' && isCloud(cloud.site),
  'cloud site derived from link');
assert(apiRoot(cloud.site) === 'https://acme.atlassian.net/wiki/rest/api', 'cloud api root');

const other = parsePageUrl('https://anothercompany.atlassian.net/wiki/spaces/X/pages/1/A');
assert(other.site.origin === 'https://anothercompany.atlassian.net', 'second instance works without any configuration');

const byId = parsePageUrl('https://confluence.acme.com/pages/viewpage.action?pageId=98765');
assert(byId && byId.pageId === '98765' && !isCloud(byId.site), 'server pageId link parsed');
assert(apiRoot(byId.site) === 'https://confluence.acme.com/rest/api', 'server api root');

const ctx = parsePageUrl('https://intranet.acme.com/confluence/pages/viewpage.action?pageId=42');
assert(ctx.pageId === '42' && apiRoot(ctx.site) === 'https://intranet.acme.com/confluence/rest/api',
  'context path (/confluence) taken from the link');

const byTitle = parsePageUrl('https://confluence.acme.com/display/DOC/My+test+page');
assert(byTitle && byTitle.spaceKey === 'DOC' && byTitle.title === 'My test page',
  'server display link parsed (plus -> spaces)');

const ctxTitle = parsePageUrl('https://intranet.acme.com/wiki/display/DOC/Tytu%C5%82');
assert(ctxTitle.title === 'Tytuł' && apiRoot(ctxTitle.site) === 'https://intranet.acme.com/wiki/rest/api',
  'display link with context path and percent-encoded non-ASCII characters');

const bare = parsePageUrl('https://docs.example.com:8443/pages/777/Anything');
assert(bare && bare.pageId === '777' && bare.site.origin === 'https://docs.example.com:8443',
  'generic /pages/ID on any host and port');

const tiny = parsePageUrl('https://acme.atlassian.net/wiki/x/AbCdEf');
assert(tiny && tiny.tinyUrl && tiny.site.basePath === '/wiki', 'tiny /x/ link recognized for expansion');

assert(parsePageUrl('https://example.com/anything') === null, 'link without a page rejected');
assert(parsePageUrl('not-a-url') === null, 'garbage rejected');

const basic = authHeader({ email: 'a@b.com', token: 'T' });
assert(basic.startsWith('Basic ') && Buffer.from(basic.slice(6), 'base64').toString() === 'a@b.com:T',
  'cloud -> Basic email:token');
assert(authHeader({ email: '', token: 'T' }) === 'Bearer T', 'server -> Bearer PAT');

assert(authHeader(authFor(byId.site, 'PAT', 'a@b.com')) === 'Bearer PAT',
  'server/DC ignores configured email — PAT always sent as Bearer');
assert(authHeader(authFor(cloud.site, 'T', 'a@b.com')).startsWith('Basic '),
  'cloud with email -> Basic email:token');
assert(authHeader(authFor(cloud.site, 'T', '')) === 'Bearer T',
  'cloud without email -> Bearer (OAuth-style token)');

console.log('PASS: confluence client (url parsing, auth) ok');
