function placeInTree(pages, known) {
  const folders = new Map(known);
  const placed = new Map();
  const sorted = pages.slice().sort(
    (a, b) => (a.ancestors || []).length - (b.ancestors || []).length);
  for (const page of sorted) {
    let dir = '';
    const chain = page.ancestors || [];
    for (let i = chain.length - 1; i >= 0; i--) {
      const parent = folders.get(String(chain[i]));
      if (parent) { dir = parent; break; }
    }
    const relPath = known.get(page.id) || (dir ? dir + '/' : '') + page.slug;
    placed.set(page.id, relPath);
    folders.set(page.id, relPath);
  }
  return placed;
}

module.exports = { placeInTree };
