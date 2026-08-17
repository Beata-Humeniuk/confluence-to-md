function hostOf(origin) {
  return String(origin).replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/:\d+$/, '');
}

function siteOf(origin, basePath) {
  const base = String(basePath || '').replace(/\/+$/, '');
  return { origin, basePath: base, cloud: /\.atlassian\.net$/i.test(hostOf(origin)) || base === '/wiki' };
}

function decodePath(pathname) {
  try {
    return decodeURIComponent(pathname);
  } catch (e) {
    return pathname;
  }
}

function parsePageUrl(input) {
  let u;
  try {
    u = new URL(String(input).trim());
  } catch (e) {
    return null;
  }
  if (!/^https?:$/.test(u.protocol)) return null;
  const path = decodePath(u.pathname);
  const before = (marker) => siteOf(u.origin, path.slice(0, path.indexOf(marker)));

  const spacePage = path.match(/\/spaces\/([^/]+)\/pages\/(\d+)/);
  if (spacePage) {
    return { site: before('/spaces/'), spaceKey: spacePage[1], pageId: spacePage[2] };
  }

  const pid = u.searchParams.get('pageId');
  if (pid && /^\d+$/.test(pid)) {
    return { site: path.includes('/pages/') ? before('/pages/') : siteOf(u.origin, ''), pageId: pid };
  }

  const display = path.match(/\/display\/([^/]+)\/([^/]+)/);
  if (display) {
    return { site: before('/display/'), spaceKey: display[1], title: display[2].replace(/\+/g, ' ') };
  }

  const anyPage = path.match(/\/pages\/(\d+)/);
  if (anyPage) return { site: before('/pages/'), pageId: anyPage[1] };

  const tiny = path.match(/\/x\/([^/]+)/);
  if (tiny) return { site: before('/x/'), tinyUrl: u.href };

  return null;
}

function isCloud(site) {
  return !!(site && site.cloud);
}

function authFor(site, token, email) {
  return { token, email: isCloud(site) ? String(email || '').trim() : '' };
}

function authHeader(cfg) {
  if (cfg.email) {
    return 'Basic ' + Buffer.from(cfg.email + ':' + cfg.token).toString('base64');
  }
  return 'Bearer ' + cfg.token;
}

function apiRoot(site) {
  return site.origin + site.basePath + '/rest/api';
}

async function apiGet(cfg, site, path) {
  const res = await request(cfg, apiRoot(site) + path);
  return res.json();
}

async function apiSend(cfg, site, method, path, body) {
  const res = await request(cfg, apiRoot(site) + path, { method, body });
  return res.json();
}

async function request(cfg, url, opts) {
  opts = opts || {};
  const headers = { Authorization: authHeader(cfg), Accept: 'application/json' };
  if (opts.body) headers['Content-Type'] = 'application/json';
  const res = await fetch(url, {
    method: opts.method || 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  if (res.status === 401 || res.status === 403) throw new Error('auth');
  if (res.status === 404) throw new Error('not-found');
  if (res.status === 409) throw new Error('conflict');
  if (!res.ok) throw new Error('http-' + res.status);
  return res;
}

async function fetchPageByUrl(cfg, url) {
  let parsed = parsePageUrl(url);
  if (!parsed) throw new Error('bad-url');
  if (parsed.tinyUrl) parsed = await resolveTiny(cfg, parsed);
  if (parsed.pageId) return fetchPageById(cfg, parsed.site, parsed.pageId);
  return fetchPageByTitle(cfg, parsed.site, parsed.spaceKey, parsed.title);
}

async function fetchPageById(cfg, site, pageId) {
  const j = await apiGet(cfg, site, '/content/' + pageId + '?expand=body.export_view,space,version,ancestors');
  return pageOf(j, site);
}

async function fetchPageMeta(cfg, site, pageId) {
  const j = await apiGet(cfg, site, '/content/' + pageId + '?expand=space,version');
  return pageOf(j, site);
}

async function createPage(cfg, site, opts) {
  const body = {
    type: 'page',
    title: opts.title,
    space: { key: opts.spaceKey },
    body: { storage: { value: opts.storage, representation: 'storage' } }
  };
  if (opts.parentId) body.ancestors = [{ id: opts.parentId }];
  const j = await apiSend(cfg, site, 'POST', '/content', body);
  return pageOf(j, site);
}

async function updatePage(cfg, site, pageId, opts) {
  const j = await apiSend(cfg, site, 'PUT', '/content/' + pageId, {
    id: pageId,
    type: 'page',
    title: opts.title,
    version: { number: opts.version },
    body: { storage: { value: opts.storage, representation: 'storage' } }
  });
  return pageOf(j, site);
}

function pageWebUrl(site, spaceKey, pageId) {
  return isCloud(site)
    ? site.origin + site.basePath + '/spaces/' + (spaceKey || '~') + '/pages/' + pageId
    : site.origin + site.basePath + '/pages/viewpage.action?pageId=' + pageId;
}

async function resolveTiny(cfg, parsed) {
  const res = await request(cfg, parsed.tinyUrl);
  const target = res.url && res.url !== parsed.tinyUrl ? parsePageUrl(res.url) : null;
  if (!target || target.tinyUrl) throw new Error('bad-url');
  return target;
}

async function fetchPageByTitle(cfg, site, spaceKey, title) {
  const q = '/content?title=' + encodeURIComponent(title) +
    (spaceKey ? '&spaceKey=' + encodeURIComponent(spaceKey) : '') +
    '&expand=body.export_view,space,version,ancestors&limit=1';
  const j = await apiGet(cfg, site, q);
  if (!j.results || !j.results.length) throw new Error('not-found');
  return pageOf(j.results[0], site);
}

function pageOf(j, site) {
  return {
    id: j.id,
    title: j.title,
    spaceKey: (j.space && j.space.key) || '',
    html: (j.body && j.body.export_view && j.body.export_view.value) || '',
    version: (j.version && j.version.number) || 0,
    ancestors: (j.ancestors || []).map((a) => String(a.id)),
    site
  };
}

module.exports = {
  parsePageUrl, hostOf, isCloud, authFor, authHeader, apiRoot,
  fetchPageByUrl, fetchPageById, fetchPageByTitle,
  fetchPageMeta, createPage, updatePage, pageWebUrl
};
