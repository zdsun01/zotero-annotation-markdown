# Clipboard tables — local build 0.15.4-clipboard.4

Target: Zotero Desktop 10.0.6, Windows.

Full `pnpm run verify` passed: 47 test files, 1,198 tests, TypeScript, documentation checks, build and XPI packaging.

`src/table-paste.ts` converts a single inert clipboard HTML table or rectangular quoted TSV into Markdown. It runs before the screenshot handler so Office's image representation does not replace editable cells. The conversion also works when image import is unavailable. Only text is extracted; copied HTML is never mounted in the Reader.

Limits: 2 MiB input, 200 rows, 50 columns, 2,000 expanded grid cells. First row is the header, merged cells use empty placeholders, cell newlines become `⏎`. Mixed prose/table selections and multiple/nested tables retain native paste behavior.

Automated coverage in `tests/table-paste.test.js` includes HTML fragments, entities, spans, captions, multiline and quoted TSV, empty cells, punctuation protected from Markdown/math interpretation, unsafe HTML discarded, bounds and unsupported input. Controller tests cover sidebar/popup replacement at selection, table-over-image precedence, save and rerender, horizontal-scrollbar entry protection, and continuing below the table. Clipboard image regressions run alongside these tests.

Native Ctrl+V from Excel/Word/browser into Zotero has not been manually verified for this build. Acceptance: copy a small table, paste in a disposable annotation, press Escape, reopen, and verify values and cell order. Check horizontal scrolling on a wide table and append a caption and screenshot below it.
