# Empty underline comment Delete — 0.15.4-clipboard.6

The user clarified that the failing case is a PDF underline with its empty comment field automatically focused, rather than a populated rendered preview.

Full verification passed: 49 test files / 1,253 tests, TypeScript, documentation checks, build and XPI packaging.

The installed Zotero 10.0.6 Reader sets `_enableAnnotationDeletionFromComment` after page selection of an empty underline/highlight/note/image, then focuses `.comment .content`. The plugin fast-editor guard set this flag to false to protect text input, unintentionally suppressing native deletion for this empty state too.

The adapter now captures an eligible deletion callback before starting the guard. Unmodified Delete can invoke it only while the original comment and current draft are empty, no input/paste/composition has occurred, and the editor is active. The callback revalidates saved content, selected ID, permissions, annotation type and context-menu state before using the native deletion command. Append fields and existing comments never arm the callback. Native read-only/external and multi-selection safeguards remain in place.

Tests cover popup and sidebar empty underline editors, real controller automatic focus, native capture-handler ordering, exactly one deletion, no comment writes, guard cleanup, changed selection, synced comments, failed deletion, typed-then-cleared drafts, paste/composition, pending screenshot import and modified/repeated keys. The native UI keyboard path still needs manual acceptance in Zotero; development did not delete any real library annotation.
