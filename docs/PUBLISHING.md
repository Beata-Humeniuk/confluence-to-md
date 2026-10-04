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
---
```

- **A bound file** has a `confluence:` block. Publishing updates that page.
  The extension compares versions first and asks before overwriting a newer
  page, then stores the published version in the file. See
  [Changes made by someone else](#changes-made-by-someone-else).
- **An unbound file** has no `confluence:` block. Publishing creates a page
  under the parent whose link you provide, then adds the binding to the file.

Existing front matter is metadata, not page content. The extension preserves
its keys and adds a new binding to the same block when needed.

The first `#` heading outside a code block becomes the page title and is
removed from the published body. If there is no level-one heading, the
filename is used.

## Changes made by someone else

Before updating a page, the extension compares the page's current version with
the version stored in the file. If they differ, or the file stores no version,
the page may hold changes your file does not have, and the extension asks what
to do:

- **Compare** opens a diff with the page as it is in Confluence on the left and
  your file on the right. Nothing is published. Bring the changes you want to
  keep into your file, then publish again and choose **Overwrite**.
- **Overwrite** publishes your file as the next page version. Changes made in
  Confluence since your version remain only in the page history.
- **Cancel** does nothing.

If someone publishes between the check and your update, Confluence rejects
the update with a version conflict and the page is left unchanged.

## Publish from the preview

The Markdown preview of a bound file shows **↑ Publish** next to **↻ Pull** in its
top right corner. Publish asks for confirmation, saves unsaved edits, and then
publishes the file as described above, including the check for newer changes
in Confluence. Like Pull, it only acts on a file that is open in VS Code.

## Split documents

An index can link to part files in a subfolder next to it. Publishing the
index combines the declared parts into one Confluence page.

A part is included only when both conditions are met:

1. The index contains a list item made only of a link to the neighboring
   Markdown file, for example `1. [Title](sections/file.md)` or
   `- [Title](steps/file.md)`.
2. The linked file declares `type: <anything>-part` or `parent:` in its front
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
Other extensions use this to delegate publishing; see
[API for other extensions](API.md).

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

### Mermaid diagrams

Confluence has no built-in Mermaid support, so diagrams need a Mermaid app from
the Atlassian Marketplace. A ` ```mermaid ` block is published as the macro
named in `confluenceToMd.mermaidMacro` (default `mermaid-macro`), with the
diagram source as its body, so Confluence draws the diagram.

To check the name your app uses, insert a Mermaid macro on a page, open
**••• → View Storage Format**, and read `ac:name` in
`<ac:structured-macro ac:name="…">`. Set the setting to an empty value to
publish diagrams as plain code blocks instead.

Set `confluenceToMd.mermaidVersion` to the Mermaid version of the app in
Confluence. Versions older than 10.3.1 reject some labels that newer ones
accept, such as `A[a; b]` or `A -->|x → y| B`. For those versions, publishing
puts flowchart labels in quotes, which every version accepts:

```text
A[a; b] -- c --> B{d}      →      A["a; b"] -->|"c"| B{"d"}
```

Your Markdown file is not changed, but a page downloaded later contains the
quoted labels. Set a newer version, or leave the setting empty, to publish
diagrams unchanged.

Downloading and pulling work the other way round: any macro whose name
contains `mermaid` becomes a ` ```mermaid ` block again. The rendered page does
not include the diagram source, so the extension reads it from the storage
format and asks Confluence to render the rest of the page. If Confluence
refuses that request, the page is converted as before and the diagrams are
omitted.

## Round-trip limitations

Downloading uses rendered HTML, so download → edit → publish cannot preserve
features that Markdown cannot represent.

| Preserved | Lost or simplified |
|---|---|
| Headings and inline formatting | Panels become plain blockquotes |
| Code blocks with languages | Images are omitted or become attachment links |
| Mermaid diagrams (with a Mermaid app) | |
| Tables | TOC and similar macros are removed |
| Lists, including task lists | Layouts and unknown macros keep only their text |
| Links | |

Confluence TOC macros produce links to Confluence-specific anchors. During
downloading, the extension matches those links to headings and rewrites them
Markdown preview anchors. Links with no matching heading remain unchanged.
