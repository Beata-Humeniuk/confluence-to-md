# Changelog

This file lists user-visible changes to Confluence to Markdown. The project
follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.11.0] - 2026-10-30

### Added

- Publishing a file without a binding can publish it to an existing page: after
  the page link, choose between a new page under it and publishing to it,
  which replaces its content. Before, a link to a page with another title
  always created a page under it.
- When the space already has a page with the file's title, publishing offers to
  publish to that page instead of failing with Confluence's error that the
  page already exists.

### Changed

- The preview and visual editor buttons say where they go: **↻ Pull from
  Confluence** and **↑ Publish to Confluence**.

### Fixed

- A file bound to both a Jira issue (Jira to Markdown) and a Confluence page
  keeps both bindings. Before, the Confluence binding could take the issue's
  address when the `jira:` block came first.

## [1.10.5] - 2026-10-29

### Fixed

- A table cell with several lines, typed in Confluence with Enter, is
  downloaded with one `<br>` between the lines. Before, each line break became
  `<br><br>`, and publishing the file added an empty line between the lines
  on the page. An empty line in a cell is still kept, and a line break no
  longer leaves two spaces before the `<br>`.

## [1.10.4] - 2026-10-27

### Fixed

- Text in angle brackets, such as `<nazwa promocji>`, is shown in the
  Markdown preview and the visual editor. Before, it was read as an HTML tag
  and hidden. Downloading now writes it as `\<nazwa promocji>`.
- Nested numbered lists are numbered like in Confluence in the Markdown
  preview and the visual editor: 1., then a., then i. The file keeps the
  Markdown numbers (1.), as Markdown has no letters for list items.
- A table with a list or a code block in a cell is downloaded as a Markdown
  table. Before, the whole table stayed raw HTML in the file, its links were
  not followed, and publishing it put the HTML on the page as text. List
  items in a cell are lines joined by `<br>`, code is inline code, and
  publishing turns the list lines back into lists.
- Publishing a file without a binding to an existing page works. When the
  page whose link you paste already has the file's title, the extension
  offers to publish to that page and binds the file to it. Before, it tried
  to create a second page with the same title under it, which Confluence
  refuses.

## [1.10.3] - 2026-10-23

### Fixed

- Code blocks in the visual editor can be edited where they are shown.
  Before, a code block appeared as a read-only copy, and clicking it added
  the editable code above it, so the code showed twice and clicks on the
  copy only selected it for copying. Mermaid diagrams still show the
  diagram under their code.
- The language field above a code block no longer covers the line before
  the block.
- A table or code block in the visual editor can be deleted again with the
  **Delete table** or **Delete code block** button above it. The button went
  away with the move and delete toolbar in 1.10.2.
- **Open Visual Editor** replaces the Markdown text tab with the visual
  editor, like **Reopen Editor With**, instead of opening a second tab next
  to it.

## [1.10.2] - 2026-10-21

### Fixed

- The list buttons of the visual editor turn all selected lines into one
  list, not only the line with the cursor. Clicking the same button again
  turns the lines back into text, and another list button changes the kind
  of list.
- The list buttons also work on lines that contain inline code. They were
  turned off there and showed a red "not allowed" sign, and the list the
  cursor was in was not highlighted.
- The small toolbar with up, down and delete buttons that the visual editor
  showed above the current heading, list item or quote is gone. Tables still
  get their alignment and row and column buttons, and code blocks their
  language field.
- **Tab** in a list item of the visual editor nests the item under the one
  above it, and **Shift+Tab** moves it back out, wherever the cursor is in
  the item, as in Confluence. Before, this worked only at the start of the
  item.
- **</> Text editor** (formerly **</> Markdown**) replaces the visual
  editor's tab with the text editor, like **Reopen Editor With → Text
  Editor**, so commands of other Markdown extensions are available again.
  The editor title icon is now called **Open in Text Editor**.

## [1.10.1] - 2026-10-21

### Fixed

- **Ctrl+Shift+V** (Cmd+Shift+V on macOS) in the visual editor pastes plain
  text without the formatting of what you copied, instead of opening the
  Markdown preview or pasting with formatting.
