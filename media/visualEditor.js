(function () {
  const vscode = acquireVsCodeApi();
  const root = document.getElementById('visual-editor');
  const cdn = root.getAttribute('data-cdn');
  const linkBase = root.getAttribute('data-link-base');
  const isDark = () => document.body.classList.contains('vscode-dark') ||
    document.body.classList.contains('vscode-high-contrast') &&
    !document.body.classList.contains('vscode-high-contrast-light');
  let dark = isDark();

  const MERMAID_SAMPLE = '\n```mermaid\nflowchart TD\n  A[Start] --> B{Decision}\n  B -->|Yes| C[Do it]\n  B -->|No| D[Skip]\n```\n';
  const EDIT_DELAY = 250;
  // Named like the panel types in Confluence.
  const PANELS = [
    { type: 'NOTE', label: 'Info', text: 'Information.' },
    { type: 'TIP', label: 'Success', text: 'Good to know.' },
    { type: 'WARNING', label: 'Warning', text: 'Be careful.' },
    { type: 'CAUTION', label: 'Error', text: 'Do not do this.' }
  ];

  let editor = null;
  let bound = false;
  // The text as the editor writes it, when it last matched the file. Toolbar
  // changes reach the input callback late, so saving compares against this
  // instead of waiting for it.
  let saved = '';
  let pending = null;
  let modifierClick = false;

  // The editor writes panels with an icon and a default title, as in
  // "> [!NOTE] ✏️ Note". Keep the file in the plain "> [!NOTE]" form.
  const CALLOUT = /^(\s*> \[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\])[ \t]*(?:\p{Extended_Pictographic}\uFE0F?[ \t]*)?(.*)$/gmu;

  function markdown() {
    return editor.getValue().replace(CALLOUT, (m, marker, type, title) =>
      title.trim() && title.trim().toLowerCase() !== type.toLowerCase() ? marker + ' ' + title.trim() : marker);
  }

  function changes() {
    clearTimeout(pending);
    pending = null;
    if (!editor) return null;
    const body = markdown();
    if (body === saved) return null;
    saved = body;
    return body;
  }

  function flush() {
    const body = changes();
    if (body !== null) vscode.postMessage({ type: 'edit', body });
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
        name: 'panel',
        tipPosition: 'n',
        tip: 'Insert panel',
        className: 'confluence-to-md-button',
        icon: '<span>+ Panel</span>',
        toolbar: PANELS.map((panel) => ({
          name: 'panel-' + panel.type.toLowerCase(),
          icon: panel.label,
          click: () => editor.insertValue('\n> [!' + panel.type + ']\n> ' + panel.text + '\n')
        }))
      },
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
    // destroy() removes the icon script, but its icons stay in the page. Mark
    // them as loaded, or Vditor requests them again in a way that fails here.
    if (!document.getElementById('vditorIconScript')) {
      const marker = document.createElement('meta');
      marker.id = 'vditorIconScript';
      document.head.appendChild(marker);
    }
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
          callout: true,
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
      after: () => {
        saved = markdown();
        setUpStyleMenu();
        vscode.postMessage({ type: 'ready' });
      }
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

  // VS Code changes the body class when the colour theme changes.
  new MutationObserver(() => {
    if (!editor || isDark() === dark) return;
    dark = isDark();
    editor.setTheme(dark ? 'dark' : 'classic', dark ? 'dark' : 'light', dark ? 'github-dark' : 'github',
      cdn + '/dist/css/content-theme');
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  // Text pasted with Ctrl+Shift+V keeps no formatting: Markdown characters in
  // it are escaped, and each line becomes a paragraph.
  function plainMarkdown(text) {
    return String(text).replace(/\r\n?/g, '\n').split('\n')
      .map((line) => line.trim() ? line.replace(/[\\`*_[\]{}()#+!|~^-]/g, '\\$&')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/^(\s*\d+)\./, '$1\\.') : '')
      .join('\n\n').replace(/\n{3,}/g, '\n\n').replace(/^\n+|\n+$/g, '');
  }

  function isPlainPaste(e) {
    return (e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'v';
  }

  // VS Code opens the Markdown preview on Ctrl+Shift+V, and the editor would
  // paste with formatting. The extension reads the clipboard instead.
  window.addEventListener('keydown', (e) => {
    if (!isPlainPaste(e) || !editor) return;
    e.preventDefault();
    e.stopPropagation();
    vscode.postMessage({ type: 'pastePlain' });
  }, true);

  const HEADING = /^H[1-6]$/;

  function currentStyle() {
    const selection = window.getSelection();
    let node = selection && selection.anchorNode;
    const area = root.querySelector('.vditor-wysiwyg');
    while (node && node !== area) {
      if (node.nodeType === 1 && HEADING.test(node.tagName)) return node.tagName.toLowerCase();
      node = node.parentNode;
    }
    return area && selection && area.contains(selection.anchorNode) ? 'p' : '';
  }

  // Like the text style menu in Confluence: the button names the style of the
  // line with the cursor, and opening it never changes the line by itself.
  // Vditor's own button removes a heading when clicked inside one.
  function setUpStyleMenu() {
    const item = root.querySelector('.vditor-toolbar [data-type="headings"]');
    const panel = item && item.parentElement.querySelector('.vditor-hint');
    if (!item || !panel || panel.querySelector('[data-tag="p"]')) return;
    const label = document.createElement('span');
    label.className = 'confluence-to-md-style-label';
    item.innerHTML = '';
    item.appendChild(label);
    item.setAttribute('aria-label', 'Text style');
    for (const button of panel.querySelectorAll('button[data-tag]')) {
      button.textContent = 'Heading ' + button.getAttribute('data-tag').slice(1);
    }
    const normal = document.createElement('button');
    normal.setAttribute('data-tag', 'p');
    normal.textContent = 'Normal text';
    panel.insertBefore(normal, panel.firstChild);
    panel.classList.add('confluence-to-md-style-menu');

    let native = false;
    item.parentElement.addEventListener('click', (e) => {
      if (native || !item.contains(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      const style = currentStyle();
      for (const button of panel.querySelectorAll('button[data-tag]')) {
        button.classList.toggle('confluence-to-md-style-current', button.getAttribute('data-tag') === style);
      }
      panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
    }, true);
    normal.addEventListener('click', (e) => {
      e.preventDefault();
      panel.style.display = 'none';
      // Vditor turns a heading back into text when its button is clicked
      // inside one.
      if (HEADING.test(currentStyle().toUpperCase()) && item.classList.contains('vditor-menu--current')) {
        native = true;
        item.click();
        native = false;
      }
      showStyle();
    });
    panel.addEventListener('click', () => setTimeout(showStyle, 0));
    showStyle();
  }

  function showStyle() {
    const label = root.querySelector('.confluence-to-md-style-label');
    if (!label) return;
    const style = currentStyle();
    label.textContent = (style === 'p' || !style ? 'Normal text' : 'Heading ' + style.slice(1)) + ' \u25BE';
  }

  document.addEventListener('selectionchange', showStyle);

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
      let body = message.body;
      if (editor) {
        flush();
        body = markdown();
        editor.destroy();
      }
      create(body);
    } else if (message.type === 'update') {
      if (!editor) return;
      clearTimeout(pending);
      pending = null;
      editor.setValue(message.body, true);
      saved = markdown();
    } else if (message.type === 'pasteText') {
      const text = plainMarkdown(message.text || '');
      if (editor && text) editor.insertValue(text);
    } else if (message.type === 'flush') {
      // Without changes there is nothing to save, and sending the text anyway
      // would rewrite an unchanged file in the editor's Markdown style.
      vscode.postMessage({ type: 'edit', body: changes(), flush: true });
    }
  });

  vscode.postMessage({ type: 'loaded' });
}());
