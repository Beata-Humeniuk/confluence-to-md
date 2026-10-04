# API for other extensions

Another extension can hand a Markdown file to this one instead of talking to
Confluence itself. Write the file to disk, then run the publish command on it:

```js
const ext = vscode.extensions.getExtension('beatahumeniuk.confluence-to-md');
if (ext) {
  const result = await vscode.commands.executeCommand('confluenceToMd.publishPage', mdFileUri);
}
```

`confluenceToMd.publishPage` takes an optional `vscode.Uri` of a Markdown file:

- **with a URI** — that file is published, read from disk. It does not have to
  be open anywhere, and the active editor is left alone.
- **without a URI** — the active editor is published, exactly as when the
  command is run from the Command Palette.

The file is treated the same way either way: a `confluence:` block updates its
page after the remote-change check, a file without one creates a page under the
parent you are asked for, split documents are assembled into a single page, and
the resulting binding is written back to the file. Prompts still appear when
they are needed — for the token, the parent page, or a page that changed in
Confluence — so call this only where a person can answer them.

| Outcome | Result |
|---|---|
| Published | `{ url: string, pageId: string, action: "created" \| "updated" }` |
| A prompt was cancelled | `undefined` |
| Failed | Rejects with an `Error`; `message` is ready to show to the user |

The error popup belongs to the interactive path only. A caller that passes a
URI gets the rejection and shows its own message.

The command id and this result shape are stable across versions.

`getExtension` returning `undefined` means this extension is not installed and
Confluence publishing is not available. Hide or disable the action in that case
rather than offering one that cannot run.
