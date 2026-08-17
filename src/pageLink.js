const PLACEHOLDER_BASE = 'https://confluence.invalid';

function decode(s) {
  try {
    return decodeURIComponent(s);
  } catch (e) {
    return s;
  }
}

function pageRefOfHref(href, origin) {
  const raw = String(href == null ? '' : href).trim();
  if (!raw || raw[0] === '#') return null;

  if (raw.indexOf('confluence:') === 0) {
    const parts = raw.slice('confluence:'.length).split('/');
    const title = decode(parts[parts.length - 1]);
    return title ? { spaceKey: parts.length > 1 ? decode(parts[0]) : '', pageId: '', title } : null;
  }

  const hosted = /^([a-zA-Z][a-zA-Z0-9+.-]*:)?\/\//.test(raw);
  if (!hosted && raw[0] !== '/') return null;

  let base = null;
  if (origin) {
    try { base = new URL(String(origin)); } catch (e) { base = null; }
  }
  let url;
  try { url = new URL(raw, base || PLACEHOLDER_BASE); } catch (e) { return null; }
  if (hosted && (!base || url.host !== base.host)) return null;

  const path = decode(url.pathname);
  const spacePage = path.match(/\/spaces\/([^/]+)\/pages\/(\d+)/);
  if (spacePage) return { spaceKey: spacePage[1], pageId: spacePage[2], title: '' };

  const pid = url.searchParams.get('pageId');
  if (pid && /^\d+$/.test(pid)) return { spaceKey: '', pageId: pid, title: '' };

  const display = path.match(/\/display\/([^/]+)\/([^/?#]+)/);
  if (display) return { spaceKey: display[1], pageId: '', title: display[2].replace(/\+/g, ' ') };

  const anyPage = path.match(/\/pages\/(\d+)/);
  if (anyPage) return { spaceKey: '', pageId: anyPage[1], title: '' };

  return null;
}

module.exports = { pageRefOfHref };
