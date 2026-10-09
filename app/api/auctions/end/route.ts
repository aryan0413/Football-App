import { jsonError, requireAppUser } from "@/lib/auth";
import { getAuctionSnapshot, writeAuctionStateCas, type AuctionControlState } from "@/lib/auctionLive";
import { getSupabaseAdmin } from "@/lib/supabase";

function canRunAuction(userId: string, role: string, state: AuctionControlState) {
  if (state.auctioneerId) return state.auctioneerId === userId;
  return role === "OWNER" || role === "ADMIN";
}

export async function POST(request: Request) {
  try {
    const user = await requireAppUser();
    const body = await request.json();
    const matchId = String(body.matchId ?? "");

    if (!matchId) {
      return Response.json({ error: "Match is required." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: match, error: matchError } = await supabase
      .from("matches")
      .select("id, group_id, status")
      .eq("id", matchId)
      .maybeSingle();

    if (matchError) throw matchError;
    if (!match) return Response.json({ error: "Match not found." }, { status: 404 });

    const { data: auction, error: auctionError } = await supabase
      .from("auctions")
      .select("id, status")
      .eq("match_id", matchId)
      .maybeSingle();

    if (auctionError) throw auctionError;
    if (!auction) return Response.json({ error: "Auction not found." }, { status: 404 });
    const snapshot = await getAuctionSnapshot(supabase, matchId);
    const { data: membership, error: memberError } = await supabase
      .from("group_members")
      .select("role")
      .eq("group_id", match.group_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (memberError) throw memberError;
    if (!membership) return Response.json({ error: "You are not in this group." }, { status: 403 });
    if (!canRunAuction(user.id, membership.role, snapshot.state)) {
      return Response.json({ error: "Only the selected auctioneer can complete the auction." }, { status: 403 });
    }
    if (auction.status === "ENDED" || snapshot.state.status === "ENDED") {
      return Response.json({ error: "Auction is already completed." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("auctions")
      .update({ status: "ENDED" })
      .eq("id", auction.id)
      .select("*")
      .single();

    if (error) throw error;
    await writeAuctionStateCas(supabase, matchId, snapshot.match.notes ?? null, { ...snapshot.state, status: "ENDED" });
    return Response.json({ auction: data, snapshot: await getAuctionSnapshot(supabase, matchId) });
  } catch (error) {
    return jsonError(error);
  }
}
