import { getAuctionSnapshot } from "@/lib/auctionLive";
import { jsonError, requireAppUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET(request: Request) {
  try {
    const user = await requireAppUser();
    const { searchParams } = new URL(request.url);
    const matchId = String(searchParams.get("matchId") ?? "");
    if (!matchId) return Response.json({ error: "Match is required." }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const snapshot = await getAuctionSnapshot(supabase, matchId);
    const { data: membership, error: membershipError } = await supabase
      .from("group_members")
      .select("role")
      .eq("group_id", snapshot.match.group_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (membershipError) throw membershipError;
    if (!membership) return Response.json({ error: "Forbidden" }, { status: 403 });

    return Response.json({ snapshot });
  } catch (error) {
    return jsonError(error);
  }
}
