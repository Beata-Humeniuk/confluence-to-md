# Confluence to Markdown

Download Confluence pages as Markdown, edit them in VS Code, and publish them
back. The extension works with Confluence Cloud and Server/Data Center.

**No telemetry.** The extension connects only to the Confluence host in the
link you provide. No Confluence addresses are built into the code.

## Setup

Add your credentials in the extension settings:

- **Cloud:** set `confluenceToMd.token` to an
  [Atlassian API token](https://id.atlassian.com/manage-profile/security/api-tokens)
  and `confluenceToMd.email` to your Atlassian account e-mail.
- **Server/Data Center:** set `confluenceToMd.token` to a Personal Access Token
  from your Confluence profile.

You do not need to configure an instance address. The extension reads the
host, context path, and Confluence type from each link, so you can work with
multiple instances. If no token is set, the extension offers to open the
settings.

## Download pages

1. Run **Confluence: Download Page**.
2. Paste the full page link. Cloud, Server/Data Center, short `/x/...` links,
   context paths, and non-standard ports are supported.
3. Optionally type a subfolder, for example `services/account`. It is created
   inside the download folder if it does not exist. Leave it empty to save in
   the download folder itself.
4. Choose which linked pages to download too.

Each page is saved as a separate file with its Confluence binding. Child pages
follow the Confluence page tree, and links between saved pages become relative
Markdown links.

See [Downloading pages](docs/DOWNLOADING.md) for save locations, link handling,
images, and extracted code samples.

## Update a page from Confluence

A downloaded file can be refreshed from Confluence, like `git pull`. Open the
Markdown preview: a file bound to a page shows a small **↻ Pull** button in its
top right corner. You can also run **Confluence: Pull Page** in the editor.

The extension compares versions first. If the file is up to date, nothing
changes. Otherwise it asks before replacing the file content with the current
page, because edits you have not published are lost. **Compare** shows the
differences first without changing the file.

See [Downloading pages](docs/DOWNLOADING.md#update-a-downloaded-page) for
details.

## Publish a page

Open a Markdown file and run **Confluence: Publish Page**. For a bound file you
can also click **↑ Publish** in the top right corner of the Markdown preview; it
asks first and saves unsaved edits before publishing. A file without a binding
shows **↑ Publish to Confluence** there instead, which asks for the parent page.

- A file with a `confluence:` front matter block updates its bound page. If
  someone changed the page since your version, the extension asks first and
  offers **Compare**, which shows their changes next to your file.
- A file without a binding creates a page under the parent whose link you
  provide. The new binding is added to the file.
- Links to other Markdown files point at their Confluence pages. Linked files
  that are not in Confluence yet can be published in the same step, as pages
  under the page that links to them.

See [Publishing pages](docs/PUBLISHING.md) for the binding format, split
documents, conversion details, and round-trip limitations.

## Settings

| Setting | Default | Purpose |
|---|---|---|
| `confluenceToMd.token` | — | Confluence token for all instances. |
| `confluenceToMd.email` | — | Atlassian account e-mail. Cloud only. |
| `confluenceToMd.downloadFolder` | *(empty)* | Save location. Empty uses the active file's folder. |
| `confluenceToMd.askSubfolder` | `true` | Ask for an optional subfolder when downloading. |
| `confluenceToMd.followLinks` | `true` | Offer to download linked pages. |
| `confluenceToMd.images` | `skip` | `skip` omits images; `link` keeps attachment links. |
| `confluenceToMd.appendixHeading` | `Additional` | Extract code below a heading. Empty disables the rule. |
| `confluenceToMd.mermaidMacro` | `mermaid-macro` | Macro for ` ```mermaid ` blocks. Empty publishes them as code. See [Mermaid diagrams](docs/PUBLISHING.md#mermaid-diagrams). |
| `confluenceToMd.mermaidVersion` | `9.2.2` | Mermaid version of the Confluence app. Empty publishes diagrams unchanged. |

The token is stored in VS Code settings, which may be synced or shared.
Restricted Mode is supported.
