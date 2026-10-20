import type MarkdownIt from "markdown-it";

export const MAX_CLIPBOARD_IMAGE_BYTES = 8 * 1024 * 1024;
export const RASTER_IMAGE_TYPE = /^image\/(?:png|jpeg|gif|webp)$/;

/** Stable Zotero item keys survive sync; local filesystem paths do not. */
export function parseImageAttachmentURL(url: string): { scope: string; key: string } | null {
  const match = /^zotero:\/\/select\/(library|groups\/[1-9]\d*)\/items\/([A-Z0-9]{8})$/.exec(url);
  return match ? { scope: match[1], key: match[2] } : null;
}

export function clipboardImages(data: DataTransfer | null): File[] {
  const items = Array.from(data?.items ?? [])
    .filter(item => item.kind === "file" && item.type.startsWith("image/"))
    .map(item => item.getAsFile()).filter((file): file is File => Boolean(file));
  return items.length ? items : Array.from(data?.files ?? []).filter(file => file.type.startsWith("image/"));
}

export function validateClipboardImage(file: Blob): void {
  if (!RASTER_IMAGE_TYPE.test(file.type)) throw new Error("Use a PNG, JPEG, GIF or WebP image / 请使用 PNG、JPEG、GIF 或 WebP 图片");
  if (!file.size || file.size > MAX_CLIPBOARD_IMAGE_BYTES) throw new Error("Image must be between 1 byte and 8 MiB / 图片须大于 0 且不超过 8 MiB");
}

/** Only explicit Markdown image syntax turns a Zotero selection link into an image. */
export function installAttachmentImagePreviews(markdown: MarkdownIt): void {
  const original = markdown.renderer.rules.image!;
  markdown.renderer.rules.image = (tokens, index, options, env, self) => {
    const token = tokens[index];
    const url = token.attrGet("src") ?? "";
    if (!parseImageAttachmentURL(url)) return original(tokens, index, options, env, self);
    const escape = markdown.utils.escapeHtml;
    const alt = self.renderInlineAsText(token.children ?? [], options, env) || "Screenshot";
    return `<span class="annotation-markdown-attachment-image"><a class="annotation-markdown-linked-image-target" href="${escape(url)}">` +
      `<img class="annotation-markdown-linked-image-content" data-annotation-markdown-image-src="${escape(url)}" alt="${escape(alt)}" decoding="async"></a>` +
      `<a class="annotation-markdown-image-fallback" href="${escape(url)}">${escape(alt)} · Zotero</a></span>`;
  };
}
