export function optimizedPhotoUrl(url: string | null | undefined, size = 96) {
  if (!url) return null;
  if (url.startsWith("data:")) return url;
  if (url.includes("/storage/v1/object/public/")) {
    const [base, query = ""] = url.split("?");
    const transformed = base.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/");
    const params = new URLSearchParams(query);
    params.set("width", String(size));
    params.set("height", String(size));
    params.set("resize", "cover");
    params.set("quality", size > 160 ? "76" : "70");
    return `${transformed}?${params.toString()}`;
  }
  return url;
}

export function fallbackPhoto() {
  return "/icons/icon-192.svg";
}
