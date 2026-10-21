import type MarkdownIt from "markdown-it";
import type Token from "markdown-it/lib/token.mjs";

/** Only balanced, attribute-free formatting tags are accepted. Raw HTML stays off. */
export function installInlineCommentFormat(markdown: MarkdownIt): void {
  const maxNesting = 20;
  let depth = 0;
  markdown.inline.ruler.before("html_inline", "annotation_comment_format", (state, silent) => {
    const match = /^<(u|sup|sub)>/.exec(state.src.slice(state.pos));
    if (!match || depth >= maxNesting) return false;
    const start = state.pos + match[0].length;
    const end = findClosingTag(state.src, start, state.posMax, match[1], maxNesting - depth);
    if (end < 0) return false;
    const next = end + match[1].length + 3;
    if (!silent) {
      const children: Token[] = [];
      depth++;
      try { state.md.inline.parse(state.src.slice(start, end), state.md, state.env, children); }
      finally { depth--; }
      state.push("annotation_format_open", match[1], 1);
      for (const token of children) { token.level += state.level; state.tokens.push(token); }
      state.push("annotation_format_close", match[1], -1);
    }
    state.pos = next;
    return true;
  });
}

function findClosingTag(source: string, start: number, limit: number, tag: string, maxNesting: number): number {
  const stack = [tag];
  const pattern = /<\/?(?:u|sup|sub)>|`+/g;
  pattern.lastIndex = start;
  for (let match = pattern.exec(source); match && match.index < limit; match = pattern.exec(source)) {
    let slashes = 0;
    for (let i = match.index - 1; i >= start && source[i] === "\\"; i--) slashes++;
    if (slashes % 2) continue;
    if (match[0][0] === "`") {
      const codeEnd = new RegExp("(?<!`)" + match[0] + "(?!`)", "g");
      codeEnd.lastIndex = pattern.lastIndex;
      const closing = codeEnd.exec(source);
      if (closing && closing.index < limit) pattern.lastIndex = closing.index + match[0].length;
      continue;
    }
    const closing = match[0].startsWith("</");
    const current = match[0].slice(closing ? 2 : 1, -1);
    if (!closing) {
      stack.push(current);
      if (stack.length > maxNesting) return -1;
    }
    else {
      if (stack.pop() !== current) return -1;
      if (!stack.length) return match.index;
    }
  }
  return -1;
}
