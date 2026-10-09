import { jsonError, requireAppUser } from "@/lib/auth";
import { getAuctionSnapshot, minimumAuctionBid, parseAuctionState, writeAuctionStateCas } from "@/lib/auctionLive";
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
    let snapshot;
    try {
      snapshot = await getAuctionSnapshot(supabase, matchId);
    } catch (error) {
      if (error instanceof Error && error.message === "Match not found.") {
        return Response.json({ error: "Match not found." }, { status: 404 });
      }
      throw error;
    }

    const auction = snapshot.auction;
    if (!auction || auction.status !== "LIVE" || snapshot.state.status !== "LIVE") {
      return Response.json({ error: "Auction is not live." }, { status: 400 });
    }
    if (snapshot.state.currentPlayerId !== playerId) {
      return Response.json({ error: "You can bid only on the current auction player." }, { status: 400 });
    }

    const { data: captainTeam, error: captainError } = await supabase
      .from("teams")
      .select("id, name, captain_id")
      .eq("match_id", matchId)
      .eq("captain_id", user.id)
      .maybeSingle();
    if (captainError) throw captainError;
    if (!captainTeam) {
      return Response.json({ error: "Only selected captains can bid from their device." }, { status: 403 });
    }

    const { data: groupMember, error: memberError } = await supabase
      .from("group_members")
      .select("id")
      .eq("group_id", snapshot.match.group_id)
      .eq("user_id", playerId)
      .maybeSingle();
    if (memberError) throw memberError;
    if (!groupMember) return Response.json({ error: "Player is not in this group." }, { status: 400 });

    const { data: auctionPlayer, error: auctionPlayerError } = await supabase
      .from("match_availability")
      .select("user_id")
      .eq("match_id", matchId)
      .eq("user_id", playerId)
      .eq("status", "PLAYING")
      .maybeSingle();
    if (auctionPlayerError) throw auctionPlayerError;
    if (!auctionPlayer) return Response.json({ error: "Player is not in the selected auction pool." }, { status: 400 });

    if (snapshot.state.completed[playerId]) return Response.json({ error: "Player is already completed." }, { status: 400 });
    if (snapshot.state.currentBid?.teamId === captainTeam.id) {
      return Response.json({ error: "Your team is already the highest bidder." }, { status: 400 });
    }

    const minimum = minimumAuctionBid(snapshot.state.currentBid);
    if (amount < minimum) {
      return Response.json({ error: `Minimum bid is ${minimum}.` }, { status: 400 });
    }

    const team = snapshot.teams.find((item: any) => item.id === captainTeam.id);
    const spent = (team?.team_players ?? []).reduce((sum: number, row: any) => sum + Number(row.auction_price ?? 0), 0);
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
      ...snapshot.state,
      currentBid: bidState,
      bidHistory: [bidState, ...snapshot.state.bidHistory].slice(0, 250)
    };
    const written = await writeAuctionStateCas(supabase, matchId, snapshot.match.notes ?? null, nextState);
    if (!written) return Response.json({ error: "Another captain bid first. Syncing latest auction state." }, { status: 409 });

    const { data: bid, error } = await supabase
      .from("auction_bids")
      .insert({
        id: bidId,
        auction_id: auction.id,
        player_id: playerId,
        team_id: captainTeam.id,
        amount
      })
      .select("*")
      .single();

    if (error) throw error;
    const savedState = parseAuctionState(written.notes, "LIVE");
    return Response.json({
      bid,
      snapshot: {
        ...snapshot,
        match: { ...snapshot.match, notes: written.notes },
        state: savedState,
        bids: [{ ...bid, teams: { name: captainTeam.name } }, ...(snapshot.bids ?? [])]
      }
    });
  } catch (error) {
    return jsonError(error);
  }
}
