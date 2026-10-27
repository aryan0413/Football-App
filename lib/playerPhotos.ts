import { createHash } from "node:crypto";

export function playerPhotoVersion(photo: string) {
  return createHash("sha256").update(photo).digest("hex").slice(0, 16);
}

// Legacy uploads stay in the database, but never travel inside page/live-state JSON.
export function withPlayerPhotoUrls<T>(value: T): T {
  const versions = new Map<string, string>();
  function visit(item: any): any {
    if (Array.isArray(item)) return item.map(visit);
    if (!item || typeof item !== "object") return item;
    const result = Object.fromEntries(Object.entries(item).map(([key, child]) => [key, visit(child)]));
    if (typeof item.id === "string" && typeof item.profile_image === "string" && item.profile_image.startsWith("data:")) {
      let url = versions.get(item.id);
      if (!url) {
        url = `/api/player-photos/${encodeURIComponent(item.id)}?v=${playerPhotoVersion(item.profile_image)}`;
        versions.set(item.id, url);
      }
      result.profile_image = url;
    }
    return result;
  }
  return visit(value) as T;
}
