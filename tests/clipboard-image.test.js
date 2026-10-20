import { describe, expect, test, vi } from "vitest";
import { clipboardImages, parseImageAttachmentURL } from "../src/clipboard-image.ts";
import { createMarkdownRenderer } from "../src/markdown-renderer.ts";
import { createAnnotationSidebarAdapter } from "../src/annotation-sidebar-adapter.ts";
import { createLinkedImageLoader } from "../src/linked-image-loader.ts";
import { createReaderController } from "../src/reader-controller.ts";
import { readFileSync } from "node:fs";

const url = "zotero://select/library/items/ABCD1234";
const png = () => new File([new Uint8Array([137, 80, 78, 71])], "screenshot.png", { type: "image/png" });
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };

function openEditor(importImage, popup = false) {
  document.body.innerHTML = `<button id="outside">outside</button><div ${popup ? 'class="annotation-popup" data-annotation-id' : 'class="annotation selected" data-sidebar-annotation-id'}="NOTE1234"><div class="comment"><div class="content">before after</div></div></div>`;
  const commitComment = vi.fn(() => true);
  const adapter = createAnnotationSidebarAdapter({ document, importImage, commitComment, isFastEditorEnabled: () => true });
  adapter.tryShowFastEditorForAnnotationID("NOTE1234");
  const textarea = document.querySelector("textarea");
  textarea.focus();
  textarea.setSelectionRange(7, 7);
  return { adapter, textarea, commitComment };
}

function paste(textarea, files, text = "") {
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clipboardData", { value: { files, getData: () => text } });
  textarea.dispatchEvent(event);
  return event;
}

