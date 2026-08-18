# Changelog

This file lists user-visible changes to Confluence to Markdown. The project
follows [Semantic Versioning](https://semver.org/).

## [1.1.0] - 2026-08-18

### Added

- Programmatic API: other VS Code extensions can now invoke
  `confluenceToMd.publishPage` with a file URI to publish markdown files
  without requiring user interaction with an active editor. The command returns
  `{ url, pageId, action }` or rejects with an error.

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
