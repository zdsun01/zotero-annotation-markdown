# Delete shortcut — 0.15.4-clipboard.5

Target: Zotero 10.0.6 on Windows. User requests the same whole-annotation deletion as the annotation menu, not clearing comment text alone.

Full `pnpm run verify` passed: 48 test files / 1,226 tests, TypeScript, documentation checks, build and packaging.

Inspection of the installed `app/omni.ja` / `resource/reader/reader.js` shows that `KeyboardManager` returns without deleting when the event targets `.content` and the selected annotation has a nonempty comment. A focus retained in a plugin-hidden source editor therefore cannot use native Delete while the preview is displayed.

The fallback listener runs after Zotero's existing window capture listener. It handles only unmodified, nonrepeating Delete on the focused `.content` inside a plugin-hidden source with a visible rendered preview. The host bridge rechecks that exactly the same single annotation is selected and editable, then calls `reader._internalReader.deleteAnnotations`, the same command as the native menu. It does not erase stored Zotero items directly or delete screenshot attachments.

Regression coverage models the installed keyboard gate, sidebar and popup previews, event default prevention, editor protection, modifier/composition/repeat rejection, menus/dialogs, matching selection, read-only/external annotations, failed commands, plugin registration and shutdown. Native UI reproduction and keyboard deletion on a disposable annotation still require manual verification; no real user annotation was deleted during development.
