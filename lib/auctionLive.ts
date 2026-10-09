import { AUCTION_BASE_PRICE, nextRequiredBid } from "@/lib/auctionRules";

export type AuctionControlStatus = "DRAFT" | "LIVE" | "PAUSED" | "ENDED";
export type AuctionPlayerResult = "SOLD" | "UNSOLD" | "SKIPPED";

export type AuctionBidState = {
  id: string;
  playerId: string;
  teamId: string;
  amount: number;
  bidderUserId: string;
  createdAt: string;
};

export type AuctionCompletionState = {
  status: AuctionPlayerResult;
  playerId: string;
  teamId?: string | null;
  amount?: number;
  at: string;
};

export type AuctionUndoFrame = {
  id: string;
  action: "BID" | "SELL" | "SKIP" | "UNSOLD" | "STOP" | "RESUME";
  state: Omit<AuctionControlState, "undoStack"> & { undoStack?: AuctionUndoFrame[] };
  bidId?: string;
  teamPlayer?: { teamId: string; playerId: string };
  at: string;
};

export type AuctionControlState = {
  kind: "football-auction-state-v1";
  version: number;
  status: AuctionControlStatus;
  order: string[];
  auctioneerId: string | null;
  currentPlayerId: string | null;
  currentBid: AuctionBidState | null;
  completed: Record<string, AuctionCompletionState>;
  bidHistory: AuctionBidState[];
  undoStack: AuctionUndoFrame[];
  updatedAt: string;
};

export type AuctionSnapshot = {
  auction: any;
  match: any;
  state: AuctionControlState;
  teams: any[];
  selectedPlayers: any[];
  auctioneer: any | null;
  currentPlayer: any | null;
  remainingPlayers: any[];
  completedPlayers: Array<AuctionCompletionState & { player: any | null; teamName?: string | null }>;
  bids: any[];
  readyRows: Array<{ user_id: string; role: string }>;
};

export function emptyAuctionState(status: AuctionControlStatus = "DRAFT"): AuctionControlState {
  return {
    kind: "football-auction-state-v1",
    version: 1,
    status,
    order: [],
    auctioneerId: null,
    currentPlayerId: null,
    currentBid: null,
    completed: {},
    bidHistory: [],
    undoStack: [],
    updatedAt: new Date().toISOString()
  };
}

export function parseAuctionState(notes: string | null | undefined, fallbackStatus: AuctionControlStatus = "DRAFT") {
  if (!notes) return emptyAuctionState(fallbackStatus);

  try {
    const parsed = JSON.parse(notes);
    if (parsed?.kind === "football-auction-state-v1") {
      return {
        ...emptyAuctionState(fallbackStatus),
        ...parsed,
        completed: parsed.completed ?? {},
        bidHistory: Array.isArray(parsed.bidHistory) ? parsed.bidHistory : [],
        undoStack: Array.isArray(parsed.undoStack) ? parsed.undoStack.slice(0, 30) : [],
        auctioneerId: typeof parsed.auctioneerId === "string" ? parsed.auctioneerId : null,
        order: Array.isArray(parsed.order) ? parsed.order : []
      } as AuctionControlState;
    }
  } catch {
  }

  return emptyAuctionState(fallbackStatus);
}

export function serializeAuctionState(state: AuctionControlState) {
  return JSON.stringify(state);
}