describe("clipboard images", () => {
  test.each([false, true])("continues below a visible image and preserves the original comment (popup=%s)", async popup => {
    vi.useFakeTimers();
    document.body.innerHTML = `<button id="outside">outside</button><div ${popup ? 'class="annotation-popup" data-annotation-id' : 'class="annotation selected" data-sidebar-annotation-id'}="NOTE1234"><div class="comment"><div class="content"></div></div></div>`;
    const source = `原有文字\n\n![Screenshot](${url})`;
    document.querySelector(".content").textContent = source;
    const commitComment = vi.fn(() => true);
    const adapter = createAnnotationSidebarAdapter({
      document, commitComment, isFastEditorEnabled: () => true,
      importImage: async () => url
    });
    const renderer = createMarkdownRenderer({ windowRef: window });
    const controller = createReaderController({
      reader: { document }, adapter, renderer,
      styleText: readFileSync("addon/styles/annotation-markdown.css", "utf8"),
      settings: { isEnabled: () => true, isPopupEnabled: () => true },
      MutationObserver: null, IntersectionObserver: null
    });
    await controller.start();
    try {
    const preview = document.querySelector(".annotation-markdown-rendered");
    const button = preview.querySelector(".annotation-markdown-append-comment");
    expect(button).not.toBeNull();
    // Exercise the controller's capture handler as well as the adapter.
    button.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
    vi.runAllTimers();
    const textarea = document.querySelector("textarea");
    expect(textarea.value).toBe("");
    expect(preview.hidden).toBe(false);
    expect(getComputedStyle(preview).display).not.toBe("none");
    expect(preview.nextElementSibling.contains(textarea)).toBe(true);
    textarea.focus();
    textarea.value = "图片下方的说明";
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(commitComment).toHaveBeenCalledExactlyOnceWith("NOTE1234", source + "\n\n图片下方的说明");
    vi.runAllTimers();
    expect(preview.textContent).toContain("图片下方的说明");
    expect(preview.querySelectorAll(".annotation-markdown-append-comment")).toHaveLength(1);
    // Keyboard activation works too. Leaving an untouched append field is a no-op.
    const nextButton = preview.querySelector(".annotation-markdown-append-comment");
    nextButton.focus();
    vi.runAllTimers();
    expect(document.querySelector("textarea")).toBeNull();
    nextButton.click();
    expect(document.querySelector("textarea").value).toBe("");
    adapter.closeActiveFastEditor();
    expect(commitComment).toHaveBeenCalledTimes(1);
    } finally {
      controller.stop();
      vi.useRealTimers();
    }
  });

  test("keeps an append draft after a failed save and supports another pasted image", async () => {
    const { adapter, commitComment } = openEditor(async () => url, true);
    adapter.closeActiveFastEditor();
    const node = document.querySelector(".comment");
    const source = `![Screenshot](${url})\n\n`;
    adapter.setCommittedSource(node, source);
    const renderer = createMarkdownRenderer({ windowRef: window });
    adapter.applyRenderedHtml(node, renderer.render(source));
    document.querySelector(".annotation-markdown-append-comment").click();
    const textarea = document.querySelector("textarea");
    textarea.focus();
    textarea.value = "caption";
    textarea.setSelectionRange(7, 7);
    paste(textarea, [png()]);
    await flush();
    commitComment.mockReturnValueOnce(false);
    adapter.closeActiveFastEditor();
    expect(document.querySelector("textarea")).toBe(textarea);
    expect(textarea.value).toContain("caption");
    adapter.closeActiveFastEditor();
    expect(commitComment).toHaveBeenLastCalledWith("NOTE1234", source + `caption\n\n![Screenshot](${url})\n\n`);
    adapter.clearRenderedState();
  });

  test("handles both browser clipboard items and file-list fallback without duplicates", () => {
    const file = png();
    expect(clipboardImages({ items: [{ kind: "file", type: file.type, getAsFile: () => file }], files: [file] })).toEqual([file]);
    expect(clipboardImages({ files: [file] })).toEqual([file]);
  });

  test.each([false, true])("inserts at the caret and waits for imports before Escape saves (popup=%s)", async popup => {
    let resolve;
    const importImage = vi.fn(() => new Promise(r => { resolve = r; }));
    const { adapter, textarea, commitComment } = openEditor(importImage, popup);
    expect(paste(textarea, [png()]).defaultPrevented).toBe(true);
    textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(commitComment).not.toHaveBeenCalled();
    expect(textarea.readOnly).toBe(true);
    resolve(url);
    await flush();
    expect(commitComment).toHaveBeenCalledExactlyOnceWith("NOTE1234", `before \n\n![Screenshot](${url})\n\nafter`);
    expect(document.querySelector("textarea")).toBeNull();
    adapter.clearRenderedState();
  });

  test("saves an imported image after the popup is removed during import", async () => {
    let resolve;
    const { textarea, commitComment } = openEditor(() => new Promise(r => { resolve = r; }), true);
    paste(textarea, [png()]);
    document.querySelector(".annotation-popup").remove();
    await flush();
    resolve(url);
    await flush();
    expect(commitComment).toHaveBeenCalledTimes(1);
    expect(commitComment.mock.calls[0][1]).toContain(url);
  });

  test("does not discard a pending image import when the plugin clears its editor", async () => {
    let resolve;
    const { adapter, textarea, commitComment } = openEditor(() => new Promise(r => { resolve = r; }));
    paste(textarea, [png()]);
    adapter.clearRenderedState();
    resolve(url);
    await flush();
    expect(commitComment).toHaveBeenCalledTimes(1);
    expect(commitComment.mock.calls[0][1]).toContain(url);
  });

  test("keeps the draft on failure, allows retry, and saves after blur", async () => {
    const importImage = vi.fn().mockRejectedValueOnce(new Error("Disk full")).mockResolvedValueOnce(url);
    const { adapter, textarea, commitComment } = openEditor(importImage);
    paste(textarea, [png()]);
    await flush();
    expect(textarea.value).toBe("before after");
    expect(textarea.readOnly).toBe(false);
    expect(document.querySelector('[role="status"]').textContent).toContain("Disk full");
    paste(textarea, [png()]);
    document.querySelector("#outside").focus();
    await flush();
    expect(commitComment).toHaveBeenCalledTimes(1);
    expect(commitComment.mock.calls[0][1]).toContain(url);
    adapter.clearRenderedState();
  });

  test("rejects large or SVG clipboard files without changing the draft; text paste remains native", () => {
    const importImage = vi.fn();
    const { adapter, textarea } = openEditor(importImage);
    paste(textarea, [new File(["<svg/>"], "x.svg", { type: "image/svg+xml" })]);
    const large = png();
    Object.defineProperty(large, "size", { value: 9 * 1024 * 1024 });
    paste(textarea, [large]);
    expect(importImage).not.toHaveBeenCalled();
    expect(textarea.value).toBe("before after");
    expect(paste(textarea, [], "hello").defaultPrevented).toBe(false);
    adapter.clearRenderedState();
  });

  test("renders saved attachment images after reopening, without broadening raw HTML or URL access", async () => {
    const renderer = createMarkdownRenderer({ windowRef: window });
    document.body.innerHTML = renderer.render(`![截图](${url})`);
    const image = document.querySelector("img");
    expect(image.getAttribute("data-annotation-markdown-image-src")).toBe(url);
    expect(image.hasAttribute("src")).toBe(false);
    const load = vi.fn().mockResolvedValue("data:image/png;base64,iVBORw==");
    const loader = createLinkedImageLoader({ load });
    loader.observe(document.body);
    await flush();
    expect(image.src).toBe("data:image/png;base64,iVBORw==");
    loader.stop();
    expect(parseImageAttachmentURL("file:///C:/private.png")).toBeNull();
    expect(parseImageAttachmentURL("zotero://select/library/items/ABCD1234?path=secret")).toBeNull();
    expect(renderer.render('<img src="file:///secret" onerror="alert(1)">')).not.toContain("<img");
    expect(renderer.render("![x](javascript:alert(1))")).not.toContain("<img");
  });
});
