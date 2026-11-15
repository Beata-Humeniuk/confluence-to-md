const { escapeXml, decodeEntities } = require('./markup');

// The Confluence expand macro (a section the reader opens with a click) as
// <details> in the file, as GitHub and the Markdown preview show it:
//
//   <details>
//   <summary>Title</summary>
//
//   Text that the section hides.
//
//   </details>
const OPEN = /^<details(?:\s[^>]*)?>[ \t]*(?:<summary(?:\s[^>]*)?>([\s\S]*?)<\/summary>)?[ \t]*$/i;
const SUMMARY = /^<summary(?:\s[^>]*)?>([\s\S]*?)<\/summary>[ \t]*$/i;
const CLOSE = /^<\/details>[ \t]*$/i;

function expandMarkdown(title, content) {
  const summary = String(title || '').replace(/\s+/g, ' ').trim();
  return '<details>\n' + (summary ? '<summary>' + escapeXml(summary) + '</summary>\n' : '') +
    '\n' + String(content).trim() + '\n\n</details>';
}

function summaryText(html) {
  return decodeEntities(String(html || '').replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
}

function expandMacroOpen(title) {
  return '<ac:structured-macro ac:name="expand" ac:schema-version="1">' +
    (title ? '<ac:parameter ac:name="title">' + escapeXml(title) + '</ac:parameter>' : '') +
    '<ac:rich-text-body>\n';
}

const EXPAND_CLOSE = '</ac:rich-text-body></ac:structured-macro>\n';

function lineAt(state, line) {
  return state.src.slice(state.bMarks[line] + state.tShift[line], state.eMarks[line]);
}

// markdown-it plugin: <details> and </details> on lines of their own open and
// close an expand macro; the text between them is Markdown.
function expandBlocks(md) {
  md.block.ruler.before('html_block', 'confluence_to_md_expand', (state, startLine, endLine, silent) => {
    if (state.sCount[startLine] - state.blkIndent >= 4) return false;
    const text = lineAt(state, startLine);
    const close = CLOSE.test(text);
    const open = close ? null : OPEN.exec(text);
    if (!close && !open) return false;
    if (silent) return true;
    let line = startLine + 1;
    let title = open && open[1];
    if (open && title === undefined && line < endLine && state.sCount[line] - state.blkIndent < 4) {
      const summary = SUMMARY.exec(lineAt(state, line));
      if (summary) {
        title = summary[1];
        line += 1;
      }
    }
    const token = state.push(close ? 'expand_close' : 'expand_open', '', 0);
    if (open) token.meta = { title: summaryText(title) };
    token.map = [startLine, line];
    state.line = line;
    return true;
  }, { alt: ['paragraph', 'reference', 'blockquote', 'list'] });

  // Each expand closes in the block it opened in, so the page stays valid: a
  // </details> without its <details> is left out, and an expand still open at
  // the end of its block is closed there.
  md.core.ruler.after('block', 'confluence_to_md_expand_pairs', (state) => {
    const out = [];
    const open = [];
    const closeTo = (level) => {
      while (open.length && open[open.length - 1] > level) {
        out.push(new state.Token('expand_close', '', 0));
        open.pop();
      }
    };
    for (const token of state.tokens) {
      if (token.nesting < 0) closeTo(token.level);
      if (token.type === 'expand_open') open.push(token.level);
      if (token.type === 'expand_close') {
        if (!open.length || open[open.length - 1] !== token.level) continue;
        open.pop();
      }
      out.push(token);
    }
    closeTo(-1);
    state.tokens = out;
  });

  md.renderer.rules.expand_open = (tokens, idx) => expandMacroOpen(tokens[idx].meta.title);
  md.renderer.rules.expand_close = () => EXPAND_CLOSE;
  return md;
}

module.exports = { expandMarkdown, expandBlocks, summaryText };
