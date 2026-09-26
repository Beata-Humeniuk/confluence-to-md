const { parseFrontMatter } = require('./frontMatter');

const TOKEN = 'confluence_to_md_actions';

function actionLink(uriScheme, extensionId, action, fileUri) {
  return uriScheme + '://' + extensionId + '/' + action + '?file=' + encodeURIComponent(String(fileUri));
}

// VS Code decodes the query once before the URI handler sees it, so the value
// may still be encoded or already plain. Take everything after "file=" as is:
// a decoded file URI can itself contain "&" or "+".
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

// A markdown-it plugin for the Markdown preview: a file bound to a Confluence
// page gets small "Pull" and "Publish" buttons in the top right corner. They are
// links back into VS Code, handled by the extension's URI handler.
function previewButtons(md, options) {
  md.core.ruler.push(TOKEN, (state) => {
    const { meta } = parseFrontMatter(state.src);
    if (!meta) return;
    const token = new state.Token(TOKEN, '', 0);
    token.block = true;
    token.meta = { version: meta.version };
    state.tokens.unshift(token);
  });

  md.renderer.rules[TOKEN] = (tokens, idx, opts, env) => {
    const doc = env && env.currentDocument;
    if (!doc || doc.scheme === 'untitled') return '';
    const version = tokens[idx].meta.version;
    const known = version ? ' (local copy: version ' + version + ')' : '';
    const button = (action, label, title) => '<a class="confluence-to-md-' + action + '" href="' +
      md.utils.escapeHtml(actionLink(options.uriScheme, options.extensionId, action, doc)) +
      '" title="' + md.utils.escapeHtml(title) + '">' + label + '</a>';
    return '<div class="confluence-to-md-actions">' +
      button('pull', '&#x21bb; Pull', 'Update this file from Confluence' + known) +
      button('publish', '&#x2191; Publish', 'Publish this file to Confluence' + known) +
      '</div>\n';
  };

  return md;
}

module.exports = { previewButtons, actionLink, fileUriCandidates };
