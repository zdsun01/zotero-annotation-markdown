import { describe, expect, test, vi } from "vitest";
import { clipboardTable } from "../src/table-paste.ts";
import { createMarkdownRenderer } from "../src/markdown-renderer.ts";
import { createAnnotationSidebarAdapter } from "../src/annotation-sidebar-adapter.ts";
import { createReaderController } from "../src/reader-controller.ts";

const data = (html = "", text = "") => ({
  getData: type => type === "text/html" ? html : type === "text/plain" ? text : "",
  files: []
});
const html = "<table><tr><th>名称</th><th>数值</th></tr><tr><td>甲</td><td>12</td></tr></table>";
const expected = "| 名称 | 数值 |\n| --- | --- |\n| 甲 | 12 |";
const render = source => {
  const holder = document.createElement("div");
  holder.innerHTML = createMarkdownRenderer({ windowRef: window }).render(source);
  return holder;
};

describe("clipboard tables", () => {
  test("converts Office/web HTML tables using visible text and entities", () => {
    expect(clipboardTable(data(`<!--StartFragment--><style>td{color:red}</style>${html}<!--EndFragment-->`), document)).toBe(expected);
    expect(clipboardTable(data('<table><tr><td><b>A &amp; B</b></td><td>2</td></tr></table>'), document))
      .toBe("| A &#38; B | 2 |\n| --- | --- |");
  });

  test("preserves merged cell coordinates, caption and multiline content", () => {
    const source = clipboardTable(data('<table><caption>实验</caption><tr><th rowspan="2">A</th><th colspan="2">B</th></tr><tr><td><p>一</p><p>二<br>三</p></td><td>4</td></tr></table>'), document);
    const result = render(source);
    expect(result.querySelector("p").textContent).toBe("实验");
    expect([...result.querySelectorAll("th,td")].map(cell => cell.textContent))
      .toEqual(["A", "B", "", "", "一 ⏎ 二 ⏎ 三", "4"]);
  });

  test.each([
    ["名称\t数值\r\n甲\t12\r\n", expected],
    ['名称\t数值\n"甲\t乙"\t"1\n2"\n', "| 名称 | 数值 |\n| --- | --- |\n| 甲 乙 | 1 ⏎ 2 |"],
    ['名称\t数值\n"说""你好"""\t12', '| 名称 | 数值 |\n| --- | --- |\n| 说"你好" | 12 |'],
    ["名称\t数值\n甲\t", "| 名称 | 数值 |\n| --- | --- |\n| 甲 |  |"]
  ])("parses tabular text with quotes and empty cells: %s", (text, result) => {
    expect(clipboardTable(data("", text), document)).toBe(result);
  });

  test("does not turn cell punctuation into Markdown, math, images or executable HTML", () => {
    const cells = ["a|b", "**bold**", "$x$", "[x](https://example.com)", "<svg onload=x>", "`code`", "==mark==", "a\\b"];
    const source = clipboardTable(data("", cells.join("\t") + "\n" + cells.join("\t")), document);
    const result = render(source);
    expect([...result.querySelectorAll("th")].map(cell => cell.textContent)).toEqual(cells);
    expect(result.querySelector("img,script,svg,strong,code,mark,.katex,a")).toBeNull();
    const malicious = clipboardTable(data('<table><tr><td onclick="x()">safe<script>bad()</script><img src="https://example.com/x" onerror="x()"></td></tr></table>'), document);
    expect(render(malicious).querySelector("th").textContent).toBe("safe");
  });

  test.each([
    data("", "ordinary\nparagraph"),
    data("", "one\tline"),
    data("", "a\tb\nc"),
    data("", 'a\tb\n"unfinished\tc'),
    data("", 'a\tb\n"x"invalid\tc'),
    data("<p>before</p>" + html),
    data(html + html),
    data("<table><tr><td><table><tr><td>nested</td></tr></table></td></tr></table>"),
    data('<table><tr><td colspan="10000">too wide</td></tr></table>'),
    data("", Array(202).fill("a\tb").join("\n")),
    data("", "x".repeat(2 * 1024 * 1024) + "\ta\nb\tc")
  ])("leaves unsupported or non-table content to native paste", value => {
    expect(clipboardTable(value, document)).toBeNull();
  });

  test.each([false, true])("pastes at selection, saves, reopens and continues below the table (popup=%s)", async popup => {
    vi.useFakeTimers();
    document.body.innerHTML = `<div ${popup ? 'class="annotation-popup" data-annotation-id' : 'class="annotation selected" data-sidebar-annotation-id'}="NOTE1234"><div class="comment"><div class="content">before REPLACE after</div></div></div>`;
    const commitComment = vi.fn(() => true);
    const importImage = vi.fn();
    const adapter = createAnnotationSidebarAdapter({ document, commitComment, importImage, isFastEditorEnabled: () => true });
    const renderer = createMarkdownRenderer({ windowRef: window });
    const controller = createReaderController({
      reader: { document }, adapter, renderer,
      settings: { isEnabled: () => true, isPopupEnabled: () => true },
      MutationObserver: null, IntersectionObserver: null
    });
    await controller.start();
    try {
      adapter.tryShowFastEditorForAnnotationID("NOTE1234");
      vi.runAllTimers();
      const textarea = document.querySelector("textarea");
      textarea.setSelectionRange(7, 14);
      const event = new Event("paste", { bubbles: true, cancelable: true });
      const clipboard = data(html, "名称\t数值\n甲\t12");
      clipboard.files = [new File(["png"], "table.png", { type: "image/png" })];
      Object.defineProperty(event, "clipboardData", { value: clipboard });
      textarea.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
      expect(importImage).not.toHaveBeenCalled();
      const saved = `before \n\n${expected}\n\n after`;
      expect(textarea.value).toBe(saved);
      expect(textarea.selectionStart).toBe(saved.length - 6);
      textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
      vi.runAllTimers();
      expect(commitComment).toHaveBeenCalledExactlyOnceWith("NOTE1234", saved);
      const preview = document.querySelector(".annotation-markdown-rendered");
      expect(preview.querySelectorAll("td")).toHaveLength(2);
      const table = preview.querySelector("table");
      Object.defineProperties(table, {
        clientWidth: { value: 200 }, offsetWidth: { value: 200 }, scrollWidth: { value: 600 },
        clientHeight: { value: 90 }, offsetHeight: { value: 100 }, scrollHeight: { value: 90 }
      });
      table.getBoundingClientRect = () => ({ top: 0, left: 0, bottom: 100, right: 200, width: 200, height: 100 });
      table.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, button: 0, pointerType: "mouse", clientX: 100, clientY: 98 }));
      expect(document.querySelector("textarea")).toBeNull();
      expect(preview.hidden).toBe(false);
      preview.querySelector(".annotation-markdown-append-comment").click();
      vi.runAllTimers();
      const append = document.querySelector("textarea");
      expect(append.value).toBe("");
      expect(preview.hidden).toBe(false);
      append.value = "表格下方说明";
      adapter.closeActiveFastEditor();
      vi.runAllTimers();
      expect(commitComment).toHaveBeenLastCalledWith("NOTE1234", saved + "\n\n表格下方说明");
      expect(preview.textContent).toContain("表格下方说明");
    } finally {
      controller.stop();
      vi.useRealTimers();
    }
  });

  test("works without image import support and leaves native text paste untouched", () => {
    document.body.innerHTML = '<div class="annotation selected" data-sidebar-annotation-id="NOTE1234"><div class="comment"><div class="content">original</div></div></div>';
    const adapter = createAnnotationSidebarAdapter({ document, commitComment: () => true, isFastEditorEnabled: () => true });
    adapter.tryShowFastEditorForAnnotationID("NOTE1234");
    const textarea = document.querySelector("textarea");
    const fire = clipboard => {
      const event = new Event("paste", { bubbles: true, cancelable: true });
      Object.defineProperty(event, "clipboardData", { value: clipboard });
      textarea.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(fire(data("", "ordinary text"))).toBe(false);
    textarea.readOnly = true;
    expect(fire(data(html))).toBe(false);
    expect(textarea.value).toBe("original");
    textarea.readOnly = false;
    expect(fire(data(html))).toBe(true);
    expect(textarea.value).toContain(expected);
    adapter.closeActiveFastEditor();
    adapter.clearRenderedState();
  });
});
