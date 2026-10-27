"use client";

import { PlayerAvatar } from "@/components/football/PlayerAvatar";
import { ArrowLeft, ArrowRight, Check, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { memo, useCallback, useEffect, useMemo, useState, useTransition } from "react";

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
};

type AuctionSetupFormProps = {
  matchId: string;
  teams: Team[];
  players: Player[];
  selectedPlayerIds: string[];
  auctioneerId: string | null;
  canManage: boolean;
};

type PlayerTileProps = {
  player: Player;
  selected: boolean;
  disabled?: boolean;
  status?: string;
  detail: string;
  onSelect: (playerId: string) => void;
};

const PlayerTile = memo(function PlayerTile({ player, selected, disabled, status, detail, onSelect }: PlayerTileProps) {
  return (
    <button
      className={`auction-fast-card ${selected ? "auction-fast-card-active" : ""}`}
      disabled={disabled}
      aria-pressed={selected}
      title={player.display_name}
      type="button"
      onClick={() => onSelect(player.id)}
    >
      <PlayerAvatar className="auction-fast-avatar" src={player.profile_image} name={player.display_name} />
      <span className="min-w-0">
        <span className="block truncate font-black">{player.display_name}</span>
        <span className="block truncate text-xs font-bold text-[var(--muted)]">{detail}</span>
      </span>
      {status ? <span className="auction-fast-status">{status}</span> : null}
    </button>
  );
});

