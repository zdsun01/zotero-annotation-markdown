const MAX_INPUT_LENGTH = 2 * 1024 * 1024;
const MAX_ROWS = 200;
const MAX_COLUMNS = 50;
const MAX_CELLS = 2000;

/** Read clipboard tables as text only; never mount copied HTML in the Reader. */
export function clipboardTable(data: DataTransfer | null, documentRef: Document): string | null {
  if (!data) return null;
  const html = data.getData("text/html");
  if (html.length > MAX_INPUT_LENGTH) return null;
  if (html) {
    const template = documentRef.createElement("template");
    template.innerHTML = html;
    const tables = template.content.querySelectorAll("table");
    // Multiple/nested tables cannot be flattened without losing their structure.
    if (tables.length > 1) return null;
    if (tables.length === 1) {
      const rows = readHTMLTable(tables[0]);
      const caption = tables[0].caption ? cellText(tables[0].caption) : "";
      tables[0].remove();
      template.content.querySelectorAll("script,style,title,template,noscript").forEach(node => node.remove());
      // A selection containing prose and a table must keep its prose too.
      // Leave mixed selections to native paste instead of silently discarding it.
      if (template.content.textContent?.trim()) return null;
      const markdown = rows ? markdownTable(rows) : null;
      return markdown && caption ? `${escapeCell(caption)}\n\n${markdown}` : markdown;
    }
  }
  const text = data.getData("text/plain");
  if (text.length > MAX_INPUT_LENGTH || !text.includes("\t")) return null;
  const rows = readTSV(text);
  if (!rows || rows.length < 2 || rows[0].length < 2 ||
      rows.some(row => row.length !== rows[0].length)) return null;
  return markdownTable(rows);
}

function readHTMLTable(table: HTMLTableElement): string[][] | null {
  const sourceRows = Array.from(table.rows);
  if (!sourceRows.length || sourceRows.length > MAX_ROWS) return null;
  const grid: string[][] = sourceRows.map(() => []);
  for (let rowIndex = 0; rowIndex < sourceRows.length; rowIndex++) {
    let column = 0;
    for (const cell of Array.from(sourceRows[rowIndex].cells)) {
      while (grid[rowIndex][column] !== undefined) column++;
      const rowSpan = cell.rowSpan === 0
        ? sourceRows.slice(rowIndex).filter(row => row.parentElement === sourceRows[rowIndex].parentElement).length
        : cell.rowSpan;
      const colSpan = cell.colSpan;
      if (column + colSpan > MAX_COLUMNS || rowIndex + rowSpan > sourceRows.length) return null;
      if ((column + colSpan) * sourceRows.length > MAX_CELLS) return null;
      for (let r = rowIndex; r < rowIndex + rowSpan; r++) {
        for (let c = column; c < column + colSpan; c++) {
          if (grid[r][c] !== undefined) return null;
          grid[r][c] = r === rowIndex && c === column ? cellText(cell) : "";
        }
      }
      column += colSpan;
    }
  }
  return grid;
}

function cellText(cell: Element): string {
  const parts: string[] = [];
  const visit = (node: Node) => {
    if (node.nodeType === 3) {
      parts.push((node.nodeValue ?? "").replace(/\s+/g, " "));
      return;
    }
    if (node.nodeType !== 1) return;
    const element = node as Element;
    if (element.matches("script,style,template,noscript")) return;
    if (element.tagName === "BR") {
      parts.push("\n");
      return;
    }
    const block = element.matches("p,div,li");
    if (block && parts.length && !parts.at(-1)?.endsWith("\n")) parts.push("\n");
    for (const child of element.childNodes) visit(child);
    if (block && !parts.at(-1)?.endsWith("\n")) parts.push("\n");
  };
  for (const child of cell.childNodes) visit(child);
  return parts.join("").trim();
}

/** Excel/Sheets TSV may quote cells containing tabs, line breaks or quotes. */
function readTSV(text: string): string[][] | null {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  let closedQuote = false;
  const normalized = text.replace(/\r\n?/g, "\n").replace(/\n$/, "");
  for (let index = 0; index < normalized.length; index++) {
    const char = normalized[index];
    if (quoted) {
      if (char === '"') {
        if (normalized[index + 1] === '"') { value += '"'; index++; }
        else { quoted = false; closedQuote = true; }
      } else value += char;
    } else if (char === "\t" || char === "\n") {
      row.push(value);
      value = "";
      closedQuote = false;
      if (row.length > MAX_COLUMNS) return null;
      if (char === "\n") {
        rows.push(row);
        row = [];
        if (rows.length >= MAX_ROWS) return null;
      }
    } else if (closedQuote) {
      return null;
    } else if (char === '"' && value === "") {
      quoted = true;
    } else value += char;
  }
  if (quoted) return null;
  row.push(value);
  rows.push(row);
  return rows;
}

function markdownTable(rows: string[][]): string | null {
  const width = Math.max(...rows.map(row => row.length));
  if (!width || width > MAX_COLUMNS || rows.length > MAX_ROWS ||
      rows.length * width > MAX_CELLS) return null;
  const lines = rows.map(row => "| " + Array.from({ length: width }, (_, i) =>
    escapeCell(row[i] ?? "")).join(" | ") + " |");
  lines.splice(1, 0, "| " + Array(width).fill("---").join(" | ") + " |");
  return lines.join("\n");
}

function escapeCell(value: string): string {
  return value.trim()
    // Entities also protect \( / \[ from the renderer's math delimiter rules.
    .replace(/[&<>\\`*_[\]{}()#+.!|~^=$:@-]/g, char => `&#${char.charCodeAt(0)};`)
    .replace(/\r\n?|\n/g, " ⏎ ").replace(/\t/g, " ");
}

export function installTablePaste(textarea: HTMLTextAreaElement, editor: HTMLElement): void {
  textarea.addEventListener("paste", event => {
    if (event.defaultPrevented || textarea.readOnly) return;
    const table = clipboardTable(event.clipboardData, textarea.ownerDocument);
    if (!table) return;
    event.preventDefault();
    // Office apps may also provide an image of the table. Prefer editable cells.
    event.stopImmediatePropagation();
    const markdown = `\n\n${table}\n\n`;
    textarea.setRangeText(markdown, textarea.selectionStart, textarea.selectionEnd, "end");
    textarea.dispatchEvent(new textarea.ownerDocument.defaultView!.InputEvent("input", {
      bubbles: true, inputType: "insertFromPaste", data: markdown
    }));
    let status = editor.querySelector<HTMLElement>(".annotation-markdown-table-paste-status");
    if (!status) {
      status = textarea.ownerDocument.createElement("div");
      status.className = "annotation-markdown-paste-status annotation-markdown-table-paste-status";
      status.setAttribute("role", "status");
      editor.append(status);
    }
    status.textContent = "表格已插入，首行作为表头；按 Esc 保存并预览。 / Table inserted; first row is the header. Escape to preview.";
  });
}
