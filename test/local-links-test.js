const { assert } = require('./assert');
const { mdLinkTargets, linkLocalPages } = require('../src/core/localLinks');

const MD = [
  'See [Account](services/account.md), [Data](./personal%20data.md#section) and [Old](<../My page.md>).',
  'Also [site](https://example.com/readme.md), [root](/abs.md), ![pic](img.md) and [Account again](services/account.md).',
  '```',
  '[in code](code.md)',
  '```',
  '[Gone](missing.md)'
].join('\n');

const targets = mdLinkTargets(MD);
assert(targets.join('|') === 'services/account.md|./personal data.md|../My page.md|missing.md',
  'local Markdown links are collected once, decoded, outside code, got: ' + targets.join('|'));

const urls = new Map([
  ['services/account.md', 'https://acme.atlassian.net/wiki/spaces/DOC/pages/1'],
  ['./personal data.md', 'https://acme.atlassian.net/wiki/spaces/DOC/pages/2'],
  ['../My page.md', 'https://acme.atlassian.net/wiki/spaces/DOC/pages/3'],
  ['missing.md', null]
]);
const out = linkLocalPages(MD, urls);
assert(out.includes('[Account](https://acme.atlassian.net/wiki/spaces/DOC/pages/1)') &&
  out.includes('[Account again](https://acme.atlassian.net/wiki/spaces/DOC/pages/1)'),
  'a link to a bound file points at its Confluence page');
assert(out.includes('[Data](https://acme.atlassian.net/wiki/spaces/DOC/pages/2)'), 'an encoded link with an anchor is resolved');
assert(out.includes('[Old](https://acme.atlassian.net/wiki/spaces/DOC/pages/3)'), 'an angle-bracket link is resolved');
assert(out.includes('[site](https://example.com/readme.md)') && out.includes('[root](/abs.md)') && out.includes('![pic](img.md)'),
  'external links, absolute paths and images are left alone');
assert(out.includes('[in code](code.md)'), 'code blocks are left alone');
assert(/\nGone$/.test(out), 'a link to a file that is not on Confluence keeps only its text');

console.log('PASS: local Markdown links resolved to Confluence pages');
