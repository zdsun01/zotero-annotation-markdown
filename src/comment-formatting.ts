export type CommentFormat = "bold" | "underline" | "superscript" | "subscript";

const MARKERS: Record<CommentFormat, [string, string]> = {
  bold: ["**", "**"], underline: ["<u>", "</u>"],
  superscript: ["<sup>", "</sup>"], subscript: ["<sub>", "</sub>"]
};

export function shortcutFormat(event: KeyboardEvent): CommentFormat | null {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || (event.ctrlKey && event.metaKey)) return null;
  if (!event.shiftKey) {
    if (event.key.toLowerCase() === "b") return "bold";
    if (event.key.toLowerCase() === "u") return "underline";
  } else {
    if (["+", "="].includes(event.key) || ["Equal", "NumpadAdd"].includes(event.code)) return "superscript";
    if (["-", "_"].includes(event.key) || ["Minus", "NumpadSubtract"].includes(event.code)) return "subscript";
  }
  return null;
}

export function installCommentFormatting(textarea: HTMLTextAreaElement): void {
  textarea.addEventListener("keydown", event => {
    if (event.defaultPrevented || event.isComposing || event.keyCode === 229) return;
    const format = shortcutFormat(event);
    if (!format) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.repeat || textarea.readOnly || textarea.disabled || textarea.ownerDocument.activeElement !== textarea) return;
    toggleCommentFormat(textarea, format);
  });
}

/** Keep the payload selected so applying another format can combine styles. */
export function toggleCommentFormat(textarea: HTMLTextAreaElement, format: CommentFormat): void {
  const [open, close] = MARKERS[format];
  const value = textarea.value;
  let start = textarea.selectionStart;
  let end = textarea.selectionEnd;
  let selected = value.slice(start, end);
  let replacement: string;
  let offset = 0;
  let selectedLength: number;
  if (value.slice(Math.max(0, start - open.length), start) === open && value.slice(end, end + close.length) === close) {
    start -= open.length;
    end += close.length;
    replacement = selected;
    selectedLength = selected.length;
  } else if (!selected.includes("\n") && selected.startsWith(open) && selected.endsWith(close) && selected.length >= open.length + close.length) {
    replacement = selected.slice(open.length, -close.length);
    selectedLength = replacement.length;
  } else if (selected.includes("\n")) {
    // Format each line so blank paragraphs do not break Markdown delimiters.
    const lines = selected.split("\n");
    const formatted = lines.filter(line => line.trim());
    const remove = formatted.length > 0 && formatted.every(line => line.trim().startsWith(open) && line.trim().endsWith(close));
    replacement = lines.map(line => {
      const content = line.trim();
      if (!content) return line;
      const leading = line.slice(0, line.length - line.trimStart().length);
      const trailing = line.slice(line.trimEnd().length);
      return leading + (remove ? content.slice(open.length, -close.length) : open + content + close) + trailing;
    }).join("\n");
    selectedLength = replacement.length;
  } else {
    const leading = selected.length - selected.trimStart().length;
    const trailing = selected.length - selected.trimEnd().length;
    if (selected && !selected.trim()) return;
    start += leading;
    end -= trailing;
    selected = value.slice(start, end);
    replacement = open + selected + close;
    offset = open.length;
    selectedLength = selected.length;
  }
  textarea.setSelectionRange(start, end);
  const doc = textarea.ownerDocument;
  // Gecko's text insertion command keeps the operation in the textarea's undo
  // history. DOM-only environments use the equivalent range replacement.
  try { doc.execCommand?.("insertText", false, replacement); } catch { /* Fall back below. */ }
  if (textarea.value === value) {
    textarea.setRangeText(replacement, start, end, "end");
    textarea.dispatchEvent(new doc.defaultView!.InputEvent("input", {
      bubbles: true, inputType: "insertText", data: replacement
    }));
  }
  textarea.setSelectionRange(start + offset, start + offset + selectedLength);
}
