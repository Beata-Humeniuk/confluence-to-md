# Downloading pages

This guide explains where downloaded pages are saved and how the extension
handles links, images, and code samples.

## Supported links

Paste a full page link in any of these forms:

| Link form | Source |
|---|---|
| `https://.../wiki/spaces/KEY/pages/123456/Title` | Cloud |
| `https://.../pages/viewpage.action?pageId=123456` | Server/Data Center |
| `https://.../display/KEY/Page+title` | Server/Data Center |
| `https://.../pages/123456/...` | Any link containing a page ID |
| `https://.../x/AbCdEf` | Short link; resolved through its redirect |

Context paths such as `/confluence/` and non-standard ports are supported.

## Save location

By default, pages are saved next to the active file. If no file is open, the
workspace root is used. Change `confluenceToMd.downloadFolder` to use another
location:

| Value | Save location |
|---|---|
| *(empty)* | Active file's folder, or the workspace root |
| `docs/wiki` | Path relative to the workspace root |
| `~/notes/confluence` or `/srv/wiki` | Absolute path |

You can set this value per workspace in `.vscode/settings.json`. The folder is
created only when a page is saved.

## Page tree

Downloaded child pages mirror the Confluence page tree when their parent is
already in the target folder or is downloaded at the same time. Missing ancestors
do not create empty folder levels.

```text
confluence/
├── handbook.md
└── handbook/
    ├── user-guide.md
    └── user-guide/
        └── faq.md
```

Downloading a page again overwrites its existing file without moving it or creating
a duplicate. The extension identifies pages by `sourceId`, not by filename.

## Links

The extension treats the target folder as one collection and reads only files
with a front matter block. Hand-written Markdown files without front matter
are not changed.

on each download, it:

- converts links between saved pages to relative `.md` links;
- updates older downloaded files that link to pages downloaded now;
- shows pages already on disk as unchecked in the linked-page picker;
- leaves external links and links to other Confluence instances unchanged.

Pages are matched by ID. A title is used only for `/display/KEY/Title` links,
which contain no ID. Storage-format `confluence:` links, relative links, and
absolute links to the same instance are all recognized.

Links that still point to Confluence remain usable in a downloaded file:

- clicking `[text](confluence:KEY/Title)` downloads and opens the page, using the
  instance stored in the active file's front matter;
- clicking a relative Confluence link such as `/wiki/spaces/...` opens it in
  the browser on that instance.

## Images

`confluenceToMd.images` controls how downloaded images are handled:

- `skip` (default) omits them;
- `link` keeps a link such as
  `![diagram.png](https://.../download/attachments/...)`.

The Markdown preview usually cannot display a linked attachment because it
requires an authenticated Confluence session, but the link remains available.

## Extracted code samples

To keep pages readable, the extension moves code blocks longer than 30 lines
to a sibling `<page>.samples/` folder and replaces each block with a link.

```text
docs/confluence/
├── service-api.md
└── service-api.samples/
    └── catalogue-export.xml
```

The filename comes from the nearest heading, or from a preceding bold line if
the source uses bold text as a heading. The extension comes from the code
block's language.

You can also extract every code block in a final reference section, regardless
of length. Name that section with `confluenceToMd.appendixHeading` (default:
`Additional materials`):

```markdown
## Additional materials

<!-- appendix: full-length reference examples, extracted to separate files;
open them only when the examples in the main content are not enough -->

[full-response.json](page.samples/full-response.json)
```

The comment is hidden in the Markdown preview and tells readers when the
separate samples are worth opening.

Heading matching is case-insensitive. An empty setting disables this rule but
keeps the 30-line threshold. Give each sample its own subheading so it gets a
meaningful filename.

Downloading again overwrites extracted samples but does not delete files for samples
removed from Confluence; remove those files manually.
