const { parseFrontMatter } = require('./frontMatter');

const TOKEN = 'confluence_to_md_pull';

function pullLink(uriScheme, extensionId, fileUri) {
  return uriScheme + '://' + extensionId + '/pull?file=' + encodeURIComponent(String(fileUri));
}

function fileUriOf(query) {
  return new URLSearchParams(String(query || '')).get('file') || '';
}

// A markdown-it plugin for the Markdown preview: a file bound to a Confluence
// page gets a small "Pull" button in the top right corner. The button is a
// link back into VS Code, handled by the extension's URI handler.
function previewPullButton(md, options) {
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
    const href = pullLink(options.uriScheme, options.extensionId, doc);
    const version = tokens[idx].meta.version;
    const title = 'Update this file from Confluence' +
      (version ? ' (local copy: version ' + version + ')' : '');
    return '<a class="confluence-to-md-pull" href="' + md.utils.escapeHtml(href) +
      '" title="' + md.utils.escapeHtml(title) + '">&#x21bb; Pull</a>\n';
  };

  return md;
}

module.exports = { previewPullButton, pullLink, fileUriOf };
