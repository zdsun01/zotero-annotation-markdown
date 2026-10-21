import { afterEach, describe, expect, test, vi } from "vitest";
import { createAnnotationSidebarAdapter } from "../src/annotation-sidebar-adapter.ts";
import { beginReaderFastEditorKeyboardGuard, prepareReaderEmptyAnnotationDeletion, createPlugin } from "../src/plugin.ts";

let cleanup = () => {};
afterEach(() => { cleanup(); cleanup = () => {}; vi.useRealTimers(); document.body.innerHTML = ""; });

function fixture({ source = "", fromPage = true, armed = true, popup = true, type = "underline" } = {}) {
  document.body.innerHTML = `<div ${popup ? 'class="annotation-popup" data-annotation-id' : 'class="annotation selected" data-sidebar-annotation-id'}="A1"><div class="comment"><div class="content" tabindex="0"></div></div></div>`;
  document.querySelector(".content").textContent = source;
  const host = {
    _state: { readOnly: false, selectedAnnotationIDs: ["A1"], annotations: [{ id: "A1", type, comment: source }] },
    _enableAnnotationDeletionFromComment: armed,
    _annotationSelectionTriggeredFromView: fromPage,
    deleteAnnotations: vi.fn(() => 1)
  };
  const reader = { _internalReader: host };
  const commitComment = vi.fn(() => true);
  const adapter = createAnnotationSidebarAdapter({
    document, isFastEditorEnabled: () => true, commitComment,
    prepareEmptyAnnotationDeletion: id => prepareReaderEmptyAnnotationDeletion(reader, id),
    beginFastEditorKeyboardGuard: () => beginReaderFastEditorKeyboardGuard(reader),
    importImage: async () => "zotero://select/library/items/ABCD1234"
  });
  adapter.tryShowFastEditorForAnnotationID("A1");
  const textarea = document.querySelector("textarea");
  textarea.focus();
  cleanup = () => { adapter.closeActiveFastEditor(); adapter.clearRenderedState(); };
  return { host, reader, adapter, textarea, commitComment };
}

function press(textarea, options = {}) {
  const event = new KeyboardEvent("keydown", { key: "Delete", bubbles: true, cancelable: true, ...options });
  textarea.dispatchEvent(event);
  return event;
}

