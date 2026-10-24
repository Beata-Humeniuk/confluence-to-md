# Visual editor

The visual editor shows a Markdown file the way it looks on the page, much like
editing in Confluence. You format text with the toolbar or keyboard shortcuts
and never have to read Markdown syntax. The file on disk stays plain Markdown.

## Open the visual editor

- Click **Open Visual Editor** (pencil icon) in the top right corner of a
  Markdown editor, or right-click a `.md` file in the Explorer.
- Or run **Confluence: Open Visual Editor**.

The visual editor takes the place of the text editor in the same tab.

To leave the visual editor, click **</> Text editor** in the toolbar or the
**Open in Text Editor** icon in the editor title. The tab then shows the file
as text, with the commands and buttons other Markdown extensions add, for
example to publish the file elsewhere.

### Make it the default editor for Markdown

Right-click a `.md` file, choose **Open With…**, then
**Configure default editor for '*.md'…** and pick **Confluence Visual Editor**.
The same choice in settings:

```json
"workbench.editorAssociations": {
  "*.md": "confluenceToMd.visualEditor"
}
```

**Open With… → Text Editor** still opens the Markdown text when you need it.
To make the text editor the default again, choose **Text Editor** in the same
**Configure default editor for '*.md'…** list, or remove the line from
`workbench.editorAssociations`.

## Toolbar

| Button | What it does |
|---|---|
| **Normal text ▾** | Text style menu, as in Confluence. The button shows the style of the line with the cursor, such as **Heading 4**. Pick **Normal text** or **Heading 1** to **Heading 6**; the current style is highlighted. |
| **B**, *I*, ~~S~~ | Bold, italic, strikethrough |
| Bullets, numbers, checkbox | Bulleted list, numbered list, task list. With several lines selected, every line becomes an item of one list; clicking the same button again turns them back into lines. The button of the list the cursor is in is highlighted. |
| Indent, outdent | Nest list items, or move them back out |
| Link | Insert or edit a link |
| Table | Insert a table. Click a cell to add or remove rows and columns, align columns, or delete the whole table with **Delete table**. |
| `</>` | Code block. Type the language, for example `bash`, in the box above the block. |
| `<>` | Inline code |
| Quote, line | Quote block and horizontal line |
| **+ Panel** | Insert an Info, Success, Warning, or Error panel |
| **+ Mermaid** | Insert a Mermaid diagram |
| Undo, redo | Undo or redo your last edits |
| **💾 Save** | Save the file, like Ctrl+S. It reads **✓ Saved** when there is nothing to save. |
| **</> Text editor** | Leave the visual editor and show the file as text |
| **↻ Pull**, **↑ Publish** | Same as the preview buttons. Shown only for a file bound to a Confluence page; publish a new page with **Confluence: Publish Page**. |

In a list, **Tab** nests the item under the one above it and **Shift+Tab**
moves it back out, wherever the cursor is in the item.

Markdown shortcuts work too: type `## ` at the start of a line for a heading,
`- ` for a list, `1. ` for a numbered list, or ```` ``` ```` for a code block.

## Paste

**Ctrl+V** (Cmd+V on macOS) keeps the formatting of what you copied, such as
headings, bold text, lists, and tables. **Ctrl+Shift+V** (Cmd+Shift+V, or
Cmd+Option+Shift+V) pastes plain text in the current style: characters such
as `*` or `#` stay text, and each copied line becomes a paragraph. In the
visual editor this shortcut does not open the Markdown preview.

## Merged cells and alignment

Markdown cannot merge table cells, so a merged cell is written as the text
`<<` (merged with the cell on the left) or `^^` (merged with the cell above).
The visual editor shows these cells faded, with a tooltip. To merge cells,
type `<<` or `^^` in the cells to merge; to split them, replace the marker
with text. Confluence and the Markdown preview show the cells merged. See
[Merged cells and alignment](PUBLISHING.md#merged-cells-and-alignment).

To center or right-align, click a cell and use the alignment buttons that
appear above the table. Markdown aligns the whole column, not single cells.

## Mermaid diagrams

A Mermaid block is shown as the diagram. Click the diagram to edit its code:
the code appears above the diagram, and the diagram is redrawn as you type.
Click outside the block to see only the diagram again.

**+ Mermaid** inserts a small flowchart to start from. The editor draws
diagrams with a newer Mermaid version than many Confluence apps use. When you
publish, the extension adapts the syntax to `confluenceToMd.mermaidVersion`;
see [Mermaid diagrams](PUBLISHING.md#mermaid-diagrams).

## Links

Click a link to edit its text and address. Ctrl+click (Cmd+click on macOS)
opens it:

- a link to another Markdown file opens that file,
- a web link opens in the browser,
- a `confluence:` link downloads the page, like in the text editor.

## Saving and the Confluence binding

The visual editor edits the same file as the text editor, so **Save**, undo
in the text editor, Git, and **Pull** all work as usual. You can keep the
Markdown text open next to the visual editor; changes show up in both.

The front matter with the `confluence:` binding is not shown and is never
changed by the visual editor.

### Formatting changes

The first edit in the visual editor writes the whole text in one consistent
Markdown style. The content does not change, but the file can differ in
details that do not affect the page, for example:

- table columns are padded to the same width,
- checked tasks are written as `[X]`,
- a blank line can be added between lists.

Look at the Git diff after your first edit if you want to see these changes.
