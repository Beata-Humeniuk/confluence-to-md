# Publishing pages

This guide explains page bindings, split documents, conversion behavior, and
round-trip limitations.

## Page binding

A `confluence:` front matter block binds a Markdown file to a Confluence page.
Downloaded files receive one automatically:

```yaml
---
confluence:
  url: https://example.atlassian.net/wiki/spaces/DOC/pages/123456
  version: 7
type: confluence-page
generator: confluence-to-md@1.0.0
generated: 2026-08-13
sourceId: 123456
space: DOC
managed: true
---
```

- **A bound file** has a `confluence:` block. Publishing updates that page.
  The extension compares versions first and asks before overwriting a newer
  page, then stores the published version in the file.
- **An unbound file** has no `confluence:` block. Publishing creates a page
  under the parent whose link you provide, then adds the binding to the file.

Existing front matter is metadata, not page content. The extension preserves
its keys and adds a new binding to the same block when needed.

The first `#` heading becomes the page title and is removed from the published
body. If there is no level-one heading, the filename is used.

## Split documents

An index can link to files in a `sections/` or `parts/` folder. Publishing the
index combines declared part files into one Confluence page.

A part is included only when both conditions are met:

1. The index contains a list item made only of a link to the neighboring
   Markdown file, for example `1. [Title](sections/file.md)` or
   `- [Title](parts/file.md)`.
2. The linked file declares `type: <artifact>-part` or `parent:` in its front
   matter.

This prevents ordinary lists of Markdown links from being expanded.

When parts are combined:

- the list is replaced with the parts in list order;
- a heading used only for that list is removed, while a heading with other
  content remains;
- links between parts become heading anchors;
- each part's front matter is omitted.

If a part is missing, the extension asks whether to continue. When you
continue, its list item remains as a link. You can also publish an individual
part by opening that file and running the publish command.

## Publishing a file you name

The publish command also accepts a Markdown file to publish, read from disk
instead of from the active editor. Everything above applies to it unchanged.
Other extensions use this to delegate publishing; see the API section in the
[README](../README.md#api-for-other-extensions).

## Conversion

### Confluence to Markdown

Downloaded pages use Confluence `export_view` HTML, where macros are already
rendered. [Turndown](https://github.com/mixmark-io/turndown) and its GFM plugin
convert that HTML, with extra rules for:

- code blocks and their languages;
- tables and strikethrough;
- task lists;
- Confluence page links and images;
- info, note, warning, and tip panels as plain blockquotes.

Any `ac:` and `ri:` macros that reach the converter unrendered are turned into
HTML first, so an unknown macro keeps its text when possible.

### Markdown to Confluence

[markdown-it](https://github.com/markdown-it/markdown-it) renders Markdown as
Confluence storage format. Code blocks become `code` macros, task lists become
native Confluence tasks, and `[text](confluence:KEY/Title)` becomes a native
page link that remains valid after a title change. Other URLs are published as
plain links.

## Round-trip limitations

Downloading uses rendered HTML, so download → edit → publish cannot preserve
features that Markdown cannot represent.

| Preserved | Lost or simplified |
|---|---|
| Headings and inline formatting | Panels become plain blockquotes |
| Code blocks with languages | Images are omitted or become attachment links |
| Tables | TOC and similar macros are removed |
| Lists, including task lists | Layouts and unknown macros keep only their text |
| Links | |

Confluence TOC macros produce links to Confluence-specific anchors. During
downloading, the extension matches those links to headings and rewrites them
Markdown preview anchors. Links with no matching heading remain unchanged.
