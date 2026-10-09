import { jsonError, requireAppUser } from "@/lib/auth";
import { minimumAuctionBid, parseAuctionState, pushAuctionUndo, writeAuctionStateCas } from "@/lib/auctionLive";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const user = await requireAppUser();
    const body = await request.json();
    const matchId = String(body.matchId ?? "");
    const playerId = String(body.playerId ?? "");
    const amount = Number(body.amount ?? 0);

    if (!matchId || !playerId || !amount) {
      return Response.json({ error: "Match, player, and bid amount are required." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const [{ data: match, error: matchError }, { data: auction, error: auctionError }, { data: captainTeam, error: captainError }] = await Promise.all([
      supabase.from("matches").select("id, group_id, notes").eq("id", matchId).maybeSingle(),
      supabase.from("auctions").select("id, status, starting_purse").eq("match_id", matchId).maybeSingle(),
      supabase
        .from("teams")
        .select("id, name, captain_id, team_players(auction_price)")
        .eq("match_id", matchId)
        .eq("captain_id", user.id)
        .maybeSingle()
    ]);

    if (matchError) throw matchError;
    if (auctionError) throw auctionError;
    if (captainError) throw captainError;
    if (!match) return Response.json({ error: "Match not found." }, { status: 404 });
    if (!auction) return Response.json({ error: "Auction not found." }, { status: 404 });
    if (!captainTeam) return Response.json({ error: "Only selected captains can bid from their device." }, { status: 403 });

    const state = parseAuctionState(match.notes, auction.status === "LIVE" ? "LIVE" : "DRAFT");
    if (auction.status !== "LIVE" || state.status !== "LIVE") {
      return Response.json({ error: "Auction is not live." }, { status: 400 });
    }
    if (state.currentPlayerId !== playerId) {
      return Response.json({ error: "You can bid only on the current auction player." }, { status: 400 });
    }
    if (!state.order.includes(playerId) || state.completed[playerId]) {
      return Response.json({ error: "Player is not available for bidding." }, { status: 400 });
    }
    if (state.currentBid?.teamId === captainTeam.id) {
      return Response.json({ error: "Your team is already the highest bidder." }, { status: 400 });
    }

    const { data: groupMember, error: memberError } = await supabase
      .from("group_members")
      .select("id")
      .eq("group_id", match.group_id)
      .eq("user_id", playerId)
      .maybeSingle();
    if (memberError) throw memberError;
    if (!groupMember) return Response.json({ error: "Player is not in this group." }, { status: 400 });

    const minimum = minimumAuctionBid(state.currentBid);
    if (amount < minimum) {
      return Response.json({ error: `Minimum bid is ${minimum}.` }, { status: 400 });
    }

    const spent = (captainTeam.team_players ?? []).reduce((sum: number, row: any) => sum + Number(row.auction_price ?? 0), 0);
    const purse = Number(auction.starting_purse ?? 0);
    if (amount > purse - spent) {
      return Response.json({ error: "Bid exceeds your remaining purse." }, { status: 400 });
    }

    const bidId = crypto.randomUUID();
    const bidState = {
      id: bidId,
      playerId,
      teamId: captainTeam.id,
      amount,
      bidderUserId: user.id,
      createdAt: new Date().toISOString()
    };
    const nextState = {
      ...state,
      currentBid: bidState,
      bidHistory: [bidState, ...state.bidHistory].slice(0, 250),
      undoStack: pushAuctionUndo(state, "BID", { bidId })
    };
    const written = await writeAuctionStateCas(supabase, matchId, match.notes ?? null, nextState);
    if (!written) return Response.json({ error: "Another captain bid first. Syncing latest auction state." }, { status: 409 });

    const { error: bidError } = await supabase
      .from("auction_bids")
      .insert({
        id: bidId,
        auction_id: auction.id,
        player_id: playerId,
        team_id: captainTeam.id,
        amount
      });

    const savedState = parseAuctionState(written.notes, "LIVE");
    return Response.json({
      bid: bidState,
      state: savedState,
      message: bidError ? "Bid saved live. Bid log will resync." : "Bid placed."
    });
  } catch (error) {
    return jsonError(error);
  }
}