- The heading button of the visual editor is a text style menu, as in
  Confluence. It names the style of the line with the cursor, such as
  **Heading 4**, and highlights it in the menu. **Normal text** turns a
  heading back into text. Clicking the button no longer removes a heading
  by itself, and the menu shows each style in its size without shortcut
  hints.
- The visual editor has a **Save** button, which reads **Saved** when there
  is nothing to save. Its **Pull** and **Publish** buttons appear only for
  files bound to a Confluence page, so a Markdown file kept elsewhere, such
  as in Jira or Git, no longer offers **Publish to Confluence**.
- The heading ID field that the visual editor showed above headings is gone;
  Confluence does not use it.

## [1.10.0] - 2026-10-21

### Added

- Merged table cells survive downloading and publishing. Markdown has no
  merged cells, so a cell covered by a merged cell is written as `<<` (merged
  with the cell on the left) or `^^` (merged with the cell above). Publishing
  turns the markers back into merged cells, the Markdown preview shows them
  merged, and the visual editor shows them faded.
- Confluence panels keep their type and title. Info, Success, Warning, and
  Error panels become GitHub alerts (`> [!NOTE]`, `> [!TIP]`, `> [!WARNING]`,
  `> [!CAUTION]`) with the title after the marker, and publishing turns them
  back into panels. Panels inside table cells work too. The visual editor and
  the Markdown preview show them as coloured panels, and the visual editor
  has a **+ Panel** menu.
- A mention downloaded as a link to a Confluence Cloud profile is published
  as a mention again.

### Fixed

- A table with cells merged across rows no longer shifts the cells of the
  next rows into the wrong columns.
- The visual editor shows its toolbar icons in VS Code. They were missing, so
  headings, lists, tables, and the other toolbar actions could not be used.
- Changes made with the visual editor's toolbar, such as turning a line into
  a heading, are saved even when you save right after making them.
- The visual editor no longer labels headings and code blocks (H1, `</>`) in
  the left margin, and code uses the colours of the VS Code theme instead of
  bright blue. Text uses the theme's colour too, and the editor follows a
  change of the VS Code colour theme without reopening.
- Headings in the visual editor have the sizes of the Markdown preview, from
  a large, underlined level 1 down to level 6, so the levels are easy to tell
  apart.
- A `<br>` line break in a table cell is published as a line break instead
  of the text `<br>`.
- Centered and right-aligned table cells keep their alignment. A downloaded
  column is aligned when most of its cells are, and publishing aligns the
  cells the way Confluence does.

## [1.9.0] - 2026-10-20

### Added

- A visual editor for Markdown files. Open it with **Open Visual Editor** in
  the editor title or the Explorer context menu. It edits headings, lists,
  task lists, links, tables, code blocks, quotes, and Mermaid diagrams with a
  live preview, without showing Markdown syntax. **Pull** and **Publish** are
  in its toolbar. The front matter with the `confluence:` binding is kept as
  it is. See [docs/EDITING.md](docs/EDITING.md).

## [1.8.0] - 2026-10-08

### Added

- Publishing a file that links to other Markdown files not yet in Confluence
  offers to publish them too, as pages under the page that links to them. Each
  file gets its `confluence:` binding and the pages link to each other.

### Fixed

- A link to another Markdown file is published as a link to that file's
  Confluence page when the file is bound to one. A link to an unpublished file
  keeps only its text instead of a dead `.md` link.
- When Confluence rejects a request, the message shows its reason instead of
  just `http-400`.

## [1.7.0] - 2026-10-08

### Added

- Downloading asks for an optional subfolder inside the download folder, such
  as `services/account`. Missing folders are created. Turn the question off
  with `confluenceToMd.askSubfolder`.
- The Markdown preview of a file without a `confluence:` binding shows a
  **↑ Publish to Confluence** button. It asks for a link to the parent page
  and creates the page there, then binds the file to it.

### Changed

