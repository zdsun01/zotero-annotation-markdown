import { describe, expect, test, vi } from "vitest";
import { createZoteroImageStore } from "../src/zotero-image-store.ts";

function setup(group = false) {
  const pdf = { id: 42, libraryID: 1, parentID: 7, isAttachment: () => true };
  const annotation = { parentID: 42, isAnnotation: () => true };
  const image = { key: "ABCD1234", attachmentContentType: "image/png", isAttachment: () => true, isImportedAttachment: () => true, getFilePathAsync: vi.fn().mockResolvedValue("/storage/ABCD1234/image.png") };
  const temp = { path: "/temp/unique.png", append: vi.fn(), createUnique: vi.fn(), exists: () => true, remove: vi.fn() };
  const library = { libraryType: group ? "group" : "user", editable: true, filesEditable: true };
  const host = {
    Items: { get: () => pdf, getByLibraryAndKey: (_library, key) => key === "NOTE1234" ? annotation : image },
    Libraries: { get: () => library }, Groups: { getGroupIDFromLibraryID: () => 123 },
    File: { putContentsAsync: vi.fn().mockResolvedValue(), getBinaryContentsAsync: vi.fn().mockResolvedValue("PNG") },
    Attachments: { importFromFile: vi.fn().mockResolvedValue(image) }, getTempDirectory: () => temp
  };
  return { host, temp, library, image, annotation, store: createZoteroImageStore(host, 42, btoa) };
}

describe("Zotero image storage", () => {
  test.each([false, true])("imports an ordinary sibling attachment and resolves stable keys (group=%s)", async group => {
    const { host, store, temp } = setup(group);
    const file = new Blob(["PNG"], { type: "image/png" });
    const url = await store.importImage(file, "NOTE1234");
    expect(url).toBe(`zotero://select/${group ? "groups/123" : "library"}/items/ABCD1234`);
    expect(host.Attachments.importFromFile).toHaveBeenCalledWith(expect.objectContaining({ parentItemID: 7, libraryID: 1, contentType: "image/png" }));
    expect(temp.remove).toHaveBeenCalledWith(false);
    expect(await store.loadImage(url)).toBe("data:image/png;base64,UE5H");
  });
  test("cleans only the temporary file after failed imports", async () => {
    const { host, store, temp } = setup();
    host.Attachments.importFromFile.mockRejectedValue(new Error("Disk full"));
    await expect(store.importImage(new Blob(["PNG"], { type: "image/png" }), "NOTE1234")).rejects.toThrow("Disk full");
    expect(temp.remove).toHaveBeenCalledExactlyOnceWith(false);
  });
  test("retains the attachment reference if temporary-file cleanup fails", async () => {
    const { store, temp } = setup();
    temp.remove.mockImplementation(() => { throw new Error("Temporary file is busy"); });
    await expect(store.importImage(new Blob(["PNG"], { type: "image/png" }), "NOTE1234"))
      .resolves.toBe("zotero://select/library/items/ABCD1234");
  });
  test("does not write to read-only libraries or a different/deleted annotation", async () => {
    const { store, library, host, annotation } = setup();
    const file = new Blob(["PNG"], { type: "image/png" });
    library.filesEditable = false;
    await expect(store.importImage(file, "NOTE1234")).rejects.toThrow("does not allow");
    library.filesEditable = true;
    annotation.parentID = 43;
    await expect(store.importImage(file, "NOTE1234")).rejects.toThrow("Annotation unavailable");
    expect(host.File.putContentsAsync).not.toHaveBeenCalled();
  });
  test("refuses cross-library references, linked files, non-images and missing files", async () => {
    const { store, image, host } = setup();
    await expect(store.loadImage("zotero://select/groups/123/items/ABCD1234")).rejects.toThrow("another library");
    image.isImportedAttachment = () => false;
    await expect(store.loadImage("zotero://select/library/items/ABCD1234")).rejects.toThrow("unavailable");
    image.isImportedAttachment = () => true;
    image.attachmentContentType = "text/html";
    await expect(store.loadImage("zotero://select/library/items/ABCD1234")).rejects.toThrow("unavailable");
    image.attachmentContentType = "image/png";
    image.getFilePathAsync.mockResolvedValue(false);
    await expect(store.loadImage("zotero://select/library/items/ABCD1234")).rejects.toThrow("Download");
    expect(host.File.getBinaryContentsAsync).not.toHaveBeenCalled();
  });
});
