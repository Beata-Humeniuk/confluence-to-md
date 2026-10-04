const QUOTED_LABELS_BEFORE = [10, 3, 1];

const NODE_SHAPES = [
  ['(((', [')))']],
  ['([', ['])']],
  ['[[', [']]']],
  ['[(', [')]']],
  ['((', ['))']],
  ['{{', ['}}']],
  ['[/', ['/]', '\\]']],
  ['[\\', ['\\]', '/]']],
  ['[', [']']],
  ['(', [')']],
  ['{', ['}']],
  ['>', [']']]
];

const TEXT_EDGE = /(^|\s)(--|==|-\.)[ \t]+(?!")([^\n|]*?\S)[ \t]+(-->|---|--[xo]|==>|===|==[xo]|\.->|\.-)(?=\s|$|\w)/g;
const SUBGRAPH_TITLE = /^(\s*subgraph\s+[\p{L}\p{N}_]+)\s*\[(?!")(.*)\]\s*$/u;
const PLAIN_LINE = /^\s*(%%|style\s|classDef\s|class\s|linkStyle\s|click\s|direction\s|end\s*$|subgraph\s)/;
const FLOWCHART = /^\s*(flowchart|graph)\b/;
const ID_CHAR = /[\p{L}\p{N}_]/u;

function versionParts(version) {
  const match = String(version || '').trim().match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  return match ? match.slice(1).map((n) => parseInt(n || '0', 10)) : null;
}

function isOlderThan(parts, limit) {
  for (let i = 0; i < limit.length; i++) {
    if (parts[i] !== limit[i]) return parts[i] < limit[i];
  }
  return false;
}

function needsQuotedLabels(version) {
  const parts = versionParts(version);
  return !!parts && isOlderThan(parts, QUOTED_LABELS_BEFORE);
}

function quoted(label) {
  return '"' + label.trim().replace(/"/g, '#quot;') + '"';
}

function shapeAt(line, index) {
  return NODE_SHAPES.find(([open]) => line.startsWith(open, index));
}

function closingAt(line, from, closes) {
  let best = null;
  for (const close of closes) {
    const at = line.indexOf(close, from);
    if (at >= 0 && (!best || at < best.at)) best = { at, close };
  }
  return best;
}

function quoteLabels(line) {
  let out = '';
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (ch === '"') {
      const end = line.indexOf('"', i + 1);
      const stop = end < 0 ? line.length : end + 1;
      out += line.slice(i, stop);
      i = stop;
      continue;
    }
    if (ch === '|') {
      const end = line.indexOf('|', i + 1);
      if (end > i + 1 && line[i + 1] !== '"' && line.slice(i + 1, end).trim()) {
        out += '|' + quoted(line.slice(i + 1, end)) + '|';
        i = end + 1;
        continue;
      }
    }
    if (ID_CHAR.test(ch) && (i === 0 || !ID_CHAR.test(line[i - 1]))) {
      let j = i;
      while (j < line.length && ID_CHAR.test(line[j])) j++;
      const shape = shapeAt(line, j);
      const start = shape && j + shape[0].length;
      const closing = shape && line[start] !== '"' && closingAt(line, start, shape[1]);
      if (closing && line.slice(start, closing.at).trim()) {
        out += line.slice(i, start) + quoted(line.slice(start, closing.at)) + closing.close;
        i = closing.at + closing.close.length;
        continue;
      }
      out += line.slice(i, j);
      i = j;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

function textEdgesAsLabels(line) {
  return line.replace(TEXT_EDGE, (m, lead, open, label, close) =>
    lead + (open === '-.' ? '-' + close : close) + '|' + quoted(label) + '|');
}

function adaptLine(line) {
  const title = line.match(SUBGRAPH_TITLE);
  if (title) return title[1] + ' [' + quoted(title[2]) + ']';
  if (PLAIN_LINE.test(line)) return line;
  return quoteLabels(textEdgesAsLabels(line));
}

function adaptMermaid(source, version) {
  if (!needsQuotedLabels(version)) return source;
  const lines = String(source).split('\n');
  const header = lines.findIndex((line) => line.trim() && !/^\s*%%/.test(line));
  if (header < 0 || !FLOWCHART.test(lines[header])) return source;
  return lines.map((line, i) => (i <= header ? line : adaptLine(line))).join('\n');
}

module.exports = { adaptMermaid, needsQuotedLabels };
