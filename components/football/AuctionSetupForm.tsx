"use client";

import { optimizedPhotoUrl } from "@/lib/images";
import { useRouter } from "next/navigation";
import { memo, useCallback, useEffect, useMemo, useState } from "react";

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

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

type PlayerTileProps = {
  player: Player;
  selected: boolean;
  disabled?: boolean;
  status?: string;
  detail: string;
  onSelect: (playerId: string) => void;
};

const PlayerTile = memo(function PlayerTile({ player, selected, disabled, status, detail, onSelect }: PlayerTileProps) {
  const photoUrl = optimizedPhotoUrl(player.profile_image);

  return (
    <button
      className={`auction-fast-card ${selected ? "auction-fast-card-active" : ""}`}
      disabled={disabled}
      type="button"
      onClick={() => onSelect(player.id)}
    >
      <span className="auction-fast-avatar" aria-hidden="true">
        {photoUrl ? (
          <img
            alt=""
            decoding="async"
            draggable={false}
            height={44}
            loading="lazy"
            src={photoUrl}
            width={44}
          />
        ) : (
          initials(player.display_name)
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-black">{player.display_name}</span>
        <span className="block truncate text-xs font-bold text-[var(--muted)]">{detail}</span>
      </span>
      {status ? <span className="auction-fast-status">{status}</span> : null}
    </button>
  );
});

export function AuctionSetupForm({ matchId, teams, players, selectedPlayerIds, auctioneerId, canManage }: AuctionSetupFormProps) {
  const router = useRouter();
  const setupTeams = useMemo(() => teams.slice(0, 2), [teams]);
  const [message, setMessage] = useState("");
  const [step, setStep] = useState<"captains" | "auctioneer" | "players">("captains");
  const [activeTeamId, setActiveTeamId] = useState(setupTeams[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [auctioneer, setAuctioneer] = useState(auctioneerId ?? "");
  const [captains, setCaptains] = useState<Record<string, string>>(() =>
    Object.fromEntries(setupTeams.map((team) => [team.id, team.captain_id ?? ""]))
  );
  const [selected, setSelected] = useState<Set<string>>(() => new Set(selectedPlayerIds.length ? selectedPlayerIds : players.map((player) => player.id)));
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
  const roleIds = useMemo(() => new Set([...Array.from(captainIds), auctioneer].filter(Boolean)), [auctioneer, captainIds]);
  const auctionPlayerCount = Array.from(selected).filter((playerId) => !roleIds.has(playerId)).length;
  const activeTeam = setupTeams.find((team) => team.id === activeTeamId) ?? setupTeams[0];

  useEffect(() => {
    if (setupTeams.length >= 2 && !setupTeams.some((team) => team.id === activeTeamId)) {
      setActiveTeamId(setupTeams[0].id);
    }
  }, [activeTeamId, setupTeams]);

  useEffect(() => {
    if (canManage && setupTeams.length < 2) {
      router.refresh();
    }
  }, [canManage, router, setupTeams.length]);

  async function saveSetup() {
    if (saving) return;
    setMessage("");
    setSaving(true);
    const payload = setupTeams.map((team) => ({ id: team.id, captainId: captains[team.id] }));
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
    setMessage("Auction setup saved. Captains can now join and mark ready.");
    router.refresh();
  }

  const chooseCaptain = useCallback((playerId: string) => {
    if (!activeTeam) return;
    const next = { ...captains, [activeTeam.id]: playerId };
    const nextOpenTeam = setupTeams.find((team) => team.id !== activeTeam.id && !next[team.id]);
    setCaptains(next);
    if (nextOpenTeam) setActiveTeamId(nextOpenTeam.id);
  }, [activeTeam, captains, setupTeams]);

  const togglePlayer = useCallback((playerId: string) => {
    if (roleIds.has(playerId)) return;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  }, [roleIds]);

  if (!canManage) {
    return (
      <div className="surface p-4">
        <div className="section-title mb-3"><h2>Auction Setup</h2></div>
        <div className="empty-state min-h-0">Waiting for the owner/admin to choose captains and auction players.</div>
      </div>
    );
  }

  if (setupTeams.length < 2) {
    return (
      <div className="auction-setup-screen">
        <div className="auction-setup-header">
          <div>
            <p className="eyebrow">Auction setup</p>
            <h2>Preparing Team Slots</h2>
            <p>Team A and Team B are being created for this auction.</p>
          </div>
        </div>
        <button className="btn-primary w-full sm:w-fit" type="button" onClick={() => router.refresh()}>
          Reload Auction Setup
        </button>
        <div className="empty-state min-h-0">
          Reload once. After Team A and Team B appear, player taps will assign captains.
        </div>
      </div>
    );
  }

  return (
    <div className="auction-setup-screen">
      <div className="auction-setup-header">
        <div>
          <p className="eyebrow">Auction setup</p>
          <h2>{step === "captains" ? "Choose Captains First" : step === "auctioneer" ? "Choose Auctioneer" : "Choose Auction Players"}</h2>
          <p>
            {step === "captains"
              ? "Select two captains before choosing the auctioneer."
              : step === "auctioneer"
                ? "Select one auctioneer who will run sold, stop, restart, and undo controls."
                : "Now choose which players will enter bidding."}
          </p>
        </div>
      </div>

      {step === "captains" ? (
        <>
          <div className="auction-captain-grid">
            {setupTeams.map((team) => (
              <button key={team.id} className={`auction-captain-card ${activeTeam?.id === team.id ? "auction-captain-card-active" : ""}`} type="button" onClick={() => setActiveTeamId(team.id)}>
                <span>{team.name} Captain</span>
                <strong>{playerById.get(captains[team.id])?.display_name ?? "Tap a player below"}</strong>
              </button>
            ))}
          </div>

          <div className="auction-fast-grid">
            {players.map((player) => {
              const selectedTeam = captainTeamByPlayerId.get(player.id);
              const unavailable = Boolean(selectedTeam && selectedTeam.id !== activeTeam?.id);
              return (
                <PlayerTile
                  key={player.id}
                  detail={selectedTeam ? `${selectedTeam.name} captain` : `${player.preferred_position} - available`}
                  disabled={unavailable}
                  onSelect={chooseCaptain}
                  player={player}
                  selected={captains[activeTeam?.id ?? ""] === player.id}
                  status={selectedTeam ? "SET" : undefined}
                />
              );
            })}
          </div>

          <button className="btn-primary w-full sm:w-fit" disabled={!captainsPicked} type="button" onClick={() => setStep("auctioneer")}>
            Next: Choose Auctioneer
          </button>
          {!captainsPicked ? (
            <div className="empty-state min-h-0">
              Choose captains for both teams before selecting the auctioneer.
            </div>
          ) : null}
        </>
      ) : step === "auctioneer" ? (
        <div className="grid gap-3">
          <div>
            <button className="btn-secondary" type="button" onClick={() => setStep("captains")}>
              Back to Captains
            </button>
          </div>
          <div className="auction-fast-grid">
            {players.map((player) => {
              const captain = captainIds.has(player.id);
              return (
                <PlayerTile
                  key={player.id}
                  detail={captain ? "Captain - cannot auctioneer" : `@${player.username} - ${player.preferred_position}`}
                  disabled={captain}
                  onSelect={setAuctioneer}
                  player={player}
                  selected={auctioneer === player.id}
                  status={auctioneer === player.id ? "REF" : undefined}
                />
              );
            })}
          </div>
          <button className="btn-primary w-full sm:w-fit" disabled={!auctioneerPicked} type="button" onClick={() => setStep("players")}>
            Next: Choose Auction Players
          </button>
          {!auctioneerPicked ? (
            <div className="empty-state min-h-0">
              Choose one auctioneer who is not a captain.
            </div>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-3">
          <div>
            <button className="btn-secondary" type="button" onClick={() => setStep("auctioneer")}>
              Back to Auctioneer
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-black">Auction Pool</div>
            <div className="text-sm font-black text-[var(--muted)]">{auctionPlayerCount} selected</div>
          </div>
          <div className="auction-fast-grid">
            {players.map((player) => {
              const checked = selected.has(player.id);
              const captain = captainIds.has(player.id);
              const auctioneerSelected = auctioneer === player.id;
              return (
                <PlayerTile
                  key={player.id}
                  detail={captain ? "Captain - not in auction" : auctioneerSelected ? "Auctioneer - not in auction" : `@${player.username} - ${player.preferred_position}`}
                  disabled={captain || auctioneerSelected}
                  onSelect={togglePlayer}
                  player={player}
                  selected={checked && !captain && !auctioneerSelected}
                  status={checked && !captain && !auctioneerSelected ? "IN" : undefined}
                />
              );
            })}
          </div>
          <button className="btn-primary w-full sm:w-fit" disabled={saving || auctionPlayerCount < 1} type="button" onClick={saveSetup}>
            {saving ? "Opening auction room..." : "Save Setup & Open Auction Room"}
          </button>
        </div>
      )}
      {message ? <p className="rounded-lg bg-[#e8f5ef] p-3 text-sm font-bold text-[var(--accent-dark)]">{message}</p> : null}
    </div>
  );
}
