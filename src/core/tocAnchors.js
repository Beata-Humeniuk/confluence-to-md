const HEADING_LINE = /^#{1,6}[ \t]+(.*)$/;
const FENCE_LINE = /^[ \t]*(?:```|~~~)/;

function headingPlainText(text) {
  return String(text)
    .replace(/\[([^\]]*)\]\([^()\s]*\)/g, '$1')
    .replace(/[*_`~\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function mdAnchorOf(text) {
  return headingPlainText(text).toLowerCase().replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}\-_]/gu, '');
}

function anchorKeyOf(s) {
  return String(s).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

function collectHeadings(lines) {
  const headings = [];
  const slugSeen = new Map();
  const keySeen = new Map();
  let fenced = false;
  for (const line of lines) {
    if (FENCE_LINE.test(line)) { fenced = !fenced; continue; }
    if (fenced) continue;
    const m = line.match(HEADING_LINE);
    if (!m) continue;
    const key0 = anchorKeyOf(headingPlainText(m[1]));
    if (!key0) continue;
    let slug = mdAnchorOf(m[1]);
    const sN = slugSeen.get(slug) || 0;
    slugSeen.set(slug, sN + 1);
    if (sN) slug += '-' + sN;
    let key = key0;
    const kN = keySeen.get(key) || 0;
    keySeen.set(key, kN + 1);
    if (kN) key += kN;
    headings.push({ key, slug });
  }
  return headings;
}

function anchorTargetOf(fragment, headings) {
  let frag = String(fragment);
  try { frag = decodeURIComponent(frag); } catch (e) { }
  const key = anchorKeyOf(frag);
  if (!key) return null;
  let best = null;
  for (const h of headings) {
    if (h.key === key) return h;
    if (key.length > h.key.length && key.endsWith(h.key) &&
      (!best || h.key.length > best.key.length)) best = h;
  }
  return best;
}

function rewriteTocAnchors(markdown) {
  const lines = String(markdown).split('\n');
  const headings = collectHeadings(lines);
  if (!headings.length) return markdown;
  let fenced = false;
  return lines.map((line) => {
    if (FENCE_LINE.test(line)) { fenced = !fenced; return line; }
    if (fenced) return line;
    return line.replace(/\]\(#([^()\s]+)\)/g, (full, frag) => {
      const target = anchorTargetOf(frag, headings);
      return target ? '](#' + target.slug + ')' : full;
    });
  }).join('\n');
}

module.exports = { rewriteTocAnchors };
