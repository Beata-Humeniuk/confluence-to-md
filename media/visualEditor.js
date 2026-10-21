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
  const SAVE_LABEL = '&#x1F4BE; Save';
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

  let dirty = false;

  function showDirty() {
    const button = root.querySelector('.confluence-to-md-save button');
    if (!button) return;
    button.innerHTML = dirty ? SAVE_LABEL : '&#x2713; Saved';
    button.parentElement.classList.toggle('confluence-to-md-saved', !dirty);
  }

  function scheduleEdit() {
    dirty = true;
    showDirty();
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
      hostButton('save', SAVE_LABEL, 'Save the file <Ctrl+S>'),
      hostButton('source', '&lt;/&gt; Text editor', 'Leave the visual editor and edit the file as text, where other extensions offer their commands')
    ];
    // Only a file bound to a Confluence page gets the Confluence buttons; a
    // new page can still be published with Confluence: Publish Page.
    if (bound) {
      items.push(hostButton('pull', '&#x21bb; Pull', 'Update this file from Confluence'));
      items.push(hostButton('publish', '&#x2191; Publish', 'Publish this file to Confluence'));
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
        setUpListButtons();
        watchBlockToolbar();
        showDirty();
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

  const LISTS = {
    list: { tag: 'UL', task: false, marker: () => '* ' },
    'ordered-list': { tag: 'OL', task: false, marker: (i) => (i + 1) + '. ' },
    check: { tag: 'UL', task: true, marker: () => '* [ ] ' }
  };
  const ITEM_MARKER = /^(?:[*+-]|\d+[.)])[ \t]+(?:\[[ xX]\][ \t]+)?/;

  function editArea() {
    return root.querySelector('.vditor-wysiwyg > .vditor-reset');
  }

  // The top-level blocks the selection touches, in order.
  function selectedBlocks() {
    const area = editArea();
    const selection = window.getSelection();
    if (!area || !selection.rangeCount) return [];
    const range = selection.getRangeAt(0);
    const top = (container, offset) => {
      let node = container === area ? area.children[Math.min(offset, area.children.length - 1)] : container;
      while (node && node.parentNode !== area) node = node.parentNode;
      return node;
    };
    const first = top(range.startContainer, range.startOffset);
    const last = top(range.endContainer, Math.max(range.endOffset - 1, 0));
    if (!first || !last) return [];
    const blocks = [];
    for (let node = first; node; node = node.nextElementSibling) {
      blocks.push(node);
      if (node === last) return blocks;
    }
    return [];
  }

  function isList(block, kind) {
    const task = !!block.querySelector(':scope > li.vditor-task');
    return block.tagName === kind.tag && task === kind.task;
  }

  // Each item: its first line, and the lines nested under it.
  function blockItems(block, lute) {
    const md = lute.VditorDOM2Md(block.outerHTML).replace(/\n+$/, '');
    if (block.tagName === 'UL' || block.tagName === 'OL') {
      const items = [];
      for (const line of md.split('\n')) {
        if (!line.trim()) continue;
        if (ITEM_MARKER.test(line)) items.push({ text: line.replace(ITEM_MARKER, ''), nested: [] });
        else if (items.length) items[items.length - 1].nested.push(line);
      }
      return items;
    }
    if (block.tagName === 'P' || HEADING.test(block.tagName)) {
      return md.replace(/^#{1,6}[ \t]+/, '').split('\n')
        .map((line) => line.replace(/(?:[ \t]{2,}|\\)$/, '').trim())
        .filter((line) => line).map((text) => ({ text, nested: [] }));
    }
    return null;
  }

  // Vditor turns only the line with the cursor into a list item, and not at
  // all when the line contains inline code. This turns every selected line
  // into an item of one list, or the lines back into text when they all are
  // that kind of list already, as in Confluence.
  function toggleList(name) {
    const kind = LISTS[name];
    const lute = editor.vditor.lute;
    const blocks = selectedBlocks();
    if (!blocks.length) return false;
    const items = [];
    for (const block of blocks) {
      const own = blockItems(block, lute);
      if (!own) return false;
      items.push(...own);
    }
    if (!items.length) return false;
    const off = blocks.every((block) => isList(block, kind));
    const md = off
      ? items.map((item) => [item.text].concat(item.nested.map((line) => line.trim())).join('\n\n')).join('\n\n')
      : items.map((item, i) => [kind.marker(i) + item.text].concat(item.nested).join('\n')).join('\n');
    const holder = document.createElement('div');
    holder.innerHTML = lute.Md2VditorDOM(md + '\n');
    const inserted = Array.from(holder.children);
    for (const node of inserted) blocks[0].parentNode.insertBefore(node, blocks[0]);
    blocks.forEach((block) => block.remove());
    const range = document.createRange();
    range.selectNodeContents(inserted[inserted.length - 1]);
    range.collapse(false);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    editor.vditor.undo.addToUndoStack(editor.vditor);
    scheduleEdit();
    return true;
  }

  function caretElement() {
    const selection = window.getSelection();
    const node = selection && selection.anchorNode;
    const element = node && (node.nodeType === 1 ? node : node.parentElement);
    const area = editArea();
    return element && area && area.contains(element) ? element : null;
  }

  // Vditor greys the list buttons out inside inline code, where ours work,
  // and then stops marking the list the cursor is in. Show both correctly.
  function syncListButtons() {
    const element = caretElement();
    const item = element && element.closest('li');
    const blocked = !!(element && element.closest('[data-type="code-block"], [data-type="table"]'));
    for (const name of Object.keys(LISTS)) {
      const button = root.querySelector('.vditor-toolbar [data-type="' + name + '"]');
      if (!button) continue;
      const kind = LISTS[name];
      const current = !!item && item.parentElement.tagName === kind.tag &&
        item.classList.contains('vditor-task') === kind.task;
      if (button.classList.contains('vditor-menu--disabled') !== blocked) {
        button.classList.toggle('vditor-menu--disabled', blocked);
      }
      if (button.classList.contains('vditor-menu--current') !== current) {
        button.classList.toggle('vditor-menu--current', current);
      }
    }
  }

  // With its move and delete buttons hidden, the toolbar Vditor shows above
  // headings, list items and quotes is empty; hide it rather than show an
  // empty box. Tables, code blocks and links keep theirs.
  function hideEmptyBlockToolbar(panel) {
    if (panel.style.display === 'none') return;
    const useful = Array.from(panel.children).some((child) => getComputedStyle(child).display !== 'none');
    if (!useful) panel.style.display = 'none';
  }

  function watchBlockToolbar() {
    const panel = root.querySelector('.vditor-wysiwyg > .vditor-panel');
    if (!panel) return;
    const observer = new MutationObserver(() => hideEmptyBlockToolbar(panel));
    observer.observe(panel, { attributes: true, attributeFilter: ['style'], childList: true });
  }

  function setUpListButtons() {
    for (const name of Object.keys(LISTS)) {
      const button = root.querySelector('.vditor-toolbar [data-type="' + name + '"]');
      if (!button) continue;
      new MutationObserver(syncListButtons).observe(button, { attributes: true, attributeFilter: ['class'] });
      button.parentElement.addEventListener('click', (e) => {
        if (!button.contains(e.target)) return;
        const element = caretElement();
        // Vditor handles a single line outside inline code; the rest is ours.
        if (selectedBlocks().length < 2 && !(element && element.closest('code'))) return;
        e.preventDefault();
        e.stopPropagation();
        toggleList(name);
      }, true);
    }
  }

  function showStyle() {
    const label = root.querySelector('.confluence-to-md-style-label');
    if (!label) return;
    const style = currentStyle();
    label.textContent = (style === 'p' || !style ? 'Normal text' : 'Heading ' + style.slice(1)) + ' \u25BE';
  }

  document.addEventListener('selectionchange', () => {
    showStyle();
    syncListButtons();
  });

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
    } else if (message.type === 'state') {
      dirty = !!message.dirty;
      showDirty();
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
