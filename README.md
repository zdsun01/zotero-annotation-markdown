# Zotero Annotation Markdown — Images & Tables Edition

English | [简体中文](README.zh-CN.md)

Paste screenshots and tables directly into Zotero annotation comments, then keep writing below the preview.

This modified version is maintained by [zdsun01](https://github.com/zdsun01). It builds on **[Zotero Annotation Markdown](https://github.com/qrkks/zotero-annotation-markdown)** by **[qrkks](https://github.com/qrkks)**. The original author and contributors developed the Markdown renderer, math support, fast editor and other underlying features. This repository adds clipboard images, table conversion and an entry for continuing below previews. It is an independently maintained derivative, not an official upstream release.

Current version: **`0.15.4-clipboard.7`**. Development targets **Zotero 10.0.6 on Windows**.

## Added in this version

| Feature | What it does |
| --- | --- |
| Paste screenshots | Press **Ctrl+V** in an annotation comment to import a screenshot as a managed Zotero image attachment and insert its Markdown reference. |
| Continue below previews | Choose **Continue writing…** below an image or table to open a text field while keeping the preview visible. |
| Paste tables | Convert a copied Excel, Word or webpage HTML table into editable Markdown. Rectangular tab-separated text is also supported. |
| Read formatted tables | Save to show table borders and horizontal scrolling for wide tables. |
| Keep drafts during imports | Wait for image imports before saving on Escape or blur; retain the draft when saving fails. |
| Delete a selected annotation | Repair the Delete shortcut when the preview has left keyboard focus in the hidden original comment editor. Text editing keeps its normal Delete behavior. |

The upstream Markdown, LaTeX, outline, color highlights and optional SVG functionality remain available. See the [user guide](docs/en/user-guide.md).

## Build and install

The source in **this repository** contains the additions above. The upstream marketplace package and upstream releases do not include these changes.

Use Node.js 24 and the pnpm version specified in `package.json`:

```powershell
git clone https://github.com/zdsun01/zotero-annotation-markdown.git
cd zotero-annotation-markdown
pnpm install --frozen-lockfile
pnpm run package
```

1. The build produces `dist/zotero-annotation-markdown.xpi`.
2. In Zotero, open **Tools → Plugins** and install that XPI, then restart Zotero.
3. In the plugin settings, enable **Use the fast annotation comment editor** and **Render page annotation popups as Markdown**.

This build uses the same add-on ID as upstream and replaces it when installed. Automatic upstream updates are disabled for `-clipboard.` builds to keep these modifications installed. Installing an official upstream XPI restores the upstream version; you can then re-enable automatic updates in the plugin manager.

## Usage

### Text formatting shortcuts

In the fast comment editor, select text and use **Ctrl+B** for bold, **Ctrl+U** for underline, **Ctrl+Shift+Plus** for superscript, or **Ctrl+Shift+Minus** for subscript. Cmd also works as the primary modifier. Repeat the shortcut to remove the matching surrounding format. Without a selection, it inserts a marker pair with the caret inside, ready for typing. Multi-line selections are formatted line by line.

The editor shows source: `**bold**`, `<u>underline</u>`, `<sup>superscript</sup>` and `<sub>subscript</sub>`. Press Escape to save and see the formatted preview. Only these balanced, attribute-free inline tags are supported; arbitrary HTML remains disabled. This also works in the Continue writing field below images and tables.

### Screenshots and continued writing

1. Copy a screenshot, click an annotation comment and press **Ctrl+V**.
2. Wait for the image to finish saving. Press **Escape** or click elsewhere to save and preview.
3. Choose **Continue writing…** below the preview to add text, another image or a table.
4. Press **Escape** or click elsewhere to save the appended content.

Images are stored as ordinary Zotero attachments beside the PDF under its parent item, or at library level for a standalone PDF. Comments store stable attachment references. File sync follows your Zotero settings; another computer needs this modified plugin and the downloaded attachments. Deleting a comment's image reference does not delete the attachment. Native mobile readers and exported PDFs do not automatically embed these previews.

Supported screenshot formats: PNG, JPEG, GIF and WebP, up to **8 MiB per image**.

### Tables

Copy one table from Excel, Word or a webpage, paste into the comment editor, then press **Escape** to preview it. If the clipboard provides both an HTML table and its screenshot, the editable table takes priority. Plain TSV needs at least two rows and two columns with consistent widths.

- The first row becomes the header. Text and grid positions are retained.
- Merged cells expand into ordinary grid cells; text stays in the top-left cell.
- Cell line breaks display as `⏎`. Font styling, colors, embedded images and spreadsheet calculations are not retained.
- Limits: **200 rows, 50 columns and 2,000 grid cells**. Multiple/nested tables and selections mixing prose with a table are not converted.

The full editor uses Markdown source. This version is not a complete WYSIWYG editor.

### Delete an annotation

Select the annotation and press **Delete** while viewing its preview, with the context menu closed. This deletes the entire annotation, matching the menu's Delete command; it does not merely clear the comment or remove one image. While a visible text editor is active, Delete edits text. Deletion uses Zotero's command and undo history. Screenshot attachments remain in the library.

Since `0.15.4-clipboard.6`, selecting an underline on the PDF and receiving automatic focus in its empty comment field also preserves Zotero's Delete action: before any typing or pasting, **Delete removes the underline annotation**. Existing comments, append fields, and fields where input has already started keep text-editing behavior, even if you clear the draft again.

## Validation and feedback

`pnpm run verify` passed **50 test files / 1,285 tests**, TypeScript, documentation checks, build and packaging. Screenshot pasting was confirmed by the user on Zotero 10.0.6. The append, table, formatting and Delete fallback workflows have automated coverage; native formatting shortcuts and undo, Delete, table Ctrl+V from each source application and cross-device sync still need manual validation. Zotero 9 remains in the inherited compatibility declaration but has not been verified for these additions.

Report problems with this modified version in [this repository's Issues](https://github.com/zdsun01/zotero-annotation-markdown/issues), including your Zotero version, plugin version and reproduction steps. Please use a non-sensitive example table or annotation.

## Documentation and attribution

- [User guide](docs/en/user-guide.md)
- [Architecture](docs/en/architecture.md) and [development guide](docs/en/development.md)
- [Change log](CHANGELOG.md)
- [Image verification notes](docs/test-evidence/2026-10-20-clipboard-images.md) and [table verification notes](docs/test-evidence/2026-10-20-clipboard-tables.md)
- **Original author:** [qrkks](https://github.com/qrkks)
- **Upstream project:** [qrkks/zotero-annotation-markdown](https://github.com/qrkks/zotero-annotation-markdown)
- **Upstream starting revision:** [`d203ea5`](https://github.com/qrkks/zotero-annotation-markdown/commit/d203ea5)
- **Modified version maintainer:** [zdsun01](https://github.com/zdsun01)

Thanks to the upstream author and contributors for the foundation. Existing demonstration images and upstream documentation retained in this repository originate from that project.

## License

The current project retains **[AGPL-3.0-or-later](LICENSE)** and the original **Copyright (c) 2026 qrkks** notice. See [NOTICE](NOTICE) for the original notice and this version's modification attribution.

Upstream releases through v0.15.4 were distributed under MIT; their [historical MIT notice](licenses/MIT-legacy.txt) is preserved. It is not an alternative license for this current revision. Third-party components retain their own licenses. Packaged XPIs include license notices and the matching project and dependency source snapshot, described in `SOURCE.txt` inside the XPI.
