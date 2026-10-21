# Changelog

This file lists user-visible changes to Confluence to Markdown. The project
follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.10.1] - 2026-10-21

### Fixed

- **Ctrl+Shift+V** (Cmd+Shift+V on macOS) in the visual editor pastes plain
  text without the formatting of what you copied, instead of opening the
  Markdown preview or pasting with formatting.

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
