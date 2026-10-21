import { afterEach, describe, expect, test, vi } from "vitest";
import { createAnnotationSidebarAdapter } from "../src/annotation-sidebar-adapter.ts";
import { installPreviewDeleteShortcut } from "../src/preview-delete-shortcut.ts";
import { deleteReaderAnnotationFromPreview, createPlugin } from "../src/plugin.ts";

let cleanup = () => {};
afterEach(() => { cleanup(); cleanup = () => {}; document.body.innerHTML = ""; });

function fixture(popup = true) {
  document.body.innerHTML = `<div ${popup ? 'class="annotation-popup" data-annotation-id' : 'class="annotation selected" data-sidebar-annotation-id'}="A1"><div class="comment"><div class="content" tabindex="0" contenteditable="true">saved comment</div></div></div>`;
  const adapter = createAnnotationSidebarAdapter({ document, isFastEditorEnabled: () => true, commitComment: () => true });
  const comment = document.querySelector(".comment");
  adapter.applyRenderedHtml(comment, "<p>saved comment</p>");
  const source = document.querySelector(".content");
  source.focus();
  const host = {
    _state: { readOnly: false, selectedAnnotationIDs: ["A1"], annotations: [{ id: "A1", comment: "saved comment" }] },
    deleteAnnotations: vi.fn(() => 1), _lastView: { focus: vi.fn() }
  };
  const reader = { _internalReader: host };
  const deleteAnnotation = vi.fn(id => deleteReaderAnnotationFromPreview(reader, id));
  return { adapter, comment, source, host, reader, deleteAnnotation };
}

const key = (target, options = {}) => {
  const event = new KeyboardEvent("keydown", { key: "Delete", bubbles: true, cancelable: true, ...options });
  target.dispatchEvent(event);
  return event;
};

describe("Delete from a rendered annotation", () => {
  test.each([true, false])("repairs a focused hidden source after the native keyboard handler skips it (popup=%s)", popup => {
    const f = fixture(popup);
    const nativeHandler = vi.fn(event => {
      // Zotero 10.0.6 KeyboardManager skips populated .content editors.
      if (event.target.closest(".content") && f.host._state.annotations[0].comment) return;
      f.host.deleteAnnotations(f.host._state.selectedAnnotationIDs);
    });
    window.addEventListener("keydown", nativeHandler, true);
    const stop = installPreviewDeleteShortcut({ document, ...f, isEnabled: () => true });
    cleanup = () => { stop(); window.removeEventListener("keydown", nativeHandler, true); f.adapter.clearRenderedState(); };
    expect(key(f.source).defaultPrevented).toBe(true);
    expect(nativeHandler).toHaveBeenCalledOnce();
    expect(f.host.deleteAnnotations).toHaveBeenCalledExactlyOnceWith(["A1"]);
    expect(f.host._lastView.focus).toHaveBeenCalledOnce();
    stop();
    key(f.source);
    expect(f.host.deleteAnnotations).toHaveBeenCalledTimes(1);
  });

  test.each([
    { key: "Backspace" }, { ctrlKey: true }, { metaKey: true }, { altKey: true },
    { shiftKey: true }, { repeat: true }, { isComposing: true }, { keyCode: 229 }
  ])("leaves modified, repeated and composing keys alone: %j", options => {
    const f = fixture();
    cleanup = installPreviewDeleteShortcut({ document, ...f, isEnabled: () => true });
    expect(key(f.source, options).defaultPrevented).toBe(false);
    expect(f.deleteAnnotation).not.toHaveBeenCalled();
  });

  test.each(["visible-source", "fast-editor", "menu", "dialog", "disabled", "hidden-preview", "already-handled", "other-input"])("does not delete in %s", mode => {
    const f = fixture();
    cleanup = installPreviewDeleteShortcut({ document, ...f, isEnabled: () => mode !== "disabled" });
    let target = f.source;
    if (mode === "visible-source") f.adapter.restoreSourceDomForEditing(f.comment);
    if (mode === "fast-editor") { f.adapter.tryShowFastEditorForAnnotationID("A1"); target = document.querySelector("textarea"); target.focus(); }
    if (mode === "menu") document.body.insertAdjacentHTML("beforeend", '<div class="context-menu-overlay"></div>');
    if (mode === "dialog") document.body.insertAdjacentHTML("beforeend", '<div role="dialog"></div>');
    if (mode === "hidden-preview") f.comment.querySelector(".annotation-markdown-rendered").hidden = true;
    if (mode === "other-input") { target = document.createElement("input"); document.body.append(target); target.focus(); }
    const event = new KeyboardEvent("keydown", { key: "Delete", bubbles: true, cancelable: true });
    if (mode === "already-handled") event.preventDefault();
    target.dispatchEvent(event);
    expect(f.deleteAnnotation).not.toHaveBeenCalled();
    if (mode !== "already-handled") expect(event.defaultPrevented).toBe(false);
    f.adapter.closeActiveFastEditor();
    f.adapter.clearRenderedState();
  });

  test.each(["read-only-reader", "read-only-annotation", "external", "different-selection", "multi-selection", "missing", "menu-state", "no-api", "failed-command"])("honors native selection and permissions: %s", mode => {
    const f = fixture();
    if (mode === "read-only-reader") f.host._state.readOnly = true;
    if (mode === "read-only-annotation") f.host._state.annotations[0].readOnly = true;
    if (mode === "external") f.host._state.annotations[0].isExternal = true;
    if (mode === "different-selection") f.host._state.selectedAnnotationIDs = ["OTHER"];
    if (mode === "multi-selection") f.host._state.selectedAnnotationIDs.push("OTHER");
    if (mode === "missing") f.host._state.annotations = [];
    if (mode === "menu-state") f.host._state.contextMenu = {};
    if (mode === "no-api") delete f.host.deleteAnnotations;
    if (mode === "failed-command") f.host.deleteAnnotations.mockReturnValue(0);
    expect(deleteReaderAnnotationFromPreview(f.reader, "A1")).toBe(false);
    if (mode !== "no-api" && mode !== "failed-command") expect(f.host.deleteAnnotations).not.toHaveBeenCalled();
    expect(f.host._lastView.focus).not.toHaveBeenCalled();
  });

  test("registers through the plugin and cleans up on shutdown", async () => {
    const f = fixture();
    // Recreate native DOM for plugin startup; hidden focus is established after rendering.
    f.source.blur();
    f.adapter.clearRenderedState();
    f.reader.document = document;
    f.host._annotationManager = { updateAnnotations: vi.fn() };
    const plugin = createPlugin({ Zotero: {
      Reader: { _readers: [f.reader], registerEventListener: vi.fn() },
      Prefs: { get: name => name.endsWith("popupEnabled") ? true : undefined }
    } });
    await plugin.startup();
    // Model focus retained while the host editor was hidden, without a new
    // focusin event (a deliberate new focus would re-enter text editing).
    Object.defineProperty(document, "activeElement", { configurable: true, get: () => f.source });
    cleanup = () => { delete document.activeElement; plugin.shutdown(); };
    expect(key(f.source).defaultPrevented).toBe(true);
    expect(f.host.deleteAnnotations).toHaveBeenCalledExactlyOnceWith(["A1"]);
    plugin.shutdown();
    key(f.source);
    expect(f.host.deleteAnnotations).toHaveBeenCalledTimes(1);
  });
});
