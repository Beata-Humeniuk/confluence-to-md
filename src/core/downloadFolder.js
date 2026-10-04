const path = require('path');

function parseDownloadFolder(configured, homeDir) {
  const value = String(configured == null ? '' : configured).trim();
  if (!value) return { kind: 'current' };

  const expanded = expandHome(value, homeDir);
  if (path.isAbsolute(expanded) || /^[a-zA-Z]:[\\/]/.test(expanded) || expanded.startsWith('/')) {
    return { kind: 'absolute', path: expanded };
  }

  const segments = expanded.split(/[\\/]+/).filter((s) => s && s !== '.');
  return segments.length ? { kind: 'relative', segments } : { kind: 'current' };
}

function expandHome(value, homeDir) {
  if (!homeDir) return value;
  if (value === '~') return homeDir;
  if (value.startsWith('~/') || value.startsWith('~\\')) return path.join(homeDir, value.slice(2));
  return value;
}

module.exports = { parseDownloadFolder };