export function AuctionSetupForm({
  matchId,
  teams,
  players,
  selectedPlayerIds,
  auctioneerId,
  canManage
}: AuctionSetupFormProps) {
  const router = useRouter();
  const setupTeams = useMemo(() => teams.slice(0, 2), [teams]);
  const [message, setMessage] = useState("");
  const [step, setStep] = useState<"captains" | "auctioneer" | "players">("captains");
  const [activeTeamId, setActiveTeamId] = useState(setupTeams[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [opening, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const visiblePlayers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query
      ? players.filter((player) =>
          `${player.display_name} ${player.username} ${player.preferred_position}`.toLowerCase().includes(query)
        )
      : players;
  }, [players, search]);
  const [auctioneer, setAuctioneer] = useState(auctioneerId ?? "");
  const [captains, setCaptains] = useState<Record<string, string>>(() =>
    Object.fromEntries(setupTeams.map((team) => [team.id, team.captain_id ?? ""]))
  );
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(selectedPlayerIds.length ? selectedPlayerIds : players.map((player) => player.id))
  );
  const playerById = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);
  const captainIds = useMemo(() => new Set(Object.values(captains).filter(Boolean)), [captains]);
  const captainTeamByPlayerId = useMemo(() => {
    const entries = Object.entries(captains)
      .filter(([, playerId]) => Boolean(playerId))
      .map(([teamId, playerId]) => [playerId, setupTeams.find((team) => team.id === teamId)] as const);
    return new Map(entries);
  }, [captains, setupTeams]);
  const captainCount = captainIds.size;
  const captainsPicked = setupTeams.length >= 2 && captainCount >= 2;
  const auctioneerPicked = Boolean(auctioneer) && !captainIds.has(auctioneer);
  const roleIds = useMemo(
    () => new Set([...Array.from(captainIds), auctioneer].filter(Boolean)),
    [auctioneer, captainIds]
  );
  const auctionPlayerCount = Array.from(selected).filter((playerId) => !roleIds.has(playerId)).length;
  const activeTeam = setupTeams.find((team) => team.id === activeTeamId) ?? setupTeams[0];

  useEffect(() => {
    if (setupTeams.length >= 2 && !setupTeams.some((team) => team.id === activeTeamId)) {
      setActiveTeamId(setupTeams[0].id);
    }
  }, [activeTeamId, setupTeams]);

  async function saveSetup() {
    if (saving || opening) return;
    setMessage("");
    setSaving(true);
    const payload = setupTeams.map((team) => ({ id: team.id, captainId: captains[team.id] }));
    try {
      const response = await fetch("/api/auctions/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId,
          teams: payload,
          auctioneerId: auctioneer,
          playerIds: Array.from(selected).filter((playerId) => !roleIds.has(playerId))
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(data.error ?? "Could not save auction setup.");
        setSaving(false);
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setMessage("Connection interrupted. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const chooseCaptain = useCallback(
    (playerId: string) => {
      if (!activeTeam) return;
      const next = { ...captains, [activeTeam.id]: playerId };
      const nextOpenTeam = setupTeams.find((team) => team.id !== activeTeam.id && !next[team.id]);
      setCaptains(next);
      if (nextOpenTeam) setActiveTeamId(nextOpenTeam.id);
    },
    [activeTeam, captains, setupTeams]
  );

  const togglePlayer = useCallback(
    (playerId: string) => {
      if (roleIds.has(playerId)) return;
      setSelected((current) => {
        const next = new Set(current);
        if (next.has(playerId)) next.delete(playerId);
        else next.add(playerId);
        return next;
      });
    },
    [roleIds]
  );

  if (!canManage) {
    return (
      <div className="surface p-4">
        <div className="section-title mb-3">
          <h2>Auction Setup</h2>
        </div>
        <div className="empty-state min-h-0">Setup pending.</div>
      </div>
    );
  }

  if (setupTeams.length < 2) {
    return (
      <div className="auction-setup-screen">
        <div className="auction-setup-header">
          <div>
            <p className="eyebrow">Auction setup</p>
            <h2>Preparing Teams</h2>
            <p>Creating Team A and Team B.</p>
          </div>
        </div>
        <button className="btn-primary w-full sm:w-fit" type="button" onClick={() => router.refresh()}>
          Reload Auction Setup
        </button>
        <div className="empty-state min-h-0">Reload after team slots appear.</div>
      </div>
    );
  }

  return (
    <div className="auction-setup-screen">
      <ol className="setup-progress" aria-label="Auction setup progress">
        {(["captains", "auctioneer", "players"] as const).map((stage, index) => (
          <li
            key={stage}
            className="setup-progress-step"
            data-active={stage === step}
            aria-current={stage === step ? "step" : undefined}
          >
            <span>{["captains", "auctioneer", "players"].indexOf(step) > index ? <Check size={11} /> : index + 1}</span>
            {stage === "captains" ? "Captains" : stage === "auctioneer" ? "Auctioneer" : "Player pool"}
          </li>
        ))}
      </ol>
      <div className="auction-setup-header">
        <div>
          <p className="eyebrow">Auction setup</p>
          <h2>
            {step === "captains" ? "Select Captains" : step === "auctioneer" ? "Select Auctioneer" : "Auction Pool"}
          </h2>
          <p>
            {step === "captains"
              ? "Pick two captains."
              : step === "auctioneer"
                ? "Pick the room controller."
                : "Pick players for bidding."}
          </p>
        </div>
      </div>

      <label className="relative block max-w-sm">
        <Search size={15} className="absolute left-3 top-3.5 text-[var(--muted)]" />
        <input
          className="field pl-9"
          type="search"
          aria-label="Search players"
          placeholder="Search players or positions"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      {!visiblePlayers.length ? <p className="text-sm text-[var(--muted)]">No players found.</p> : null}

      {step === "captains" ? (
        <>
          <div className="auction-captain-grid">
            {setupTeams.map((team) => (
              <button
                key={team.id}
                className={`auction-captain-card ${activeTeam?.id === team.id ? "auction-captain-card-active" : ""}`}
                type="button"
                onClick={() => setActiveTeamId(team.id)}
              >
                <span>{team.name} Captain</span>
                <strong>{playerById.get(captains[team.id])?.display_name ?? "Unassigned"}</strong>
              </button>
            ))}
          </div>

          <div className="auction-fast-grid">
            {visiblePlayers.map((player) => {
              const selectedTeam = captainTeamByPlayerId.get(player.id);
              const unavailable = Boolean(selectedTeam && selectedTeam.id !== activeTeam?.id);
              return (
                <PlayerTile
                  key={player.id}
                  detail={selectedTeam ? `${selectedTeam.name} captain` : `${player.preferred_position} - available`}
                  disabled={unavailable}
                  onSelect={chooseCaptain}
                  player={player}
                  selected={Boolean(selectedTeam)}
                  status={selectedTeam ? "SET" : undefined}
                />
              );
            })}
          </div>

          <button
            className="btn-primary w-full sm:w-fit"
            disabled={!captainsPicked}
            type="button"
            onClick={() => setStep("auctioneer")}
          >
            Choose auctioneer <ArrowRight size={15} />
          </button>
          {!captainsPicked ? (
            <p className="text-xs text-[var(--muted)]">{captainCount} of 2 captains selected</p>
          ) : null}
        </>
      ) : step === "auctioneer" ? (
        <div className="grid gap-3">
          <div>
            <button className="btn-secondary" type="button" onClick={() => setStep("captains")}>
              <ArrowLeft size={14} /> Captains
            </button>
          </div>
          <div className="auction-fast-grid">
            {visiblePlayers.map((player) => {
              const captain = captainIds.has(player.id);
              return (
                <PlayerTile
                  key={player.id}
                  detail={captain ? "Captain" : `@${player.username} - ${player.preferred_position}`}
                  disabled={captain}
                  onSelect={setAuctioneer}
                  player={player}
                  selected={auctioneer === player.id}
                  status={auctioneer === player.id ? "REF" : undefined}
                />
              );
            })}
          </div>
          <button
            className="btn-primary w-full sm:w-fit"
            disabled={!auctioneerPicked}
            type="button"
            onClick={() => setStep("players")}
          >
            Choose players <ArrowRight size={15} />
          </button>
          {!auctioneerPicked ? <p className="text-xs text-[var(--muted)]">Auctioneer required.</p> : null}
        </div>
      ) : (
        <div className="grid gap-3">
          <div>
            <button className="btn-secondary" type="button" onClick={() => setStep("auctioneer")}>
              <ArrowLeft size={14} /> Auctioneer
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-black">Auction Pool</div>
            <div className="text-sm font-black text-[var(--muted)]">{auctionPlayerCount} selected</div>
          </div>
          <div className="auction-fast-grid">
            {visiblePlayers.map((player) => {
              const checked = selected.has(player.id);
              const captain = captainIds.has(player.id);
              const auctioneerSelected = auctioneer === player.id;
              return (
                <PlayerTile
                  key={player.id}
                  detail={
                    captain
                      ? "Captain"
                      : auctioneerSelected
                        ? "Auctioneer"
                        : `@${player.username} - ${player.preferred_position}`
                  }
                  disabled={captain || auctioneerSelected}
                  onSelect={togglePlayer}
                  player={player}
                  selected={checked && !captain && !auctioneerSelected}
                  status={checked && !captain && !auctioneerSelected ? "IN" : undefined}
                />
              );
            })}
          </div>
          <button
            className="btn-primary w-full sm:w-fit"
            disabled={saving || opening || auctionPlayerCount < 1}
            type="button"
            onClick={saveSetup}
          >
            {saving ? "Saving..." : opening ? "Opening room..." : "Open auction room"} <ArrowRight size={15} />
          </button>
        </div>
      )}
      {message ? (
        <p className="rounded-lg bg-[#e8f5ef] p-3 text-sm font-bold text-[var(--accent-dark)]">{message}</p>
      ) : null}
    </div>
  );
}
