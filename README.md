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
3. Choose which linked pages to download too.

Each page is saved as a separate file with its Confluence binding. Child pages
follow the Confluence page tree, and links between saved pages become relative
Markdown links.

See [Downloading pages](docs/DOWNLOADING.md) for save locations, link handling,
images, and extracted code samples.

## Publish a page

Open a Markdown file and run **Confluence: Publish Page**.

- A file with a `confluence:` front matter block updates its bound page. The
  extension checks for newer changes before overwriting it.
- A file without a binding creates a page under the parent whose link you
  provide. The new binding is added to the file.

See [Publishing pages](docs/PUBLISHING.md) for the binding format, split
documents, conversion details, and round-trip limitations.

## Settings

| Setting | Default | Purpose |
|---|---|---|
| `confluenceToMd.token` | — | Confluence token for all instances. |
| `confluenceToMd.email` | — | Atlassian account e-mail. Cloud only. |
| `confluenceToMd.downloadFolder` | *(empty)* | Save location. Empty uses the active file's folder. |
| `confluenceToMd.followLinks` | `true` | Offer to download linked pages. |
| `confluenceToMd.images` | `skip` | `skip` omits images; `link` keeps attachment links. |
| `confluenceToMd.appendixHeading` | `Additional materials` | Extract code below a heading. Empty disables the rule. |

The token is stored in VS Code settings, which may be synced or shared.
Restricted Mode is supported.

## Installation and support

Install **Confluence to Markdown** from the Visual Studio Code Marketplace, or
download a `.vsix` from [GitHub Releases](https://github.com/Beata-Humeniuk/confluence-to-md/releases)
and run **Extensions: Install from VSIX**.

Report bugs in [GitHub Issues](https://github.com/Beata-Humeniuk/confluence-to-md/issues).
For security issues, follow the [security policy](SECURITY.md).

[MIT License](LICENSE) · [Changelog](CHANGELOG.md)