describe("Delete the underline from its auto-focused empty comment", () => {
  test.each([true, false])("uses the annotation deletion command once, without saving a comment (popup=%s)", popup => {
    const f = fixture({ popup });
    expect(f.host._enableAnnotationDeletionFromComment).toBe(false);
    expect(press(f.textarea).defaultPrevented).toBe(true);
    expect(f.host.deleteAnnotations).toHaveBeenCalledExactlyOnceWith(["A1"]);
    expect(f.commitComment).not.toHaveBeenCalled();
    expect(document.querySelector("textarea")).toBeNull();
    expect(f.host._enableAnnotationDeletionFromComment).toBe(true);
    press(f.textarea);
    expect(f.host.deleteAnnotations).toHaveBeenCalledTimes(1);
  });

  test.each([
    { source: "existing" }, { source: " " }, { fromPage: false }, { armed: false }, { type: "text" }
  ])("does not arm an ordinary text editing session: %j", options => {
    const f = fixture(options);
    f.textarea.value = "";
    expect(press(f.textarea).defaultPrevented).toBe(false);
    expect(f.host.deleteAnnotations).not.toHaveBeenCalled();
  });

  test.each(["typed-and-cleared", "paste", "composition", "nonempty-draft", "menu", "dialog", "readonly", "changed-selection", "remote-comment", "failed-command"])("protects %s", mode => {
    const f = fixture();
    if (mode === "typed-and-cleared") { f.textarea.value = "abc"; f.textarea.dispatchEvent(new Event("input")); f.textarea.value = ""; }
    if (mode === "paste") f.textarea.dispatchEvent(new Event("paste"));
    if (mode === "composition") f.textarea.dispatchEvent(new Event("compositionstart"));
    if (mode === "nonempty-draft") f.textarea.value = "x";
    if (mode === "menu") document.body.insertAdjacentHTML("beforeend", '<div class="context-menu-overlay"></div>');
    if (mode === "dialog") document.body.insertAdjacentHTML("beforeend", '<div role="dialog"></div>');
    if (mode === "readonly") f.host._state.readOnly = true;
    if (mode === "changed-selection") f.host._state.selectedAnnotationIDs = ["OTHER"];
    if (mode === "remote-comment") f.host._state.annotations[0].comment = "synced";
    if (mode === "failed-command") f.host.deleteAnnotations.mockReturnValue(0);
    expect(press(f.textarea).defaultPrevented).toBe(false);
    if (mode !== "failed-command") expect(f.host.deleteAnnotations).not.toHaveBeenCalled();
    expect(document.querySelector("textarea")).toBe(f.textarea);
  });

  test.each([{ repeat: true }, { isComposing: true }, { keyCode: 229 }, { ctrlKey: true }, { altKey: true }, { shiftKey: true }, { metaKey: true }, { key: "Backspace" }])("leaves non-Delete gestures unchanged: %j", options => {
    const f = fixture();
    expect(press(f.textarea, options).defaultPrevented).toBe(false);
    expect(f.host.deleteAnnotations).not.toHaveBeenCalled();
  });

  test("does not delete while a screenshot is importing or after it is inserted", async () => {
    const f = fixture();
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", { value: {
      getData: () => "", files: [new File(["png"], "screenshot.png", { type: "image/png" })]
    } });
    f.textarea.dispatchEvent(event);
    expect(f.textarea.readOnly).toBe(true);
    expect(press(f.textarea).defaultPrevented).toBe(false);
    for (let i = 0; i < 10; i++) await Promise.resolve();
    expect(f.textarea.value).toContain("![Screenshot]");
    expect(press(f.textarea).defaultPrevented).toBe(false);
    expect(f.host.deleteAnnotations).not.toHaveBeenCalled();
  });

  test("opens the empty popup through the real controller and overrides only the native guard's blocked Delete", async () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<div class="annotation-popup" data-annotation-id="A1"><div class="comment"><div id="A1" class="content" tabindex="0" contenteditable="true"></div></div></div>';
    const host = {
      _state: { readOnly: false, selectedAnnotationIDs: ["A1"], annotations: [{ id: "A1", type: "underline", comment: "" }] },
      _annotationManager: { updateAnnotations: vi.fn() },
      _enableAnnotationDeletionFromComment: true,
      _annotationSelectionTriggeredFromView: true,
      deleteAnnotations: vi.fn(() => 1)
    };
    const nativeKey = event => {
      if (event.key !== "Delete") return;
      if (event.target.closest(".content") && !host._enableAnnotationDeletionFromComment) return;
      host.deleteAnnotations(host._state.selectedAnnotationIDs);
    };
    window.addEventListener("keydown", nativeKey, true);
    const plugin = createPlugin({ Zotero: {
      Reader: { _readers: [{ document, _internalReader: host }], registerEventListener: vi.fn() },
      Prefs: { get: name => name.endsWith("popupEnabled") ? true : undefined }
    } });
    cleanup = () => { plugin.shutdown(); window.removeEventListener("keydown", nativeKey, true); };
    await plugin.startup();
    document.querySelector(".content").focus();
    vi.runAllTimers();
    const textarea = document.querySelector("textarea");
    expect(textarea).not.toBeNull();
    expect(document.activeElement).toBe(textarea);
    expect(host._enableAnnotationDeletionFromComment).toBe(false);
    expect(press(textarea).defaultPrevented).toBe(true);
    expect(host.deleteAnnotations).toHaveBeenCalledExactlyOnceWith(["A1"]);
    expect(host._annotationManager.updateAnnotations).not.toHaveBeenCalled();
  });
});