export function normalizeAuctionState(
  state: AuctionControlState,
  selectedPlayerIds: string[],
  soldRows: Array<{ playerId: string; teamId: string; amount: number }>,
  auctionStatus: string | null | undefined
) {
  const selectedSet = new Set(selectedPlayerIds);
  const now = new Date().toISOString();
  const completed = { ...state.completed };

  soldRows.forEach((row) => {
    if (!selectedSet.has(row.playerId)) return;
    completed[row.playerId] ??= {
      status: "SOLD",
      playerId: row.playerId,
      teamId: row.teamId,
      amount: Number(row.amount ?? 0),
      at: now
    };
  });

  const order = [
    ...state.order.filter((id) => selectedSet.has(id)),
    ...selectedPlayerIds.filter((id) => !state.order.includes(id))
  ];

  let currentPlayerId = state.currentPlayerId && selectedSet.has(state.currentPlayerId) && !completed[state.currentPlayerId]
    ? state.currentPlayerId
    : null;
  let status = state.status;

  if (auctionStatus === "ENDED") status = "ENDED";
  if (auctionStatus === "LIVE" && status === "DRAFT") status = "LIVE";
  if (auctionStatus === "DRAFT" && status !== "ENDED") status = "DRAFT";

  if (status === "LIVE" && !currentPlayerId) {
    currentPlayerId = nextAuctionPlayerId({ ...state, order, completed, currentPlayerId: null }, selectedPlayerIds);
  }

  return {
    ...state,
    status,
    order,
    currentPlayerId,
    currentBid: state.currentBid && state.currentBid.playerId === currentPlayerId && !completed[state.currentBid.playerId]
      ? state.currentBid
      : null,
    completed
  };
}

export function nextAuctionPlayerId(state: AuctionControlState, selectedPlayerIds: string[]) {
  const order = state.order.length ? state.order : selectedPlayerIds;
  return order.find((playerId) => selectedPlayerIds.includes(playerId) && !state.completed[playerId]) ?? null;
}

export function advanceAuctionState(state: AuctionControlState, selectedPlayerIds: string[]) {
  const nextId = nextAuctionPlayerId({ ...state, currentPlayerId: null }, selectedPlayerIds);
  return {
    ...state,
    currentPlayerId: nextId,
    currentBid: null
  };
}

export function bumpAuctionState(state: AuctionControlState) {
  return {
    ...state,
    version: Number(state.version ?? 0) + 1,
    updatedAt: new Date().toISOString()
  };
}

export function minimumAuctionBid(currentBid: AuctionBidState | null) {
  return currentBid ? nextRequiredBid(Number(currentBid.amount ?? 0)) : AUCTION_BASE_PRICE;
}

export function pushAuctionUndo(
  state: AuctionControlState,
  action: AuctionUndoFrame["action"],
  extra: Pick<AuctionUndoFrame, "bidId" | "teamPlayer"> = {}
) {
  const frame: AuctionUndoFrame = {
    id: crypto.randomUUID(),
    action,
    state: {
      ...state,
      undoStack: state.undoStack ?? []
    },
    ...extra,
    at: new Date().toISOString()
  };

  return [frame, ...(state.undoStack ?? [])].slice(0, 30);
}

function readyRoleForUser(userId: string, captainTeamByUser: Map<string, string>, auctioneerId: string | null) {
  if (auctioneerId === userId) return "AUCTIONEER";
  return captainTeamByUser.has(userId) ? `CAPTAIN:${captainTeamByUser.get(userId)}` : "OWNER";
}

