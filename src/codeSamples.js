const { slugify } = require('./mdDocument');

const LONG_BLOCK_LINES = 30;

const FENCE = /^(`{3,}|~{3,})(.*)$/;

const APPENDIX_NOTE = '<!-- appendix: full-length reference examples, extracted to separate files;' +
  ' open them only when the examples in the main content are not enough -->';

const EXTENSIONS = {
  xml: 'xml', html: 'html', json: 'json', yaml: 'yaml', yml: 'yaml',
  sql: 'sql', java: 'java', js: 'js', javascript: 'js', ts: 'ts',
  typescript: 'ts', python: 'py', py: 'py', sh: 'sh', bash: 'sh'
};

const SAMPLE_LINK = /^\[[^\]]*\]\(([^()\s]+\.samples\/[^()\s]+)\)\s*$/;

function extensionFor(lang) {
  return EXTENSIONS[String(lang).trim().toLowerCase()] || 'txt';
}

function headingText(line) {
  const hash = line.match(/^#{1,6}\s+(.+?)\s*#*$/);
  if (hash) return hash[1];
  const bold = line.match(/^\*\*(.+?)\*\*$/);
  return bold ? bold[1] : null;
}

function sampleName(heading, lang, index, taken) {
  const base = heading ? slugify(heading) : 'sample-' + index;
  const ext = extensionFor(lang);
  let name = base + '.' + ext;
  let n = 2;
  while (taken.has(name)) name = base + '-' + (n++) + '.' + ext;
  taken.add(name);
  return name;
}

function extractLongCodeBlocks(markdown, folderName, options) {
  const opts = options || {};
  const max = typeof opts.limit === 'number' ? opts.limit : LONG_BLOCK_LINES;
  const appendix = String(opts.appendixHeading || '').trim().toLowerCase();
  const lines = String(markdown).split('\n');
  const out = [];
  const samples = [];
  const taken = new Set();
  let heading = null;
  let inAppendix = false;

  for (let i = 0; i < lines.length; i++) {
    const open = lines[i].match(FENCE);
    if (!open) {
      const h = headingText(lines[i]);
      if (h) heading = h;
      out.push(lines[i]);
      if (h && appendix && !inAppendix && h.trim().toLowerCase() === appendix) {
        inAppendix = true;
        out.push('', APPENDIX_NOTE);
      }
      continue;
    }

    const marker = open[1];
    const lang = open[2].trim().split(/\s+/)[0] || '';
    const body = [];
    let j = i + 1;
    for (; j < lines.length; j++) {
      const close = lines[j].match(FENCE);
      if (close && close[1][0] === marker[0] && close[1].length >= marker.length &&
        !close[2].trim()) break;
    }
    if (j >= lines.length) {
      out.push(lines[i]);
      continue;
    }
    for (let k = i + 1; k < j; k++) body.push(lines[k]);

    if (lang.toLowerCase() === 'mermaid' || (!inAppendix && body.length <= max)) {
      for (let k = i; k <= j; k++) out.push(lines[k]);
      i = j;
      continue;
    }

    const name = sampleName(heading, lang, samples.length + 1, taken);
    samples.push({ name, content: body.join('\n') + '\n' });
    out.push('[' + name + '](' + folderName + '/' + name + ')');
    i = j;
  }

  return { markdown: out.join('\n'), samples };
}

function samplePathOf(line) {
  const link = line.match(SAMPLE_LINK);
  if (!link) return null;
  try {
    return decodeURIComponent(link[1]);
  } catch (e) {
    return link[1];
  }
}

function sampleLinkPaths(markdown) {
  return String(markdown).split('\n').map(samplePathOf).filter(Boolean);
}

function fenceFor(content) {
  const longest = (content.match(/`+/g) || []).reduce((n, run) => Math.max(n, run.length), 0);
  return '`'.repeat(Math.max(3, longest + 1));
}

function languageOf(path) {
  const ext = path.split('.').pop().toLowerCase();
  return ext === 'txt' ? '' : ext;
}

function inlineSamples(markdown, contents) {
  return String(markdown).split('\n').map((line) => {
    const path = samplePathOf(line);
    const content = path && contents.get(path);
    if (typeof content !== 'string') return line;
    const fence = fenceFor(content);
    return fence + languageOf(path) + '\n' + content.replace(/\n$/, '') + '\n' + fence;
  }).join('\n');
}

module.exports = {
  extractLongCodeBlocks, sampleLinkPaths, inlineSamples, LONG_BLOCK_LINES, APPENDIX_NOTE
};
