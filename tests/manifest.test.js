import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, test } from "vitest";
import { validateAddonManifest } from "../scripts/validate-addon-manifest.mjs";

describe("addon manifest", () => {
  test("targets Zotero 9 and 10 without claiming Zotero 7 or 8 support", async () => {
    const manifestPath = path.join(process.cwd(), "addon", "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

    expect(manifest.author).toBe("qrkks <qrkks3@gmail.com>");
    expect(manifest.applications.zotero.id).toBe("zotero-annotation-markdown@34028312.qq.com");
    expect(manifest.applications.zotero.strict_min_version).toBe("9.0");
    expect(manifest.applications.zotero.strict_max_version).toBe("10.0.*");
    // Zotero rejects the entire extension if this field is absent.
    expect(manifest.applications.zotero.update_url).toBe(
      "https://raw.githubusercontent.com/qrkks/zotero-annotation-markdown/main/updates.json"
    );
    expect(() => validateAddonManifest(manifest)).not.toThrow();
    delete manifest.applications.zotero.update_url;
    expect(() => validateAddonManifest(manifest)).toThrow("applications.zotero.update_url");
  });

  test("declares an add-on manager icon", async () => {
    const manifestPath = path.join(process.cwd(), "addon", "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

    expect(manifest.icons["16"]).toBe("icons/annotation-markdown.svg");
    expect(manifest.icons["32"]).toBe("icons/annotation-markdown.svg");
    expect(manifest.icons["48"]).toBe("icons/annotation-markdown.svg");
  });
});
