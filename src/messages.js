function errorMessage(e) {
  if (e && e.message === 'auth') return 'Confluence rejected the credentials (401/403) — check confluenceToMd.token in the settings. Cloud: also set confluenceToMd.email (the API token is sent as Basic auth). Server/DC: the PAT is sent as Bearer; the e-mail is not used.';
  if (e && e.message === 'not-found') return 'Page not found (404) — check the link and your permissions.';
  if (e && e.message === 'bad-url') return 'This link does not point at a Confluence page — paste the full page address (with /pages/ID, /display/KEY/Title, ?pageId=ID, or a short /x/… link).';
  if (e && e.message === 'conflict') return 'Version conflict (409) — the page has been changed in Confluence in the meantime.';
  return 'Error: ' + ((e && e.message) || String(e));
}

module.exports = { errorMessage };
