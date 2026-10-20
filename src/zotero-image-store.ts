import { MAX_CLIPBOARD_IMAGE_BYTES, RASTER_IMAGE_TYPE, parseImageAttachmentURL, validateClipboardImage } from "./clipboard-image.js";

interface ImageItem {
  id: number;
  key: string;
  libraryID: number;
  parentID?: number | false;
  deleted?: boolean;
  attachmentContentType?: string;
  isAttachment(): boolean;
  isAnnotation(): boolean;
  isImportedAttachment(): boolean;
  getFilePathAsync(): Promise<string | false>;
}

interface TempFile {
  path: string;
  append(name: string): void;
  createUnique(type: number, permissions: number): void;
  exists(): boolean;
  remove(recursive: boolean): void;
}

export interface ZoteroImageApi {
  Items: {
    get(id: number): ImageItem | false;
    getByLibraryAndKey(libraryID: number, key: string): ImageItem | false;
  };
  Libraries: { get(id: number): { libraryType: string; editable: boolean; filesEditable: boolean } };
  Groups: { getGroupIDFromLibraryID(id: number): number };
  Attachments: { importFromFile(options: {
    file: string; libraryID: number; parentItemID?: number; title: string; contentType: string;
  }): Promise<ImageItem> };
  File: {
    putContentsAsync(file: TempFile, data: Blob): Promise<unknown>;
    getBinaryContentsAsync(path: string, maxLength: number): Promise<string>;
  };
  getTempDirectory(): TempFile;
}

export function createZoteroImageStore(host: ZoteroImageApi, readerItemID: number, encode: (binary: string) => string) {
  function context() {
    const pdf = host.Items.get(readerItemID);
    if (!pdf || pdf.deleted || !pdf.isAttachment()) throw new Error("Reader attachment unavailable / 文档附件不可用");
    const library = host.Libraries.get(pdf.libraryID);
    const scope = library.libraryType === "user" ? "library"
      : library.libraryType === "group" ? `groups/${host.Groups.getGroupIDFromLibraryID(pdf.libraryID)}` : "";
    if (!scope) throw new Error("Unsupported library / 不支持此文献库");
    return { pdf, library, scope };
  }

  return {
    async importImage(file: Blob, annotationID: string): Promise<string> {
      validateClipboardImage(file);
      const { pdf, library, scope } = context();
      if (!library.editable || !library.filesEditable) throw new Error("This library does not allow adding files / 此文献库不允许添加文件");
      const annotation = host.Items.getByLibraryAndKey(pdf.libraryID, annotationID);
      if (!annotation || annotation.deleted || !annotation.isAnnotation() || annotation.parentID !== pdf.id) {
        throw new Error("Annotation unavailable; reopen it and paste again / 请重新打开批注后粘贴");
      }
      const extension = file.type === "image/jpeg" ? "jpg" : file.type.slice(6);
      const temp = host.getTempDirectory();
      temp.append(`annotation-${annotationID}.${extension}`);
      temp.createUnique(0, 0o600);
      try {
        await host.File.putContentsAsync(temp, file);
        const attachment = await host.Attachments.importFromFile({
          file: temp.path, libraryID: pdf.libraryID,
          ...(pdf.parentID ? { parentItemID: pdf.parentID } : {}),
          title: `Annotation screenshot (${annotationID})`, contentType: file.type
        });
        return `zotero://select/${scope}/items/${attachment.key}`;
      } finally {
        // Only the uniquely created temporary file belongs to this operation.
        // A cleanup failure must not hide a successfully imported attachment.
        // Zotero also cleans its temporary directory on normal shutdown.
        try { if (temp.exists()) temp.remove(false); } catch { /* Keep the import result. */ }
      }
    },
    async loadImage(url: string): Promise<string> {
      const reference = parseImageAttachmentURL(url);
      const { pdf, scope } = context();
      if (!reference || reference.scope !== scope) throw new Error("Image belongs to another library");
      const item = host.Items.getByLibraryAndKey(pdf.libraryID, reference.key);
      if (!item || item.deleted || !item.isAttachment() || !item.isImportedAttachment() ||
          !RASTER_IMAGE_TYPE.test(item.attachmentContentType ?? "")) throw new Error("Image attachment unavailable");
      const path = await item.getFilePathAsync();
      if (!path) throw new Error("Download this image attachment in Zotero first");
      const binary = await host.File.getBinaryContentsAsync(path, MAX_CLIPBOARD_IMAGE_BYTES + 1);
      if (!binary.length || binary.length > MAX_CLIPBOARD_IMAGE_BYTES) throw new Error("Image exceeds preview size limit");
      return `data:${item.attachmentContentType};base64,${encode(binary)}`;
    }
  };
}
