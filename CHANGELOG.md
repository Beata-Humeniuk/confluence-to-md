# Changelog

This file lists user-visible changes to Confluence to Markdown. The project
follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Downloading asks for an optional subfolder inside the download folder, such
  as `services/account`. Missing folders are created. Turn the question off
  with `confluenceToMd.askSubfolder`.

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
