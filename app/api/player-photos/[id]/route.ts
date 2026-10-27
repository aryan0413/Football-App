import { auth } from "@clerk/nextjs/server";
import { unstable_cache } from "next/cache";
import sharp from "sharp";
import { playerPhotoVersion } from "@/lib/playerPhotos";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

const getPhoto = unstable_cache(async (id: string, version: string) => {
  const { data, error } = await getSupabaseAdmin().from("users").select("profile_image").eq("id", id).maybeSingle();
  if (error) throw error;
  const source = data?.profile_image;
  if (typeof source !== "string" || playerPhotoVersion(source) !== version) return null;
  const match = /^data:image\/(?:jpeg|png|webp|avif|gif);base64,([\s\S]+)$/.exec(source);
  if (!match) return null;
  const photo = await sharp(Buffer.from(match[1], "base64"), { limitInputPixels: 25000000 })
    .rotate().resize(256, 256, { fit: "cover", withoutEnlargement: true }).webp({ quality: 76 }).toBuffer();
  return photo.toString("base64");
}, ["player-photo-webp-v1"], { revalidate: 86400 });

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await auth()).userId) return new Response(null, { status: 401 });
  const { id } = await params;
  const version = new URL(request.url).searchParams.get("v") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f]{16}$/.test(version)) return new Response(null, { status: 400 });
  try {
    const photo = await getPhoto(id, version);
    if (!photo) return new Response(null, { status: 404 });
    return new Response(Buffer.from(photo, "base64"), { headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "private, max-age=86400, immutable",
      "X-Content-Type-Options": "nosniff"
    } });
  } catch {
    return new Response(null, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
