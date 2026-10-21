import { afterEach, describe, expect, test, vi } from "vitest";
import { installCommentFormatting, shortcutFormat } from "../src/comment-formatting.ts";
import { createMarkdownRenderer } from "../src/markdown-renderer.ts";
import { createAnnotationSidebarAdapter } from "../src/annotation-sidebar-adapter.ts";
import { createReaderController } from "../src/reader-controller.ts";

afterEach(() => { document.body.innerHTML = ""; vi.useRealTimers(); });
const cases = [
  ["bold", { key: "b", ctrlKey: true }, "**", "**", "strong"],
  ["underline", { key: "u", ctrlKey: true }, "<u>", "</u>", "u"],
  ["superscript", { key: "+", code: "Equal", ctrlKey: true, shiftKey: true }, "<sup>", "</sup>", "sup"],
  ["subscript", { key: "_", code: "Minus", ctrlKey: true, shiftKey: true }, "<sub>", "</sub>", "sub"]
];
function press(textarea, options) {
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...options });
  textarea.dispatchEvent(event);
  return event;
}
function editor(value) {
  document.body.innerHTML = "<textarea></textarea>";
  const textarea = document.querySelector("textarea");
  textarea.value = value;
  textarea.focus();
  installCommentFormatting(textarea);
  return textarea;
}
const render = source => {
  const result = document.createElement("div");
  result.innerHTML = createMarkdownRenderer({ windowRef: window }).render(source);
  return result;
};

