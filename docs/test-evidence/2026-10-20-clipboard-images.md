# Clipboard image local build — 2026-10-20

Target host: Zotero Desktop 10.0.6 on Windows. Current local build: `0.15.4-clipboard.3`.

## Build 3: continue below an image

The user confirmed screenshot pasting works, but an image-only preview had no obvious editing entry: the image and caption both open the attachment. Build 3 adds a Continue writing button at the end of the preview. It opens an empty append editor below the still-visible image. Saving joins the new draft to the untouched original Markdown with a paragraph separator; an empty draft makes no change.

The complete verification pipeline passed: 46 test files, 1,177 tests; TypeScript, documentation, build and packaging passed. Added controller-level popup/sidebar tests cover capture-event routing, CSS visibility, text order after saving, keyboard activation, unchanged empty drafts, failed-save retention, and another pasted image. The append flow has not yet been manually checked in the native Zotero UI.

## Implementation

- `clipboard-image.ts`: clipboard File extraction, raster type/size limits, stable Zotero image references, Markdown image rendering.
- `image-paste.ts`: asynchronous clipboard imports, insertion at the selection, pending status, error handling, and new-image thumbnails.
- `zotero-image-store.ts`: managed attachment imports in the document's library, scoped item-key lookup, bounded raster loading, and temporary-file cleanup.
- The adapter defers Escape/blur saves during imports and retains work if the popup is detached or plugin DOM is cleared.
- The normal image loader renders saved attachment references in sidebar and popup previews. It does not fetch these references from a network service.

## Automated verification

The build-2 `pnpm run verify` pipeline passed: 46 test files, 1,174 tests; TypeScript, documentation, build and XPI packaging passed. Regression cases also cover plugin cleanup during import, temporary-file cleanup failure, required manifest fields, and local-build automatic-update control.

Coverage includes PNG clipboard files in both item-list and file-list formats, selection insertion, sidebar and popup editors, deferred Escape/blur, detached popups, failed imports and retry, oversized and unsupported images, unchanged text paste behavior, saved-reference rendering, user/group library references, file permissions, cross-library rejection, linked-file rejection, missing attachments, and cleanup.

## Native-host verification boundary

The first build failed installation because `applications.zotero.update_url` was removed. The Zotero 10.0.6 `ExtensionData` loader explicitly requires that field. Build 2 restores it and disables background updates through `AddonManager.AUTOUPDATE_DISABLE`, with a pre-build manifest validator and regression tests.

The exact build-2 XPI was loaded in an isolated Zotero 10.0.6 profile. Its addon record reports `active: true`, `appDisabled: false`, `applyBackgroundUpdates: 0`, and version `0.15.4-clipboard.2`. The bootstrap log confirms successful startup and Reader event registration. SHA-256: `624609DDCF853E009D25BA3F16361495F5F521140C8F1836A624C011FEB3043B`.

The native test created a generated PDF, imported a generated PNG through the actual Zotero APIs, resolved the image by key, verified its parent and file, and loaded it as a data URL successfully. Synthetic clipboard-event validation did not complete: ordinary dispatch is not delivered to privileged listeners, and this Gecko build does not expose the older `dispatchDOMEventViaPresShell` API. Actual OS Ctrl+V and cross-device sync remain unverified. The user's regular library and plugin installation were not modified.

## Installation acceptance check

1. Install the local XPI through Zotero's plugin manager and enable the fast comment editor and page-popup Markdown rendering.
2. In a disposable annotation, type text, capture a screenshot, and paste with Ctrl+V. Check the thumbnail, then press Escape and check the full preview.
3. Close and reopen the PDF; confirm the image remains. Check that the screenshot attachment belongs to the same parent item as the PDF.
4. Paste and immediately click elsewhere; reopen the annotation and confirm the image reference was saved once.
5. Confirm ordinary text paste is unchanged. If using sync, sync both annotation metadata and image files to another desktop with this build installed.
6. In build 3, choose Continue writing under the image preview, enter a caption below the visible image, and press Escape. Confirm the caption appears after the image and remains after reopening the annotation. Repeat with another pasted screenshot; leaving an empty append field must preserve the original comment.

Images remain normal Zotero attachments. Deleting a Markdown reference does not delete the image. Native mobile readers and exported PDFs do not automatically embed these custom image previews.
