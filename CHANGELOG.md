# Changelog

This file lists user-visible changes to Confluence to Markdown. The project
follows [Semantic Versioning](https://semver.org/).

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
