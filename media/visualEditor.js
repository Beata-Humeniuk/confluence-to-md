(function () {
  const vscode = acquireVsCodeApi();
  const root = document.getElementById('visual-editor');
  const cdn = root.getAttribute('data-cdn');
  const linkBase = root.getAttribute('data-link-base');
  const dark = document.body.classList.contains('vscode-dark') ||
    document.body.classList.contains('vscode-high-contrast');

  const MERMAID_SAMPLE = '\n```mermaid\nflowchart TD\n  A[Start] --> B{Decision}\n  B -->|Yes| C[Do it]\n  B -->|No| D[Skip]\n```\n';
  const EDIT_DELAY = 250;

  let editor = null;
  let bound = false;
  let lastBody = '';
  let pending = null;
  let modifierClick = false;

  function flush() {
    if (pending === null) return;
    clearTimeout(pending);
    pending = null;
    const body = editor.getValue();
    if (body === lastBody) return;
    lastBody = body;
    vscode.postMessage({ type: 'edit', body });
  }

  function scheduleEdit() {
    clearTimeout(pending);
    pending = setTimeout(flush, EDIT_DELAY);
  }

  function hostButton(name, label, tip) {
    return {
      name: 'confluence-' + name,
      tipPosition: 'sw',
      tip,
      className: 'confluence-to-md-button confluence-to-md-' + name,
      icon: '<span>' + label + '</span>',
      click: () => {
        flush();
        vscode.postMessage({ type: 'command', name });
      }
    };
  }

  function toolbar() {
    const items = [
      'headings', 'bold', 'italic', 'strike', '|',
      'list', 'ordered-list', 'check', 'outdent', 'indent', '|',
      'link', 'table', 'code', 'inline-code', 'quote', 'line',
      {
        name: 'mermaid',
        tipPosition: 'n',
        tip: 'Insert Mermaid diagram',
        className: 'confluence-to-md-button',
        icon: '<span>+ Mermaid</span>',
        click: () => editor.insertValue(MERMAID_SAMPLE)
      },
      '|', 'undo', 'redo', '|',
      hostButton('source', '&lt;/&gt; Markdown', 'Open the Markdown source in the text editor')
    ];
    if (bound) {
      items.push(hostButton('pull', '&#x21bb; Pull', 'Update this file from Confluence'));
      items.push(hostButton('publish', '&#x2191; Publish', 'Publish this file to Confluence'));
    } else {
      items.push(hostButton('publish', '&#x2191; Publish to Confluence', 'Create a new Confluence page from this file'));
    }
    return items;
  }

  function create(body) {
    lastBody = body;
    editor = new Vditor('visual-editor', {
      cdn,
      value: body,
      mode: 'wysiwyg',
      lang: 'en_US',
      icon: 'ant',
      height: '100%',
      theme: dark ? 'dark' : 'classic',
      cache: { enable: false },
      toolbar: toolbar(),
      toolbarConfig: { pin: true },
      counter: { enable: false },
      tab: '  ',
      preview: {
        delay: 300,
        theme: { current: dark ? 'dark' : 'light', path: cdn + '/dist/css/content-theme' },
        hljs: { style: dark ? 'github-dark' : 'github', lineNumber: false },
        math: { inlineDigit: false },
        markdown: {
          linkBase,
          toc: false,
          footnotes: true,
          mark: false,
          sup: false,
          sub: false,
          callout: false,
          gfmAutoLink: true,
          codeBlockPreview: true,
          mathBlockPreview: false
        }
      },
      link: {
        isOpen: false,
        click: (element) => {
          if (modifierClick) vscode.postMessage({ type: 'openLink', href: relativeHref(element) });
        }
      },
      input: scheduleEdit,
      blur: flush,
      after: () => vscode.postMessage({ type: 'ready' })
    });
  }

  function relativeHref(element) {
    const href = element.getAttribute('href') || '';
    return href.indexOf(linkBase) === 0 ? href.slice(linkBase.length) : href;
  }

  const MERGED = { '<<': 'Merged with the cell on the left', '^^': 'Merged with the cell above' };

  // Markdown has no merged cells, so the file marks them with << and ^^.
  // Show those cells faded, with a tooltip saying what they mean.
  function markMergedCells() {
    for (const cell of root.querySelectorAll('.vditor-wysiwyg td, .vditor-wysiwyg th')) {
      const tip = MERGED[cell.textContent.trim()];
      cell.classList.toggle('confluence-to-md-merged', !!tip);
      if (tip) cell.title = tip;
      else cell.removeAttribute('title');
    }
  }

  new MutationObserver(markMergedCells).observe(root, { childList: true, subtree: true, characterData: true });

  function isUndoRedo(e) {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return false;
    const key = e.key.toLowerCase();
    return key === 'z' || key === 'y';
  }

  // Vditor keeps its own undo history; stop the key here so VS Code does not
  // undo the same change a second time in the underlying text document.
  root.addEventListener('keydown', (e) => {
    if (isUndoRedo(e)) e.stopPropagation();
  });

  // Like in the text editor, Ctrl/Cmd+click opens a link and a plain click edits it.
  window.addEventListener('mousedown', (e) => {
    modifierClick = e.ctrlKey || e.metaKey;
  }, true);

  window.addEventListener('message', (event) => {
    const message = event.data;
    if (message.type === 'init') {
      if (editor && bound === !!message.bound) return;
      bound = !!message.bound;
      if (editor) {
        flush();
        editor.destroy();
      }
      create(editor ? lastBody : message.body);
    } else if (message.type === 'update') {
      if (!editor || message.body === lastBody) return;
      if (pending !== null) {
        clearTimeout(pending);
        pending = null;
      }
      lastBody = message.body;
      editor.setValue(message.body, true);
    } else if (message.type === 'flush') {
      // Without unsent typing there is nothing to save, and sending the text
      // anyway would rewrite an unchanged file in the editor's Markdown style.
      let body = null;
      if (editor && pending !== null) {
        clearTimeout(pending);
        pending = null;
        body = lastBody = editor.getValue();
      }
      vscode.postMessage({ type: 'edit', body, flush: true });
    }
  });

  vscode.postMessage({ type: 'loaded' });
}());
