const { parseFrontMatter } = require('./frontMatter');

const TOKEN = 'confluence_to_md_actions';

function actionLink(uriScheme, extensionId, action, fileUri) {
  return uriScheme + '://' + extensionId + '/' + action + '?file=' + encodeURIComponent(String(fileUri));
}

function fileUriCandidates(query) {
  const m = /(?:^|&)file=(.*)$/.exec(String(query || ''));
  if (!m || !m[1]) return [];
  const out = [m[1]];
  try {
    const decoded = decodeURIComponent(m[1]);
    if (decoded !== m[1]) out.push(decoded);
  } catch (e) { }
  return out;
}

function previewButtons(md, options) {
  md.core.ruler.push(TOKEN, (state) => {
    const { meta } = parseFrontMatter(state.src);
    const token = new state.Token(TOKEN, '', 0);
    token.block = true;
    token.meta = { bound: !!meta, version: meta ? meta.version : 0 };
    state.tokens.unshift(token);
  });

  md.renderer.rules[TOKEN] = (tokens, idx, opts, env) => {
    const doc = env && env.currentDocument;
    if (!doc || doc.scheme === 'untitled') return '';
    const { bound, version } = tokens[idx].meta;
    const button = (action, label, title) => '<a class="confluence-to-md-' + action + '" href="' +
      md.utils.escapeHtml(actionLink(options.uriScheme, options.extensionId, action, doc)) +
      '" title="' + md.utils.escapeHtml(title) + '">' + label + '</a>';
    const known = version ? ' (local copy: version ' + version + ')' : '';
    const buttons = bound
      ? button('pull', '&#x21bb; Pull', 'Update this file from Confluence' + known) +
        button('publish', '&#x2191; Publish', 'Publish this file to Confluence' + known)
      : button('publish', '&#x2191; Publish to Confluence', 'Create a new Confluence page from this file');
    return '<div class="confluence-to-md-actions">' + buttons + '</div>\n';
  };

  return md;
}

module.exports = { previewButtons, actionLink, fileUriCandidates };