- Shorter setting descriptions. Details on finding the Mermaid macro name
  moved to [docs/PUBLISHING.md](docs/PUBLISHING.md#mermaid-diagrams).
- Downloaded files always get `type: confluence-page` in their front matter.
  The guesses at other document types and the `managed: true` line are gone;
  keys you added yourself are still kept on pull.
- The extension declares the `onUri` activation event, so a link back into it
  from a preview button activates it even when no Markdown file is open.

### Fixed

- A `#` comment inside a fenced code block is no longer taken for the page
  title when publishing. The first level-one heading outside code blocks is
  used, and the code block keeps its line.
- A `confluence:` binding whose `url` is written in quotes is read correctly.
- `- [X]` with an upper-case marker is published as a completed task.
- A code sample without a file extension is published without a made-up
  language.
- Looking for previously downloaded pages skips `node_modules` and build
  output folders.

## [1.6.1] - 2026-09-27

### Changed

- The README covers only using the extension. The API for other extensions
  moved to [docs/API.md](docs/API.md).

## [1.6.0] - 2026-09-27

### Added

- The `confluenceToMd.mermaidVersion` setting (default `9.2.2`) names the
  Mermaid version of the app in Confluence. For versions older than 10.3.1,
  flowchart labels are published in quotes, so diagrams that render in VS Code
  no longer show a syntax error in Confluence. The Markdown file is not
  changed.

### Changed

- The default `confluenceToMd.appendixHeading` is now `Additional`.
- The Mermaid settings explain where to find the macro name and the Mermaid
  version.

### Fixed

- Long Mermaid diagrams are no longer extracted to the `.samples` folder when
  downloading or pulling a page.
- Publishing a file with extracted code samples puts their content back on the
  page. Before, the page received links to the local sample files instead of
  the code.

## [1.5.0] - 2026-09-27

### Added

- **Compare** when publishing over a page that changed in Confluence. It opens
  a diff with the current page next to your file, so changes made by others
  can be brought into the file instead of being overwritten.
- **Compare** when pulling. It shows the differences without replacing the
  file, so local edits are not lost by accident.

### Changed

- A bound file that stores no page version is no longer published without
  asking. The extension treats the page as possibly changed and offers
  **Compare** or **Overwrite**.

## [1.4.0] - 2026-09-27

### Added

- Mermaid diagrams in both directions. A ` ```mermaid ` block is published as
  a Mermaid macro, so Confluence draws the diagram instead of showing its
  source as code, and a Mermaid macro is downloaded back as a ` ```mermaid `
  block. The new `confluenceToMd.mermaidMacro` setting names the macro
  (default `mermaid-macro`); an empty value keeps the old code-block
  behavior. A Mermaid app must be installed in Confluence.

## [1.3.1] - 2026-09-26

### Changed

- The preview button next to **↻ Pull** is now called **↑ Publish**, matching
  the **Confluence: Publish Page** command.

## [1.3.0] - 2026-09-25

### Added

- A **↑ Push** button next to **↻ Pull** in the Markdown preview. It asks
  before publishing, saves unsaved edits, and then publishes the file the same
  way as **Confluence: Publish Page**.

### Fixed

- The preview's **↻ Pull** button reported that the file was not open on
  Windows and for paths with spaces or other encoded characters.

## [1.2.0] - 2026-09-25

### Added

- Update a downloaded file from Confluence, like `git pull`: a **↻ Pull**
  button in the top right corner of the Markdown preview for files bound to a
  page, and the **Confluence: Pull Page** command. It checks the version first
  and asks before replacing the file.

## [1.1.0] - 2026-08-18

### Added

- Publish a Markdown file given as an argument to the publish command, read
  from disk, without opening it or disturbing the active editor. Bindings,
  split documents, and the remote-change check work the same as before.
- Report the published page back to whoever ran the command, as
  `{ url, pageId, action }`, so other extensions can delegate publishing
  through `vscode.commands.executeCommand`. See the API section in the README.

### Changed

- Fail with an error the caller can handle when the publish command is given a
  file, instead of only showing a popup. The popup stays with the interactive
  path.

## [1.0.0] - 2026-08-18

First public release.

### Added

- Download Confluence pages as Markdown from Cloud and Server/Data Center, one
  page per file, with child pages arranged in subfolders that mirror the
  Confluence page tree.
- Follow links to other pages, one level deep, and rewrite links between saved
  pages into relative Markdown links.
- Publish Markdown back to Confluence, updating a bound page with a version
  check or creating a new page under a chosen parent.
- Publish a document split across an index and part files as a single page.
- Extract long code blocks, and everything under a configurable
  additional-materials heading, into separate files next to the page.
- Run without telemetry, reaching only the Confluence host taken from the link
  you paste.
- Support Restricted Mode.
