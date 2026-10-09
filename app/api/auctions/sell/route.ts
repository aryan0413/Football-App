import { jsonError, requireGroupRole } from "@/lib/auth";
import { advanceAuctionState, getAuctionSnapshot, writeAuctionStateCas } from "@/lib/auctionLive";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const matchId = String(body.matchId ?? "");
    const playerId = String(body.playerId ?? "");

    if (!matchId || !playerId) {
      return Response.json({ error: "Match and player are required." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: match, error: matchError } = await supabase
      .from("matches")
      .select("id, group_id")
      .eq("id", matchId)
      .maybeSingle();
    if (matchError) throw matchError;
    if (!match) return Response.json({ error: "Match not found." }, { status: 404 });

    await requireGroupRole(match.group_id, ["OWNER", "ADMIN"]);

    const snapshot = await getAuctionSnapshot(supabase, matchId);
    const auction = snapshot.auction;
    if (!auction) return Response.json({ error: "Auction not found." }, { status: 404 });
    if (auction.status !== "LIVE" || snapshot.state.status !== "LIVE") return Response.json({ error: "Auction is not live." }, { status: 400 });
    if (snapshot.state.currentPlayerId !== playerId) {
      return Response.json({ error: "Only the current auction player can be sold." }, { status: 400 });
    }
    if (snapshot.state.completed[playerId]) return Response.json({ error: "Player is already completed." }, { status: 400 });

    const { data: auctionPlayer, error: auctionPlayerError } = await supabase
      .from("match_availability")
      .select("user_id")
      .eq("match_id", matchId)
      .eq("user_id", playerId)
      .eq("status", "PLAYING")
      .maybeSingle();
    if (auctionPlayerError) throw auctionPlayerError;
    if (!auctionPlayer) return Response.json({ error: "Player is not in the selected auction pool." }, { status: 400 });

    const highestBid = snapshot.state.currentBid;
    if (!highestBid) return Response.json({ error: "No bid placed for this player yet." }, { status: 400 });

    const selectedIds = snapshot.selectedPlayers.map((player: any) => player.id);
    const completed = {
      ...snapshot.state.completed,
      [playerId]: {
        status: "SOLD" as const,
        playerId,
        teamId: highestBid.teamId,
        amount: Number(highestBid.amount),
        at: new Date().toISOString()
      }
    };
    const nextState = advanceAuctionState({ ...snapshot.state, completed, currentBid: null }, selectedIds);
    const written = await writeAuctionStateCas(supabase, matchId, snapshot.match.notes ?? null, nextState);
    if (!written) return Response.json({ error: "Auction changed. Sync and try again." }, { status: 409 });

    const { data, error } = await supabase
      .from("team_players")
      .upsert({
        team_id: highestBid.teamId,
        player_id: playerId,
        auction_price: Number(highestBid.amount)
      }, { onConflict: "team_id,player_id" })
      .select("*")
      .single();

    if (error) throw error;
    return Response.json({ player: data, snapshot: await getAuctionSnapshot(supabase, matchId) });
  } catch (error) {
    return jsonError(error);
  }
}