describe("comment formatting shortcuts", () => {
  test.each(cases)("toggles %s around the selected payload", (_, keys, open, close, tag) => {
    const textarea = editor("before 文字 after");
    const input = vi.fn();
    textarea.addEventListener("input", input);
    textarea.setSelectionRange(7, 9);
    expect(press(textarea, keys).defaultPrevented).toBe(true);
    expect(textarea.value).toBe(`before ${open}文字${close} after`);
    expect(textarea.value.slice(textarea.selectionStart, textarea.selectionEnd)).toBe("文字");
    expect(render(textarea.value).querySelector(tag).textContent).toBe("文字");
    press(textarea, keys);
    expect(textarea.value).toBe("before 文字 after");
    expect(input).toHaveBeenCalledTimes(2);
  });
  test.each(cases)("inserts and removes empty %s markers at the caret", (_, keys, open, close) => {
    const textarea = editor("ab");
    textarea.setSelectionRange(1, 1);
    press(textarea, keys);
    expect(textarea.value).toBe(`a${open}${close}b`);
    expect(textarea.selectionStart).toBe(1 + open.length);
    expect(textarea.selectionStart).toBe(textarea.selectionEnd);
    press(textarea, keys);
    expect(textarea.value).toBe("ab");
  });
  test.each(cases)("toggles %s across multiple paragraphs without broken markers", (_, keys, open, close, tag) => {
    const original = " first\n\nsecond ";
    const textarea = editor(original);
    textarea.select();
    press(textarea, keys);
    expect(textarea.value).toBe(` ${open}first${close}\n\n${open}second${close} `);
    expect(render(textarea.value).querySelectorAll(tag)).toHaveLength(2);
    press(textarea, keys);
    expect(textarea.value).toBe(original);
  });
  test("supports shifted punctuation, numpad and Cmd equivalents", () => {
    expect(shortcutFormat(new KeyboardEvent("keydown", { key: "=", ctrlKey: true, shiftKey: true }))).toBe("superscript");
    expect(shortcutFormat(new KeyboardEvent("keydown", { key: "-", ctrlKey: true, shiftKey: true }))).toBe("subscript");
    expect(shortcutFormat(new KeyboardEvent("keydown", { code: "NumpadAdd", ctrlKey: true, shiftKey: true }))).toBe("superscript");
    expect(shortcutFormat(new KeyboardEvent("keydown", { key: "u", metaKey: true }))).toBe("underline");
  });
  test.each([{ key: "b" }, { key: "+", ctrlKey: true }, { key: "-", ctrlKey: true }, { key: "b", ctrlKey: true, altKey: true }, { key: "b", ctrlKey: true, isComposing: true }, { key: "b", ctrlKey: true, keyCode: 229 }])("leaves other shortcuts and IME alone: %j", keys => {
    const textarea = editor("unchanged"); textarea.select();
    expect(press(textarea, keys).defaultPrevented).toBe(false);
    expect(textarea.value).toBe("unchanged");
  });
  test("does not repeat-toggle or edit readonly inputs", () => {
    const textarea = editor("text"); textarea.select();
    press(textarea, { key: "b", ctrlKey: true, repeat: true });
    textarea.readOnly = true;
    press(textarea, { key: "u", ctrlKey: true });
    expect(textarea.value).toBe("text");
  });
  test("uses the host insertion command once when available, retaining undo support", () => {
    const textarea = editor("abc"); textarea.select();
    const previous = Object.getOwnPropertyDescriptor(document, "execCommand");
    const command = vi.fn((name, ui, replacement) => {
      textarea.setRangeText(replacement, textarea.selectionStart, textarea.selectionEnd, "end");
      textarea.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
      return true;
    });
    Object.defineProperty(document, "execCommand", { configurable: true, value: command });
    try {
      const input = vi.fn(); textarea.addEventListener("input", input);
      press(textarea, { key: "b", ctrlKey: true });
      expect(command).toHaveBeenCalledExactlyOnceWith("insertText", false, "**abc**");
      expect(textarea.value).toBe("**abc**");
      expect(input).toHaveBeenCalledOnce();
    } finally {
      if (previous) Object.defineProperty(document, "execCommand", previous);
      else delete document.execCommand;
    }
  });
  test.each([false, true])("saves formatting through the editor and renders it again (popup=%s)", async popup => {
    vi.useFakeTimers();
    document.body.innerHTML = `<div ${popup ? 'class="annotation-popup" data-annotation-id' : 'class="annotation selected" data-sidebar-annotation-id'}="A1"><div class="comment"><div class="content">文字</div></div></div>`;
    const commitComment = vi.fn(() => true);
    const adapter = createAnnotationSidebarAdapter({ document, isFastEditorEnabled: () => true, commitComment });
    const controller = createReaderController({ reader: { document }, adapter,
      renderer: createMarkdownRenderer({ windowRef: window }),
      settings: { isEnabled: () => true, isPopupEnabled: () => true }, MutationObserver: null, IntersectionObserver: null });
    try {
      await controller.start();
      adapter.tryShowFastEditorForAnnotationID("A1"); vi.runAllTimers();
      const textarea = document.querySelector("textarea"); textarea.select();
      press(textarea, cases[0][1]); press(textarea, cases[1][1]);
      press(textarea, { key: "Escape" }); vi.runAllTimers();
      expect(commitComment).toHaveBeenCalledExactlyOnceWith("A1", "**<u>文字</u>**");
      expect(document.querySelector(".annotation-markdown-rendered strong u").textContent).toBe("文字");
    } finally { controller.stop(); }
  });
});

describe("restricted inline formatting", () => {
  test("supports nesting, math, inline code, and repeated rendering", () => {
    const result = render('<u>**粗体** <sup>2</sup> <sub>i</sub> `</u>`</u> and $x^2$');
    expect(result.querySelector("u strong").textContent).toBe("粗体");
    expect(result.querySelector("u sup").textContent).toBe("2");
    expect(result.querySelector("u sub").textContent).toBe("i");
    expect(result.querySelector("u code").textContent).toBe("</u>");
    expect(result.querySelector(".katex")).not.toBeNull();
  });
  test.each(['<u onclick="alert(1)">text</u>', '<sup style="color:red">x</sup>', '<u>unclosed', '`<u>code</u>`', '```html\n<u>code</u>\n```', '&lt;u&gt;literal&lt;/u&gt;', '\\<u>escaped</u>'])('does not render attributes, unbalanced tags or code: %s', source => {
    expect(render(source).querySelector("u,sup,sub")).toBeNull();
  });
  test("keeps arbitrary HTML disabled even inside supported formatting", () => {
    const result = render('<u><script>alert(1)</script><img src=x onerror=alert(1)></u>');
    expect(result.querySelector("script,img")).toBeNull();
    expect(result.querySelector("u").textContent).toContain("<script>");
  });
});
