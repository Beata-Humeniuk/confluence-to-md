const path = require('path');
const assert = (ok, name) => { if (!ok) { console.error('FAIL: ' + name); process.exit(1); } };
const { parseDownloadFolder } = require('../src/downloadFolder');

const HOME = path.sep === '\\' ? 'C:\\Users\\ja' : '/home/ja';

assert(parseDownloadFolder(undefined, HOME).kind === 'current', 'unset setting means current folder');
assert(parseDownloadFolder('', HOME).kind === 'current', 'empty setting means current folder');
assert(parseDownloadFolder('   ', HOME).kind === 'current', 'blank setting means current folder');
assert(parseDownloadFolder('.', HOME).kind === 'current', '"." means current folder');
assert(parseDownloadFolder('./', HOME).kind === 'current', '"./" means current folder');

const design = parseDownloadFolder('docs/confluence', HOME);
assert(design.kind === 'relative' && design.segments.join('/') === 'docs/confluence',
  'relative path split into segments');
assert(parseDownloadFolder('  docs/wiki/  ', HOME).segments.join('/') === 'docs/wiki',
  'surrounding whitespace and trailing slash ignored');
assert(parseDownloadFolder('docs\\confluence', HOME).segments.join('/') === 'docs/confluence',
  'backslashes accepted as separators');
assert(parseDownloadFolder('./docs//confluence', HOME).segments.join('/') === 'docs/confluence',
  'leading "./" and doubled separators dropped');

assert(parseDownloadFolder('/srv/wiki', HOME).kind === 'absolute', 'posix absolute path recognised');
assert(parseDownloadFolder('/srv/wiki', HOME).path === '/srv/wiki', 'posix absolute path kept verbatim');
const win = parseDownloadFolder('C:\\wiki\\confluence', HOME);
assert(win.kind === 'absolute' && win.path === 'C:\\wiki\\confluence', 'windows absolute path recognised');

assert(parseDownloadFolder('~', HOME).kind === 'absolute' && parseDownloadFolder('~', HOME).path === HOME,
  'bare ~ expands to the home directory');
const underHome = parseDownloadFolder('~/wiki', HOME);
assert(underHome.kind === 'absolute' && underHome.path === path.join(HOME, 'wiki'),
  '~/… expands to a path under the home directory');
const noHome = parseDownloadFolder('~/wiki', '');
assert(noHome.kind === 'relative' && noHome.segments.join('/') === '~/wiki',
  'without a home directory ~ is left alone rather than guessed');

console.log('download-folder-test: OK');
