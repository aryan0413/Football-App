import {
  advanceAuctionState,
  getAuctionSnapshot,
  nextAuctionPlayerId,
  parseAuctionState,
  writeAuctionStateCas,
  type AuctionControlState
} from "@/lib/auctionLive";
import { jsonError, requireGroupRole } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

type ControlAction = "PAUSE" | "RESUME" | "SKIP" | "UNSOLD";

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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const matchId = String(body.matchId ?? "");
    const action = String(body.action ?? "") as ControlAction;

    if (!matchId || !["PAUSE", "RESUME", "SKIP", "UNSOLD"].includes(action)) {
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

    await requireGroupRole(match.group_id, ["OWNER", "ADMIN"]);

    const snapshot = await getAuctionSnapshot(supabase, matchId);
    if (!snapshot.auction) return Response.json({ error: "Auction not found." }, { status: 404 });
    if (snapshot.auction.status === "ENDED" || snapshot.state.status === "ENDED") {
      return Response.json({ error: "Auction is already completed." }, { status: 400 });
    }

    const selectedIds = snapshot.selectedPlayers.map((player: any) => player.id);
    const previousNotes = snapshot.match.notes ?? null;
    let nextState = parseAuctionState(previousNotes, snapshot.state.status);
    nextState = {
      ...snapshot.state,
      version: nextState.version,
      updatedAt: nextState.updatedAt
    };

    if (action === "PAUSE") {
      if (snapshot.state.status !== "LIVE") return Response.json({ error: "Only a live auction can be paused." }, { status: 400 });
      nextState = { ...nextState, status: "PAUSED" };
    }

    if (action === "RESUME") {
      if (snapshot.state.status !== "PAUSED") return Response.json({ error: "Only a paused auction can be resumed." }, { status: 400 });
      nextState = { ...nextState, status: "LIVE", currentPlayerId: nextState.currentPlayerId ?? nextAuctionPlayerId(nextState, selectedIds) };
    }

    if (action === "SKIP" || action === "UNSOLD") {
      if (!["LIVE", "PAUSED"].includes(snapshot.state.status)) {
        return Response.json({ error: "Auction must be live or paused to move players." }, { status: 400 });
      }
      nextState = completeCurrentPlayer(nextState, selectedIds, action === "SKIP" ? "SKIPPED" : "UNSOLD");
      nextState.status = snapshot.state.status;
    }

    const written = await writeAuctionStateCas(supabase, matchId, previousNotes, nextState);
    if (!written) return Response.json({ error: "Auction changed. Sync and try again." }, { status: 409 });

    const fresh = await getAuctionSnapshot(supabase, matchId);
    return Response.json({ snapshot: fresh, state: fresh.state });
  } catch (error) {
    return jsonError(error);
  }
}
