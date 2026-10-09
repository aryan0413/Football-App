import {
  advanceAuctionState,
  getAuctionSnapshot,
  nextAuctionPlayerId,
  parseAuctionState,
  pushAuctionUndo,
  writeAuctionStateCas,
  type AuctionControlState
} from "@/lib/auctionLive";
import { jsonError, requireAppUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

type ControlAction = "STOP" | "RESUME" | "SKIP" | "UNSOLD" | "RESTART" | "UNDO";

function canRunAuction(userId: string, role: string, state: AuctionControlState) {
  if (state.auctioneerId) return state.auctioneerId === userId;
  return role === "OWNER" || role === "ADMIN";
}

function completeCurrentPlayer(state: AuctionControlState, selectedPlayerIds: string[], status: "SKIPPED" | "UNSOLD") {
  if (!state.currentPlayerId) throw new Error("No current player selected.");
  const completed = {
    ...state.completed,
    [state.currentPlayerId]: {
      status,
      playerId: state.currentPlayerId,
      at: new Date().toISOString()
    }
  };
  return advanceAuctionState({ ...state, completed, currentBid: null }, selectedPlayerIds);
}

async function freshResponse(supabase: any, matchId: string) {
  const snapshot = await getAuctionSnapshot(supabase, matchId);
  return Response.json({ snapshot, state: snapshot.state });
}

export async function POST(request: Request) {
  try {
    const user = await requireAppUser();
    const body = await request.json();
    const matchId = String(body.matchId ?? "");
    const action = String(body.action ?? "") as ControlAction;

    if (!matchId || !["STOP", "RESUME", "SKIP", "UNSOLD", "RESTART", "UNDO"].includes(action)) {
      return Response.json({ error: "Valid auction action is required." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: match, error: matchError } = await supabase
      .from("matches")
      .select("id, group_id, notes")
      .eq("id", matchId)
      .maybeSingle();
    if (matchError) throw matchError;
    if (!match) return Response.json({ error: "Match not found." }, { status: 404 });

    const { data: membership, error: memberError } = await supabase
      .from("group_members")
      .select("role")
      .eq("group_id", match.group_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (memberError) throw memberError;
    if (!membership) return Response.json({ error: "You are not in this group." }, { status: 403 });

    const snapshot = await getAuctionSnapshot(supabase, matchId);
    if (!snapshot.auction) return Response.json({ error: "Auction not found." }, { status: 404 });
    if (snapshot.auction.status === "ENDED" || snapshot.state.status === "ENDED") {
      return Response.json({ error: "Auction is already completed." }, { status: 400 });
    }
    if (!canRunAuction(user.id, membership.role, snapshot.state)) {
      return Response.json({ error: "Only the selected auctioneer can run auction controls." }, { status: 403 });
    }

    const selectedIds = snapshot.selectedPlayers.map((player: any) => player.id);
    const previousNotes = snapshot.match.notes ?? null;

    if (action === "RESTART") {
      const teamIds = (snapshot.teams ?? []).map((team: any) => team.id).filter(Boolean);
      if (teamIds.length) {
        const { error: teamPlayerError } = await supabase.from("team_players").delete().in("team_id", teamIds);
        if (teamPlayerError) throw teamPlayerError;
      }
      if (snapshot.auction?.id) {
        const { error: bidDeleteError } = await supabase.from("auction_bids").delete().eq("auction_id", snapshot.auction.id);
        if (bidDeleteError) throw bidDeleteError;
      }
      const { error: liveError } = await supabase.from("auctions").update({ status: "LIVE" }).eq("id", snapshot.auction.id);
      if (liveError) throw liveError;

      const resetBase = {
        ...snapshot.state,
        status: "LIVE" as const,
        completed: {},
        currentBid: null,
        bidHistory: [],
        undoStack: []
      };
      const nextState = {
        ...resetBase,
        currentPlayerId: nextAuctionPlayerId({ ...resetBase, currentPlayerId: null }, selectedIds)
      };
      const written = await writeAuctionStateCas(supabase, matchId, previousNotes, nextState);
      if (!written) return Response.json({ error: "Auction changed. Sync and try again." }, { status: 409 });
      return freshResponse(supabase, matchId);
    }

    if (action === "UNDO") {
      const [frame] = snapshot.state.undoStack ?? [];
      if (!frame) return Response.json({ error: "Nothing to undo." }, { status: 400 });

      if (frame.bidId) {
        const { error: bidDeleteError } = await supabase.from("auction_bids").delete().eq("id", frame.bidId);
        if (bidDeleteError) throw bidDeleteError;
      }
      if (frame.teamPlayer) {
        const { error: playerDeleteError } = await supabase
          .from("team_players")
          .delete()
          .eq("team_id", frame.teamPlayer.teamId)
          .eq("player_id", frame.teamPlayer.playerId);
        if (playerDeleteError) throw playerDeleteError;
      }

      const nextState = frame.state as AuctionControlState;
      const written = await writeAuctionStateCas(supabase, matchId, previousNotes, nextState);
      if (!written) return Response.json({ error: "Auction changed. Sync and try again." }, { status: 409 });
      return freshResponse(supabase, matchId);
    }

    let nextState = parseAuctionState(previousNotes, snapshot.state.status);
    nextState = {
      ...snapshot.state,
      version: nextState.version,
      updatedAt: nextState.updatedAt
    };

    if (action === "STOP") {
      if (!["LIVE", "PAUSED"].includes(snapshot.state.status)) {
        return Response.json({ error: "Only an active auction can be stopped." }, { status: 400 });
      }
      nextState = { ...nextState, status: "PAUSED", undoStack: pushAuctionUndo(nextState, "STOP") };
    }

    if (action === "RESUME") {
      if (!["PAUSED", "DRAFT"].includes(snapshot.state.status)) {
        return Response.json({ error: "Only a stopped auction can be resumed." }, { status: 400 });
      }
      nextState = {
        ...nextState,
        status: "LIVE",
        currentPlayerId: nextState.currentPlayerId ?? nextAuctionPlayerId(nextState, selectedIds),
        undoStack: pushAuctionUndo(nextState, "RESUME")
      };
    }

    if (action === "SKIP" || action === "UNSOLD") {
      if (!["LIVE", "PAUSED"].includes(snapshot.state.status)) {
        return Response.json({ error: "Auction must be live or stopped to move players." }, { status: 400 });
      }
      const withFrame = {
        ...nextState,
        undoStack: pushAuctionUndo(nextState, action)
      };
      nextState = completeCurrentPlayer(withFrame, selectedIds, action === "SKIP" ? "SKIPPED" : "UNSOLD");
      nextState.status = snapshot.state.status;
    }

    const written = await writeAuctionStateCas(supabase, matchId, previousNotes, nextState);
    if (!written) return Response.json({ error: "Auction changed. Sync and try again." }, { status: 409 });

    return freshResponse(supabase, matchId);
  } catch (error) {
    return jsonError(error);
  }
}
