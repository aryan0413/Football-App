import { currentUser } from "@clerk/nextjs/server";
import { jsonError, requireClerkUserId } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { Position } from "@/lib/types";

const positions = new Set<Position>([
  "GK",
  "LB",
  "CB",
  "RB",
  "LWB",
  "RWB",
  "CDM",
  "CM",
  "CAM",
  "LM",
  "RM",
  "LW",
  "RW",
  "CF",
  "ST",
  "DEF",
  "MID",
  "FWD"
]);

function createUsername(displayName: string, clerkUserId: string) {
  const base = displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 16) || "player";
  const suffix = clerkUserId.toLowerCase().replace(/[^a-z0-9]/g, "").slice(-6) || "fc";
  return `${base}_${suffix}`.slice(0, 24);
}

export async function POST(request: Request) {
  try {
    const clerkUserId = await requireClerkUserId();
    const clerkUser = await currentUser();
    const body = await request.json();
    const displayName = String(body.displayName ?? "").trim();
    const username = createUsername(displayName, clerkUserId);
    const profileImage = String(body.profileImage ?? clerkUser?.imageUrl ?? "").trim() || null;
    const preferredPosition = String(body.preferredPosition ?? "") as Position;
    const secondaryPosition = body.secondaryPosition ? String(body.secondaryPosition) as Position : null;

    if (!displayName) return Response.json({ error: "Name is required." }, { status: 400 });
    if (!positions.has(preferredPosition)) return Response.json({ error: "Preferred position is invalid." }, { status: 400 });
    if (secondaryPosition && !positions.has(secondaryPosition)) return Response.json({ error: "Secondary position is invalid." }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("users")
      .upsert(
        {
          clerk_user_id: clerkUserId,
          username,
          display_name: displayName,
          phone: null,
          profile_image: profileImage,
          preferred_position: preferredPosition,
          secondary_position: secondaryPosition
        },
        { onConflict: "clerk_user_id" }
      )
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        return Response.json({ error: "That profile name is already in use. Try adding an initial." }, { status: 409 });
      }
      if (error.message?.includes("position_code") || error.message?.includes("invalid input value for enum")) {
        return Response.json(
          { error: "Supabase needs the new football positions added. Run supabase/add-detailed-positions.sql once, then save again." },
          { status: 400 }
        );
      }
      throw error;
    }

    return Response.json({ user: data });
  } catch (error) {
    return jsonError(error);
  }
}
