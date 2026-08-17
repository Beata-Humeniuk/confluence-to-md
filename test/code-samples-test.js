const { extractLongCodeBlocks, APPENDIX_NOTE } = require('../src/codeSamples');

const assert = (cond, msg) => { if (!cond) { console.error('FAIL: ' + msg); process.exit(1); } };

const block = (n, line) => Array.from({ length: n }, (_, i) => line + i).join('\n');

const long = [
  '# Service description',
  '',
  'Intro.',
  '',
  '## CATALOGUE_EXPORT',
  '',
  '```xml',
  block(120, '<BookRecord>1'),
  '```',
  '',
  'More text.'
].join('\n');

const r = extractLongCodeBlocks(long, 'export.samples');

assert(r.samples.length === 1, 'one block extracted');
assert(r.samples[0].name === 'catalogue-export.xml',
  'file named after the nearest heading, extension from the block language, got: ' + r.samples[0].name);
assert(r.samples[0].content.split('\n').filter(Boolean).length === 120,
  'the file receives the whole block content');
assert(r.samples[0].content.endsWith('\n'), 'the file ends with a newline');
assert(!r.markdown.includes('```'), 'no fence remains in the md after the block');
const sampleLine = r.markdown.split('\n').find((l) => l.includes('.xml'));
assert(sampleLine ===
  '[catalogue-export.xml](export.samples/catalogue-export.xml)',
  'only the link remains in the md, with no note from the extension, got: ' + JSON.stringify(sampleLine));
assert(r.markdown.includes('Intro.') && r.markdown.includes('More text.'),
  'text around the block untouched');

const short = '## Fragment\n\n```json\n' + block(30, 'x') + '\n```\n';
const s = extractLongCodeBlocks(short, 'x.samples');
assert(s.samples.length === 0 && s.markdown === short,
  'a block equal to the threshold stays in the content unchanged');
assert(extractLongCodeBlocks('```json\n' + block(31, 'x') + '\n```\n', 'x.samples').samples.length === 1,
  'one line above the threshold already moves out');

const bold = '**Build_Config**\n\n```xml\n' + block(40, 'a') + '\n```\n';
assert(extractLongCodeBlocks(bold, 'x.samples').samples[0].name === 'build-config.xml',
  'a bold line works like a heading');

const twice = '## Odpowiedź\n\n```xml\n' + block(40, 'a') + '\n```\n\n```xml\n' + block(40, 'b') + '\n```\n';
const t = extractLongCodeBlocks(twice, 'x.samples');
assert(t.samples.length === 2 && t.samples[0].name === 'odpowiedz.xml' &&
  t.samples[1].name === 'odpowiedz-2.xml', 'name collision resolved with a number');

const noHeading = '```\n' + block(40, 'a') + '\n```\n';
const nh = extractLongCodeBlocks(noHeading, 'x.samples');
assert(nh.samples[0].name === 'sample-1.txt',
  'without a heading and language: a numbered name and .txt, got: ' + nh.samples[0].name);

const unclosed = '## A\n\n```xml\n' + block(40, 'a');
assert(extractLongCodeBlocks(unclosed, 'x.samples').markdown === unclosed,
  'an unclosed block stays the text it was');

const tildes = '## A\n\n~~~xml\n' + block(40, 'a') + '\n~~~\n';
assert(extractLongCodeBlocks(tildes, 'x.samples').samples.length === 1,
  'a tilde fence is a block too');

const nested = '## A\n\n````md\n```\n' + block(40, 'a') + '\n```\n````\n';
const ne = extractLongCodeBlocks(nested, 'x.samples');
assert(ne.samples.length === 1 && ne.samples[0].content.includes('```'),
  'a longer fence encloses a shorter one inside, not cut short by it');

const withAppendix = [
  '# Service description',
  '',
  '```json',
  block(5, 'short'),
  '```',
  '',
  '## Additional materials',
  '',
  '### Full response',
  '',
  '```json',
  block(5, 'full'),
  '```'
].join('\n');

const ap = extractLongCodeBlocks(withAppendix, 'x.samples', { appendixHeading: 'Additional materials' });
assert(ap.samples.length === 1 && ap.samples[0].name === 'full-response.json',
  'in the appendix section a block below the threshold moves out too, got: ' + JSON.stringify(ap.samples));
assert(ap.markdown.includes('short0'),
  'a short block before the appendix section stays in the content');
assert(ap.markdown.includes('## Additional materials\n\n' + APPENDIX_NOTE),
  'the agent marker lands under the section heading');

const cased = extractLongCodeBlocks('## MATERIAŁY DODATKOWE\n\n```\n' + block(3, 'a') + '\n```\n',
  'x.samples', { appendixHeading: 'Materiały dodatkowe' });
assert(cased.samples.length === 1, 'the section heading matches case-insensitively');

const boldMarker = extractLongCodeBlocks('**Additional materials**\n\n```\n' + block(3, 'a') + '\n```\n',
  'x.samples', { appendixHeading: 'Additional materials' });
assert(boldMarker.samples.length === 1 && boldMarker.markdown.includes(APPENDIX_NOTE),
  'a bold line opens the appendix section too');

const noAppendix = extractLongCodeBlocks('## Additional materials\n\n```\n' + block(3, 'a') + '\n```\n',
  'x.samples', { appendixHeading: '' });
assert(noAppendix.samples.length === 0 && !noAppendix.markdown.includes('appendix:'),
  'an empty setting disables the section — only the length threshold applies');

const longBeforeAppendix = extractLongCodeBlocks(
  '## Response\n\n```xml\n' + block(40, 'a') + '\n```\n\n## Additional materials\n',
  'x.samples', { appendixHeading: 'Additional materials' });
assert(longBeforeAppendix.samples.length === 1,
  'the length threshold still applies before the appendix section');

console.log('PASS: code samples (long block extraction) ok');