export async function getAuctionSnapshot(supabase: any, matchId: string): Promise<AuctionSnapshot> {
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("id, group_id, scheduled_date, match_time, location, maximum_players, status, notes, groups(name)")
    .eq("id", matchId)
    .maybeSingle();
  if (matchError) throw matchError;
  if (!match) throw new Error("Match not found.");

  const [{ data: auction, error: auctionError }, { data: teams, error: teamsError }, { data: selectedRows, error: selectedError }] = await Promise.all([
    supabase.from("auctions").select("*").eq("match_id", matchId).maybeSingle(),
    supabase
      .from("teams")
      .select("id, name, captain_id, captain:captain_id(id, display_name, preferred_position), team_players(auction_price, users(id, display_name, username, preferred_position, profile_image))")
      .eq("match_id", matchId)
      .order("name"),
    supabase
      .from("match_availability")
      .select("user_id, created_at, users(id, display_name, username, preferred_position, profile_image)")
      .eq("match_id", matchId)
      .eq("status", "PLAYING")
      .order("created_at", { ascending: true })
  ]);
  if (auctionError) throw auctionError;
  if (teamsError) throw teamsError;
  if (selectedError) throw selectedError;

  const selectedPlayers = (selectedRows ?? []).map((row: any) => row.users).filter(Boolean);
  const selectedPlayerIds = selectedPlayers.map((player: any) => player.id);
  const soldRows = (teams ?? []).flatMap((team: any) =>
    (team.team_players ?? [])
      .map((row: any) => row.users ? ({ playerId: row.users.id, teamId: team.id, amount: Number(row.auction_price ?? 0) }) : null)
      .filter(Boolean)
  );
  let state = normalizeAuctionState(
    parseAuctionState(match.notes, auction?.status === "LIVE" ? "LIVE" : auction?.status === "ENDED" ? "ENDED" : "DRAFT"),
    selectedPlayerIds,
    soldRows as Array<{ playerId: string; teamId: string; amount: number }>,
    auction?.status
  );

  const { data: bids, error: bidsError } = auction?.id
    ? await supabase
        .from("auction_bids")
        .select("id, auction_id, player_id, team_id, amount, created_at, teams(name)")
        .eq("auction_id", auction.id)
        .order("created_at", { ascending: false })
    : { data: [], error: null };
  if (bidsError) throw bidsError;

  if (state.currentPlayerId && !state.currentBid) {
    const highest = (bids ?? [])
      .filter((bid: any) => bid.player_id === state.currentPlayerId)
      .sort((a: any, b: any) => Number(b.amount ?? 0) - Number(a.amount ?? 0))[0];
    if (highest) {
      state = {
        ...state,
        currentBid: {
          id: highest.id,
          playerId: highest.player_id,
          teamId: highest.team_id,
          amount: Number(highest.amount ?? 0),
          bidderUserId: "",
          createdAt: highest.created_at
        }
      };
    }
  }

  const teamNameById = new Map<string, string>((teams ?? []).map((team: any) => [String(team.id), String(team.name)]));
  const playerById = new Map<string, any>(selectedPlayers.map((player: any) => [String(player.id), player]));
  const currentPlayer = state.currentPlayerId ? playerById.get(state.currentPlayerId) ?? null : null;
  const { data: auctioneer, error: auctioneerError } = state.auctioneerId
    ? await supabase
        .from("users")
        .select("id, display_name, username, preferred_position, profile_image")
        .eq("id", state.auctioneerId)
        .maybeSingle()
    : { data: null, error: null };
  if (auctioneerError) throw auctioneerError;
  const remainingPlayers = state.order
    .filter((playerId) => playerId !== state.currentPlayerId && !state.completed[playerId])
    .map((playerId) => playerById.get(playerId))
    .filter(Boolean);
  const completedPlayers = Object.values(state.completed)
    .filter((item) => selectedPlayerIds.includes(item.playerId))
    .map((item) => ({ ...item, player: playerById.get(item.playerId) ?? null, teamName: item.teamId ? teamNameById.get(item.teamId) ?? null : null }));

  const captainTeamByUser = new Map<string, string>(
    (teams ?? [])
      .filter((team: any) => team.captain_id)
      .map((team: any) => [String(team.captain_id), String(team.id)])
  );
  const { data: readyAvailability, error: readyError } = await supabase
    .from("match_availability")
    .select("user_id")
    .eq("match_id", matchId)
    .eq("status", "MAYBE");
  if (readyError) throw readyError;

  const readyRows = (readyAvailability ?? []).map((row: any) => ({
    user_id: row.user_id,
    role: readyRoleForUser(row.user_id, captainTeamByUser, state.auctioneerId)
  }));

  return {
    auction,
    match,
    state,
    teams: teams ?? [],
    selectedPlayers,
    auctioneer,
    currentPlayer,
    remainingPlayers,
    completedPlayers,
    bids: bids ?? [],
    readyRows
  };
}

export async function writeAuctionStateCas(supabase: any, matchId: string, previousNotes: string | null, nextState: AuctionControlState) {
  let query = supabase
    .from("matches")
    .update({ notes: serializeAuctionState(bumpAuctionState(nextState)) })
    .eq("id", matchId);

  query = previousNotes === null ? query.is("notes", null) : query.eq("notes", previousNotes);
  const { data, error } = await query.select("id, notes").maybeSingle();
  if (error) throw error;
  return data;
}
