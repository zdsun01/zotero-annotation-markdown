import { clipboardImages, validateClipboardImage } from "./clipboard-image.js";

/** The fast editor owns the draft until every asynchronous import has settled. */
export function installImagePaste({ textarea, editor, importImage, settled }: {
  textarea: HTMLTextAreaElement;
  editor: HTMLElement;
  importImage(file: Blob): Promise<string>;
  settled(success: boolean): void;
}): { isPending(): boolean } {
  let pending = false;
  const doc = textarea.ownerDocument;
  const status = doc.createElement("div");
  status.className = "annotation-markdown-paste-status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  const thumbnails = doc.createElement("div");
  thumbnails.className = "annotation-markdown-pasted-images";
  editor.append(status, thumbnails);

  textarea.addEventListener("paste", event => {
    const files = clipboardImages(event.clipboardData);
    if (!files.length) return; // Preserve native text paste and its undo history.
    event.preventDefault();
    event.stopImmediatePropagation();
    if (pending) return;
    try { files.forEach(validateClipboardImage); }
    catch (error) { status.textContent = String((error as Error).message); return; }
    pending = true;
    textarea.readOnly = true;
    editor.setAttribute("aria-busy", "true");
    status.textContent = "Saving screenshot… / 正在保存截图…";
    let start = textarea.selectionStart;
    let end = textarea.selectionEnd;
    void (async () => {
      let success = false;
      try {
        for (const file of files) {
          const url = await importImage(file);
          const markdown = `\n\n![Screenshot](${url})\n\n`;
          textarea.setRangeText(markdown, start, end, "end");
          start = end = textarea.selectionEnd;
          textarea.dispatchEvent(new doc.defaultView!.InputEvent("input", {
            bubbles: true, inputType: "insertFromPaste", data: markdown
          }));
          const reader = new doc.defaultView!.FileReader();
          reader.onload = () => {
            if (!editor.isConnected) return;
            const image = doc.createElement("img");
            image.src = String(reader.result);
            image.alt = "Pasted screenshot / 已粘贴截图";
            thumbnails.append(image);
          };
          reader.readAsDataURL(file);
        }
        status.textContent = "Continue typing, or press Escape to preview. / 可继续输入文字；按 Esc 预览后也可点击图片下方的「继续输入文字」。";
        success = true;
      } catch (error) {
        status.textContent = `Paste failed / 粘贴失败：${(error as Error).message}`;
      } finally {
        pending = false;
        textarea.readOnly = false;
        editor.removeAttribute("aria-busy");
        settled(success);
      }
    })();
  });
  return { isPending: () => pending };
}
