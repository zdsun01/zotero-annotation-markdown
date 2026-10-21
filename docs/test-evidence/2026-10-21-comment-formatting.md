# Comment formatting — 0.15.4-clipboard.7

Fast editor shortcuts insert or remove Markdown / restricted inline format markers. Ctrl+B uses bold, Ctrl+U underline, Ctrl+Shift+Plus superscript, Ctrl+Shift+Minus subscript. Shifted Equal/Minus key values, numpad and Cmd variants are recognized. Native unshifted zoom shortcuts, Alt combinations and IME composition are left alone. Read-only fields and repeat events do not alter drafts.

The renderer accepts only balanced, attribute-free u/sup/sub tags with bounded nesting. Markdown within these tags is parsed normally. Arbitrary HTML remains disabled; attributes, code fences, inline code and escaped tags have regression coverage.

Tests cover selection/caret placement, repeat-to-remove, multiline formatting, host insertion path, controller save/rerender, mixed bold and underline, nested tags/math/code, unsupported HTML and existing deletion regressions. Native Zotero keyboard and undo behavior have not yet been manually verified.

`pnpm run verify` passed on 2026-10-21: 50 test files, 1,285 tests, TypeScript, bilingual documentation checks, build and XPI packaging.
