/** Required by Zotero's ExtensionData loader, beyond Mozilla's generic schema. */
export function validateAddonManifest(manifest) {
  const application = manifest?.applications?.zotero;
  for (const key of ["id", "update_url", "strict_max_version"]) {
    if (typeof application?.[key] !== "string" || !application[key].trim()) {
      throw new Error(`Zotero requires applications.zotero.${key}; cannot package an installable XPI without it`);
    }
  }
  if (new URL(application.update_url).protocol !== "https:") {
    throw new Error("Plugin update_url must be an HTTPS URL");
  }
}
