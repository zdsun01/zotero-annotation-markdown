import type { AnnotationSidebarAdapter } from "./annotation-sidebar-adapter.js";

/** Repair Delete only when focus was stranded in the source hidden by our preview.
 * Normal selection deletion still belongs to Zotero's earlier window listener.
 */
export function installPreviewDeleteShortcut({ document, adapter, isEnabled, deleteAnnotation }: {
  document: Document;
  adapter: AnnotationSidebarAdapter;
  isEnabled(node: HTMLElement): boolean;
  deleteAnnotation(id: string): boolean;
}): () => void {
  const handle = (event: KeyboardEvent) => {
    if (event.key !== "Delete" || event.defaultPrevented || event.repeat ||
        event.isComposing || event.keyCode === 229 || event.ctrlKey || event.metaKey ||
        event.altKey || event.shiftKey || adapter.hasActiveFastEditor()) return;
    const target = event.target as HTMLElement | null;
    if (!target?.closest || target !== document.activeElement ||
        !target.closest("[data-annotation-markdown-source-hidden='true']") ||
        !target.closest(".content") || target.closest("input,textarea,select,.text,.label-popup")) return;
    if (document.querySelector(".context-menu-overlay,[role='dialog']:not([hidden]),[data-annotation-markdown-svg-viewer]")) return;
    const comment = adapter.getCommentNodeForTarget(target);
    if (!comment || !isEnabled(comment) || !adapter.isRendered(comment) ||
        comment.classList.contains("annotation-markdown-editing")) return;
    const preview = comment.querySelector<HTMLElement>("[data-annotation-markdown-preview='true']");
    if (!preview || preview.hidden || preview.hasAttribute("data-annotation-markdown-placeholder") ||
        document.defaultView?.getComputedStyle(preview)?.display === "none") return;
    const id = adapter.getAnnotationIDForTarget(target);
    if (id && deleteAnnotation(id)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };
  document.defaultView?.addEventListener("keydown", handle, true);
  return () => document.defaultView?.removeEventListener("keydown", handle, true);
}
