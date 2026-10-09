"use client";

import { AUCTION_BASE_PRICE, formatAuctionMoney, nextRequiredBid } from "@/lib/auctionRules";
import { fallbackPhoto, optimizedPhotoUrl } from "@/lib/images";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";
import { Ban, Bell, Check, Gavel, Lock, Pause, Play, RotateCcw, SkipForward, Trophy, Users, Wifi, WifiOff, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

type Player = {
  id: string;
  display_name: string;
  username: string;
  preferred_position: string;
  profile_image: string | null;
};

type Team = {
  id: string;
  name: string;
  captain_id: string | null;
  captain?: { id: string; display_name: string; preferred_position: string } | null;
  team_players?: Array<{ auction_price: number; users: Player | null }>;
};

type Snapshot = {
  auction: { id: string; status: string; starting_purse: number } | null;
  state: {
    status: "DRAFT" | "LIVE" | "PAUSED" | "ENDED";
    version: number;
    order: string[];
    auctioneerId: string | null;
    currentPlayerId: string | null;
    currentBid: { id: string; playerId: string; teamId: string; amount: number; bidderUserId: string; createdAt: string } | null;
    completed: Record<string, { status: "SOLD" | "UNSOLD" | "SKIPPED"; playerId: string; teamId?: string | null; amount?: number; at: string }>;
    bidHistory: Array<{ id: string; playerId: string; teamId: string; amount: number; bidderUserId: string; createdAt: string }>;
    undoStack: Array<{ id: string; action: string; at: string }>;
    updatedAt: string;
  };
  teams: Team[];
  selectedPlayers: Player[];
  auctioneer?: Player | null;
  currentPlayer: Player | null;
  remainingPlayers: Player[];
  completedPlayers: Array<{ status: "SOLD" | "UNSOLD" | "SKIPPED"; playerId: string; teamId?: string | null; amount?: number; at: string; player: Player | null; teamName?: string | null }>;
  readyRows: Array<{ user_id: string; role: string }>;
};

type AuctionRoomProps = {
  matchId: string;
  initialSnapshot: Snapshot;
  currentUserId: string;
  canManage: boolean;
};

function isAuctionStatus(value: unknown): value is Snapshot["state"]["status"] {
  return value === "DRAFT" || value === "LIVE" || value === "PAUSED" || value === "ENDED";
}

function parseAuctionNotes(notes: unknown, fallback: Snapshot["state"]) {
  if (typeof notes !== "string" || !notes.trim()) return fallback;

  try {
    const parsed = JSON.parse(notes);
    if (parsed?.kind !== "football-auction-state-v1") return fallback;

    return {
      ...fallback,
      version: Number(parsed.version ?? fallback.version),
      status: isAuctionStatus(parsed.status) ? parsed.status : fallback.status,
      order: Array.isArray(parsed.order) ? parsed.order.filter((id: unknown) => typeof id === "string") : fallback.order,
      auctioneerId: typeof parsed.auctioneerId === "string" ? parsed.auctioneerId : null,
      currentPlayerId: typeof parsed.currentPlayerId === "string" ? parsed.currentPlayerId : null,
      currentBid: parsed.currentBid && typeof parsed.currentBid === "object" ? parsed.currentBid : null,
      completed: parsed.completed && typeof parsed.completed === "object" ? parsed.completed : {},
      bidHistory: Array.isArray(parsed.bidHistory) ? parsed.bidHistory : fallback.bidHistory,
      undoStack: Array.isArray(parsed.undoStack) ? parsed.undoStack : fallback.undoStack,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : fallback.updatedAt
    } satisfies Snapshot["state"];
  } catch {
    return fallback;
  }
}

function applyAuctionState(snapshot: Snapshot, state: Snapshot["state"]) {
  const playerById = new Map(snapshot.selectedPlayers.map((player) => [player.id, player]));
  const teamNameById = new Map(snapshot.teams.map((team) => [team.id, team.name]));
  const order = state.order.length ? state.order : snapshot.selectedPlayers.map((player) => player.id);
  const currentPlayer = state.currentPlayerId ? playerById.get(state.currentPlayerId) ?? null : null;
  const remainingPlayers = order
    .filter((playerId) => playerId !== state.currentPlayerId && !state.completed[playerId])
    .map((playerId) => playerById.get(playerId))
    .filter((player): player is Player => Boolean(player));
  const completedPlayers = Object.values(state.completed)
    .map((item) => ({
      ...item,
      player: playerById.get(item.playerId) ?? null,
      teamName: item.teamId ? teamNameById.get(item.teamId) ?? null : null
    }));

  return {
    ...snapshot,
    state,
    currentPlayer,
    remainingPlayers,
    completedPlayers
  };
}

export function AuctionRoom({ matchId, initialSnapshot, currentUserId, canManage }: AuctionRoomProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [snapshot, setSnapshotState] = useState(initialSnapshot);
  const snapshotRef = useRef(initialSnapshot);
  const [message, setMessage] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [connection, setConnection] = useState<"connecting" | "live" | "reconnecting" | "offline">("connecting");

  const setSnapshot = useCallback((next: Snapshot | ((current: Snapshot) => Snapshot)) => {
    setSnapshotState((current) => {
      const resolved = typeof next === "function" ? (next as (current: Snapshot) => Snapshot)(current) : next;
      snapshotRef.current = resolved;
      return resolved;
    });
  }, []);

  useEffect(() => setSnapshot(initialSnapshot), [initialSnapshot, setSnapshot]);

  const syncState = useCallback(async (silent = true) => {
    try {
      const response = await fetch(`/api/auctions/state?matchId=${encodeURIComponent(matchId)}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (!silent) setMessage(data.error ?? "Could not sync auction.");
        return;
      }
      if (data.snapshot) setSnapshot(data.snapshot);
      setConnection(navigator.onLine ? "live" : "offline");
    } catch {
      setConnection(navigator.onLine ? "reconnecting" : "offline");
      if (!silent) setMessage("Connection lost. Reconnecting to latest auction state.");
    }
  }, [matchId]);

  useEffect(() => {
    let active = true;
    const supabase = getSupabaseBrowser();
    const channel = supabase
      .channel(`auction-match-${matchId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "matches", filter: `id=eq.${matchId}` },
        (payload: { new?: { notes?: string | null } }) => {
          if (!active) return;

          if (typeof payload.new?.notes !== "string") {
            void syncState(true);
            return;
          }

          const current = snapshotRef.current;
          const previous = current.state;
          const state = parseAuctionNotes(payload.new.notes, previous);
          const needsFullSync =
            state.currentPlayerId !== previous.currentPlayerId ||
            Object.keys(state.completed).length !== Object.keys(previous.completed).length;
          setSnapshot(applyAuctionState(current, state));

          if (needsFullSync) {
            window.setTimeout(() => {
              if (active) void syncState(true);
            }, 350);
          }
        }
      )
      .subscribe((status: string) => {
        if (!active) return;
        if (status === "SUBSCRIBED") {
          setConnection("live");
          void syncState(true);
        }
        if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) setConnection("reconnecting");
      });

    const onOnline = () => {
      setConnection("reconnecting");
      void syncState(false);
    };
    const onOffline = () => setConnection("offline");
    const onVisibility = () => {
      if (document.visibilityState === "visible") void syncState(true);
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisibility);

    const fallbackSync = window.setInterval(() => {
      if (document.visibilityState === "visible") void syncState(true);
    }, 20000);

    return () => {
      active = false;
      window.clearInterval(fallbackSync);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisibility);
      supabase.removeChannel(channel);
    };
  }, [matchId, syncState]);

  const localTeams = snapshot.teams ?? [];
  const localStatus = snapshot.state.status;
  const startingPurse = Number(snapshot.auction?.starting_purse ?? 0);
  const captainTeam = localTeams.find((team) => team.captain_id === currentUserId);
  const live = localStatus === "LIVE";
  const paused = localStatus === "PAUSED";
  const ended = localStatus === "ENDED";
  const readyIds = new Set((snapshot.readyRows ?? []).map((row) => row.user_id));
  const captainTeams = localTeams.filter((team) => team.captain_id);
  const captainsReady = captainTeams.filter((team) => team.captain_id && readyIds.has(team.captain_id)).length;
  const currentUserReady = readyIds.has(currentUserId);
  const currentBid = snapshot.state.currentBid;
  const currentPlayer = snapshot.currentPlayer;
  const highestTeam = localTeams.find((team) => team.id === currentBid?.teamId);
  const nextBid = nextRequiredBid(Number(currentBid?.amount ?? 0));
  const auctioneer = snapshot.auctioneer ?? null;
  const isAuctioneer = snapshot.state.auctioneerId === currentUserId;
  const canRunAuction = isAuctioneer || (!snapshot.state.auctioneerId && canManage);
  const canStartAuction = canManage || isAuctioneer;
  const auctioneerReady = Boolean(snapshot.state.auctioneerId && readyIds.has(snapshot.state.auctioneerId));

  const currentTeamSpent = useMemo(() => {
    const map = new Map<string, number>();
    localTeams.forEach((team) => {
      map.set(team.id, (team.team_players ?? []).reduce((sum, row) => sum + Number(row.auction_price ?? 0), 0));
    });
    return map;
  }, [localTeams]);

  function teamSpent(team: Team) {
    return currentTeamSpent.get(team.id) ?? 0;
  }

  async function applyAction(endpoint: string, payload: Record<string, unknown>, key: string, fallbackMessage: string, refreshAfter = false) {
    if (busyKey) return;
    setBusyKey(key);
    setMessage("");
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.error ?? fallbackMessage);
      setBusyKey("");
      await syncState(true);
      return;
    }
    if (data.snapshot) setSnapshot(data.snapshot);
    else if (data.state) setSnapshot((current) => applyAuctionState(current, data.state));
    setMessage(data.message ?? fallbackMessage);
    setBusyKey("");
    if (refreshAfter) startTransition(() => router.refresh());
  }

  async function placeBid() {
    if (!currentPlayer || !captainTeam || busyKey) return;
    const amount = nextBid;
    const optimisticId = `pending-${Date.now()}`;
    const createdAt = new Date().toISOString();
    setSnapshot((current) =>
      applyAuctionState(current, {
        ...current.state,
        currentBid: {
          id: optimisticId,
          playerId: currentPlayer.id,
          teamId: captainTeam.id,
          amount,
          bidderUserId: currentUserId,
          createdAt
        },
        bidHistory: [
          {
            id: optimisticId,
            playerId: currentPlayer.id,
            teamId: captainTeam.id,
            amount,
            bidderUserId: currentUserId,
            createdAt
          },
          ...current.state.bidHistory
        ].slice(0, 250)
      })
    );
    await applyAction(
      "/api/auctions/bid",
      { matchId, playerId: currentPlayer.id, amount },
      "bid",
      `Bid placed: INR ${formatAuctionMoney(amount)}.`
    );
  }

  async function markReady(forceStart = false) {
    await applyAction(
      "/api/auctions/ready",
      { matchId, forceStart },
      forceStart ? "start" : "ready",
      forceStart ? "Waiting for room." : "Ready."
    );
  }

  async function sellCurrentPlayer() {
    if (!currentPlayer) return;
    await applyAction("/api/auctions/sell", { matchId, playerId: currentPlayer.id }, "sell", "Sold.");
  }

  async function controlAuction(action: "STOP" | "RESUME" | "SKIP" | "UNSOLD" | "RESTART" | "UNDO") {
    await applyAction("/api/auctions/control", { matchId, action }, action.toLowerCase(), "Auction updated.");
  }

  async function completeAuction() {
    await applyAction("/api/auctions/end", { matchId }, "end", "Auction complete.", true);
  }

  const connectionCopy = {
    connecting: "Connecting",
    live: "Live sync",
    reconnecting: "Reconnecting",
    offline: "Offline"
  }[connection];

  return (
    <section className="auction-room-layout">
      <div className="auction-teams-stack">
        {localTeams.map((team) => {
          const spent = teamSpent(team);
          return (
            <div key={team.id} className="auction-team-card surface">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate font-black">{team.name}</h2>
                  <p className="truncate text-sm font-bold text-[var(--muted)]">Captain: {team.captain?.display_name ?? "Not selected"}</p>
                </div>
                <Trophy size={20} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-[var(--panel-soft)] p-3">
                  <div className="text-xs font-black uppercase text-[var(--muted)]">Spent</div>
                  <div className="font-black">INR {formatAuctionMoney(spent)}</div>
                </div>
                <div className="rounded-lg bg-[var(--panel-soft)] p-3">
                  <div className="text-xs font-black uppercase text-[var(--muted)]">Left</div>
                  <div className="font-black">INR {formatAuctionMoney(startingPurse - spent)}</div>
                </div>
              </div>
              <div className="auction-team-roster mt-3">
                {(team.team_players ?? []).map((row) => row.users ? (
                  <div key={row.users.id} className="data-row flex items-center justify-between gap-3 p-2">
                    <span className="truncate text-sm font-black">{row.users.display_name}</span>
                    <span className="text-xs font-black text-[var(--muted)]">INR {formatAuctionMoney(Number(row.auction_price ?? 0))}</span>
                  </div>
                ) : null)}
                {!team.team_players?.length ? <div className="empty-state min-h-0">Empty squad</div> : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className="auction-command pitch-card">
        <div className="auction-command-inner">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-white/62">{live ? "Captain bidding room" : paused ? "Auction paused" : ended ? "Final result" : "Auction waiting room"}</p>
              <h2 className="text-3xl font-black text-white">{localStatus}</h2>
            </div>
            <div className="flex items-center gap-2 text-xs font-black uppercase text-white/70">
              {connection === "live" ? <Wifi size={18} /> : <WifiOff size={18} />}
              {connectionCopy}
            </div>
          </div>

          {captainTeam ? (
            <div className="rounded-lg border border-[rgba(242,185,75,0.45)] bg-[rgba(242,185,75,0.16)] p-3 text-sm font-black text-white">
              <div className="flex items-center gap-2"><Bell size={17} /> Captain: {captainTeam.name}</div>
            </div>
          ) : null}
          {isAuctioneer ? (
            <div className="rounded-lg border border-white/20 bg-white/12 p-3 text-sm font-black text-white">
              <div className="flex items-center gap-2"><Gavel size={17} /> Auctioneer controls active</div>
            </div>
          ) : null}

          <div className="auction-room-status">
            <div>
              <div className="text-xs font-black uppercase text-white/54">Auctioneer</div>
              <div className="truncate font-black">{auctioneer?.display_name ?? "Not selected"}</div>
            </div>
            <div>
              <div className="text-xs font-black uppercase text-white/54">Captains ready</div>
              <div className="font-black">{captainsReady}/{Math.max(2, captainTeams.length)}</div>
            </div>
            <div>
              <div className="text-xs font-black uppercase text-white/54">Auctioneer ready</div>
              <div className="font-black">{auctioneerReady ? "Ready" : "Waiting"}</div>
            </div>
          </div>

          {!live && !paused && !ended && (canStartAuction || captainTeam) ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {captainTeam || isAuctioneer ? (
                <button className="btn-primary" disabled={currentUserReady || busyKey === "ready"} type="button" onClick={() => markReady(false)}>
                  <Check size={18} /> {currentUserReady ? "Ready" : busyKey === "ready" ? "Joining..." : "Join Room"}
                </button>
              ) : null}
              {canStartAuction ? (
                <button className="btn-secondary" disabled={busyKey === "start"} type="button" onClick={() => markReady(true)}>
                  <Gavel size={18} /> {busyKey === "start" ? "Starting..." : "Start Auction Now"}
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="auction-room-status">
            <div>
              <div className="text-xs font-black uppercase text-white/54">Purse</div>
              <div className="font-black">INR {formatAuctionMoney(startingPurse)}</div>
            </div>
            <div>
              <div className="text-xs font-black uppercase text-white/54">Base price</div>
              <div className="font-black">INR {formatAuctionMoney(AUCTION_BASE_PRICE)}</div>
            </div>
            <div>
              <div className="text-xs font-black uppercase text-white/54">Your team</div>
              <div className="truncate font-black">{captainTeam?.name ?? (isAuctioneer ? "Auctioneer" : "No team")}</div>
            </div>
          </div>

          <div className="rounded-lg bg-white/12 p-3 text-white">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-white/54">Current player</p>
                <h3 className="text-2xl font-black">{currentPlayer?.display_name ?? (ended ? "Auction complete" : "Waiting for player")}</h3>
              </div>
              {live ? <Gavel size={30} /> : <Lock size={30} />}
            </div>
            {currentPlayer ? (
              <div className="grid gap-3 md:grid-cols-[auto_1fr_auto] md:items-center">
                <img src={optimizedPhotoUrl(currentPlayer.profile_image, 128) ?? fallbackPhoto()} alt="" loading="lazy" decoding="async" className="h-20 w-20 rounded-lg object-cover" />
                <div className="min-w-0">
                  <div className="truncate text-lg font-black">@{currentPlayer.username} - {currentPlayer.preferred_position}</div>
                  <div className="mt-1 text-sm font-bold text-white/66">
                    Highest: {currentBid ? `INR ${formatAuctionMoney(currentBid.amount)} by ${highestTeam?.name ?? "Team"}` : "No bid yet"}
                  </div>
                </div>
                <button className="btn-primary" disabled={!live || !captainTeam || currentBid?.teamId === captainTeam?.id || Boolean(busyKey)} type="button" onClick={placeBid}>
                  <Zap size={17} /> {busyKey === "bid" ? "Bidding..." : `Bid INR ${formatAuctionMoney(nextBid)}`}
                </button>
              </div>
            ) : (
              <div className="rounded-lg bg-white/10 p-4 text-sm font-bold text-white/72">
                {ended ? "Final squads saved." : "Player reveal pending."}
              </div>
            )}
          </div>

          {canRunAuction ? (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {live ? <button className="btn-secondary" disabled={Boolean(busyKey)} type="button" onClick={() => controlAuction("STOP")}><Pause size={17} /> Stop</button> : null}
              {paused ? <button className="btn-primary" disabled={Boolean(busyKey)} type="button" onClick={() => controlAuction("RESUME")}><Play size={17} /> Resume</button> : null}
              <button className="btn-secondary" disabled={!currentPlayer || !currentBid || !live || Boolean(busyKey)} type="button" onClick={sellCurrentPlayer}><Check size={17} /> Sell</button>
              <button className="btn-secondary" disabled={!currentPlayer || !live || Boolean(busyKey)} type="button" onClick={() => controlAuction("UNSOLD")}><Ban size={17} /> Unsold</button>
              <button className="btn-secondary" disabled={!currentPlayer || !live || Boolean(busyKey)} type="button" onClick={() => controlAuction("SKIP")}><SkipForward size={17} /> Skip</button>
              <button className="btn-secondary" disabled={!snapshot.state.undoStack.length || Boolean(busyKey)} type="button" onClick={() => controlAuction("UNDO")}><RotateCcw size={17} /> Undo</button>
              <button className="btn-secondary" disabled={ended || Boolean(busyKey)} type="button" onClick={() => window.confirm("Restart auction? This clears sold players and bid history for this auction.") ? controlAuction("RESTART") : undefined}><RotateCcw size={17} /> Restart</button>
              <button className="btn-danger" disabled={ended || Boolean(busyKey)} type="button" onClick={completeAuction}><Check size={17} /> Complete</button>
              <button className="btn-secondary" disabled={Boolean(busyKey)} type="button" onClick={() => syncState(false)}><RotateCcw size={17} /> Sync</button>
            </div>
          ) : live || paused ? (
            <div className="rounded-lg bg-white/10 p-3 text-sm font-bold text-white/72">
              {snapshot.state.auctioneerId ? "Auctioneer controls active." : "Admin controls active until setup."}
            </div>
          ) : null}

          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-2 font-black text-white">
              <span className="inline-flex items-center gap-2"><Lock size={18} /> Sealed queue</span>
              <span className="text-sm text-white/64">{snapshot.remainingPlayers.length} remaining</span>
            </div>
            <div className="rounded-lg border border-white/15 bg-white/10 p-4 text-sm font-bold text-white/72">
              <div className="flex items-center gap-3">
                <Users size={18} />
                <span>
                  {snapshot.remainingPlayers.length
                    ? "Queue sealed. Next player reveals after the round."
                    : "No remaining hidden players."}
                </span>
              </div>
            </div>
          </div>

          {message ? <p className="rounded-lg bg-white/14 p-3 text-sm font-bold text-white">{isPending ? `${message} Syncing...` : message}</p> : null}
        </div>
      </div>

      <div className="auction-rules-panel surface">
        <div className="section-title mb-3"><h2>Bid Rules</h2><Gavel size={20} /></div>
        <div className="grid gap-2 text-sm font-bold text-[var(--muted)]">
          <div className="data-row p-3">Only selected captains can bid from their device.</div>
          <div className="data-row p-3">Current player, bid and status are saved in the database.</div>
          <div className="data-row p-3">Base price: INR {formatAuctionMoney(AUCTION_BASE_PRICE)}</div>
          <div className="data-row p-3">Increment: INR 50,000 below INR 5,00,000.</div>
          <div className="data-row p-3">Increment: INR 1,00,000 after INR 5,00,000.</div>
          <div className="data-row p-3">Increment: INR 1,50,000 after INR 10,00,000.</div>
        </div>

        <div className="section-title mb-3 mt-4"><h2>Completed</h2><Trophy size={20} /></div>
        <div className="grid gap-2 text-sm font-bold text-[var(--muted)]">
          {snapshot.completedPlayers.slice(0, 10).map((row) => (
            <div key={row.playerId} className="data-row p-3">
              <div className="font-black text-[var(--foreground)]">{row.player?.display_name ?? "Player"}</div>
              <div>{row.status}{row.teamName ? ` - ${row.teamName}` : ""}{row.amount ? ` - INR ${formatAuctionMoney(row.amount)}` : ""}</div>
            </div>
          ))}
          {!snapshot.completedPlayers.length ? <div className="empty-state min-h-0">Results appear as players are sold, skipped, or unsold.</div> : null}
        </div>
      </div>
    </section>
  );
}
