"use client";

import { optimizedPhotoUrl } from "@/lib/images";
import {
  Activity,
  Award,
  CalendarClock,
  Check,
  Flag,
  MapPin,
  Play,
  Radio,
  Shield,
  Siren,
  Sparkles,
  Star,
  Target,
  Users,
  Zap
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

type PlayerLite = {
  id: string;
  display_name: string;
  username?: string;
  preferred_position: string;
  profile_image?: string | null;
};

type TeamLite = {
  id: string;
  name: string;
  formation?: string | null;
  captain_id?: string | null;
  captain?: { display_name: string; preferred_position: string } | null;
  team_players?: Array<{ users: PlayerLite | null }>;
};

type RatingRow = {
  rated_player_id: string;
  rating: number | string;
};

type LiveMatchRoomProps = {
  match: any;
  teams: TeamLite[];
  players: PlayerLite[];
  events: any[];
  ratings?: RatingRow[];
  canManage: boolean;
};

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function formatClock(seconds: number) {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function formationRows(formation: string | null | undefined) {
  return (formation || "4-3-3").split("-").map((value) => Math.max(1, Number(value) || 1));
}

function teamPlayerPool(team: TeamLite | undefined, fallbackPlayers: PlayerLite[]) {
  const assignedPlayers = (team?.team_players ?? []).map((item) => item.users).filter(Boolean) as PlayerLite[];
  return assignedPlayers.length ? assignedPlayers : fallbackPlayers.slice(0, 11);
}

function clampRating(value: number) {
  return Math.min(10, Math.max(5.5, value));
}

function getTeamInitial(name: string | undefined, fallback: string) {
  const clean = (name ?? "").trim();
  return clean ? clean.slice(0, 2).toUpperCase() : fallback;
}

function eventMinute(event: any) {
  return event.minute !== null && event.minute !== undefined ? `${event.minute}'` : "Goal";
}

function PlayerMarker({
  player,
  label,
  captainId,
  goals,
  assists,
  rating
}: {
  player?: PlayerLite;
  label: string;
  captainId: string | null;
  goals: number;
  assists: number;
  rating?: number;
}) {
  const captain = Boolean(player?.id && player.id === captainId);

  return (
    <div className="player-marker">
      <div className="player-marker-photo">
        {player?.profile_image ? <img src={optimizedPhotoUrl(player.profile_image, 96) ?? player.profile_image} alt="" loading="lazy" decoding="async" /> : <span>{player?.preferred_position ?? label}</span>}
      </div>
      <div className="player-marker-rating">{rating ? rating.toFixed(1) : "-"}</div>
      <div className="player-marker-name">{player?.display_name ?? label}</div>
      <div className="player-marker-meta">
        <span>{player?.preferred_position ?? label}</span>
        {captain ? <span>C</span> : null}
      </div>
      <div className="event-badge-row">
        {goals ? <span className="event-badge event-badge-goal">G {goals}</span> : null}
        {assists ? <span className="event-badge event-badge-assist">A {assists}</span> : null}
      </div>
    </div>
  );
}

function TeamPitch({
  team,
  fallbackPlayers,
  events,
  getRating,
  getGoals,
  getAssists,
  fallbackName
}: {
  team?: TeamLite;
  fallbackPlayers: PlayerLite[];
  events: any[];
  getRating: (playerId?: string | null) => number | undefined;
  getGoals: (playerId?: string | null) => number;
  getAssists: (playerId?: string | null) => number;
  fallbackName: string;
}) {
  const pool = teamPlayerPool(team, fallbackPlayers);
  let cursor = 0;

  return (
    <div className="team-pitch-card">
      <div className="team-pitch-header">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-white/50">{team?.formation ?? "4-3-3"}</p>
          <h3>{team?.name ?? fallbackName}</h3>
        </div>
        <div className="team-captain-chip">
          <Shield size={14} />
          {team?.captain?.display_name ?? "Captain unset"}
        </div>
      </div>
      <div className="football-pitch">
        <div className="pitch-line pitch-line-centre" />
        <div className="pitch-circle" />
        <div className="pitch-box pitch-box-top" />
        <div className="pitch-box pitch-box-bottom" />
        <div className="football-pitch-content">
          {(() => {
            const keeper = pool[cursor++];
            return (
              <div className="formation-row">
                <PlayerMarker player={keeper} label="GK" captainId={team?.captain_id ?? null} goals={getGoals(keeper?.id)} assists={getAssists(keeper?.id)} rating={getRating(keeper?.id)} />
              </div>
            );
          })()}
          {formationRows(team?.formation).map((count, rowIndex) => (
            <div key={`${team?.id ?? fallbackName}-${rowIndex}`} className="formation-row" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
              {Array.from({ length: count }).map((_, index) => {
                const player = pool[cursor++];
                return (
                  <PlayerMarker
                    key={`${rowIndex}-${index}`}
                    player={player}
                    label="Player"
                    captainId={team?.captain_id ?? null}
                    goals={getGoals(player?.id)}
                    assists={getAssists(player?.id)}
                    rating={getRating(player?.id)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function LiveMatchRoom({ match, teams, players, events, ratings = [], canManage }: LiveMatchRoomProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [localMatch, setLocalMatch] = useState(match);
  const [localEvents, setLocalEvents] = useState(events);
  const teamA = teams[0];
  const teamB = teams[1];
  const [goalTeamId, setGoalTeamId] = useState(teamA?.id ?? teams[0]?.id ?? "");
  const [assistPlayerId, setAssistPlayerId] = useState("");
  const [customMinute, setCustomMinute] = useState("");
  const [pendingPlayerId, setPendingPlayerId] = useState("");
  const live = localMatch.status === "LIVE";
  const ended = localMatch.status === "ENDED";

  useEffect(() => setLocalMatch(match), [match]);
  useEffect(() => setLocalEvents(events), [events]);

  useEffect(() => {
    const clock = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(clock);
  }, []);

  useEffect(() => {
    if (!live) return;
    const refresh = window.setInterval(() => {
      if (document.visibilityState === "visible") startTransition(() => router.refresh());
    }, 20000);
    return () => window.clearInterval(refresh);
  }, [live, router, startTransition]);

  useEffect(() => {
    if (!goalTeamId && teams[0]?.id) {
      setGoalTeamId(teams[0].id);
    }
  }, [goalTeamId, teams]);

  const matchEvents = useMemo(
    () =>
      [...events]
        .filter((event) => event.event_type === "GOAL")
        .sort((a, b) => Number(a.minute ?? 999) - Number(b.minute ?? 999)),
    [localEvents]
  );

  const ratingMap = useMemo(() => {
    const grouped = new Map<string, number[]>();
    ratings.forEach((row) => {
      const value = Number(row.rating);
      if (!row.rated_player_id || Number.isNaN(value)) return;
      grouped.set(row.rated_player_id, [...(grouped.get(row.rated_player_id) ?? []), value]);
    });
    const averaged = new Map<string, number>();
    grouped.forEach((values, id) => averaged.set(id, values.reduce((sum, value) => sum + value, 0) / values.length));
    return averaged;
  }, [ratings]);

  const eventsByTeam = useMemo(() => {
    const map = new Map<string, any[]>();
    matchEvents.forEach((event) => {
      if (!event.team_id) return;
      map.set(event.team_id, [...(map.get(event.team_id) ?? []), event]);
    });
    return map;
  }, [matchEvents]);

  const playerEventCounts = useMemo(() => {
    const goals = new Map<string, number>();
    const assists = new Map<string, number>();
    matchEvents.forEach((event) => {
      if (event.player_id) goals.set(event.player_id, (goals.get(event.player_id) ?? 0) + 1);
      if (event.assist_player_id) assists.set(event.assist_player_id, (assists.get(event.assist_player_id) ?? 0) + 1);
    });
    return { goals, assists };
  }, [matchEvents]);

  const teamAEvents = teamA?.id ? eventsByTeam.get(teamA.id) ?? [] : [];
  const teamBEvents = teamB?.id ? eventsByTeam.get(teamB.id) ?? [] : [];
  const scoreA = teamAEvents.length;
  const scoreB = teamBEvents.length;
  const latestEvent = matchEvents[matchEvents.length - 1];
  const leader =
    scoreA === scoreB ? "Level" : scoreA > scoreB ? `${teamA?.name ?? "Team A"} lead` : `${teamB?.name ?? "Team B"} lead`;
  const kickoff = new Date(`${localMatch.scheduled_date}T${String(localMatch.match_time ?? "00:00").slice(0, 5)}:00`);
  const elapsedSeconds = live && !Number.isNaN(kickoff.getTime()) ? Math.floor((now.getTime() - kickoff.getTime()) / 1000) : 0;
  const matchClock = live ? formatClock(elapsedSeconds) : ended ? "FT" : "00:00";
  const currentMinute = live ? Math.max(1, Math.floor(Math.max(0, elapsedSeconds) / 60) + 1) : "";
  const activeTeam = teams.find((team) => team.id === goalTeamId) ?? teamA ?? teamB;
  const activePlayers = teamPlayerPool(activeTeam, players);
  const availableAssists = activePlayers.filter((player) => player.id !== pendingPlayerId);

  function playerGoals(playerId?: string | null) {
    if (!playerId) return 0;
    return playerEventCounts.goals.get(playerId) ?? 0;
  }

  function playerAssists(playerId?: string | null) {
    if (!playerId) return 0;
    return playerEventCounts.assists.get(playerId) ?? 0;
  }

  function getRating(playerId?: string | null) {
    if (!playerId) return undefined;
    const stored = ratingMap.get(playerId);
    if (stored) return stored;
    return clampRating(6.6 + playerGoals(playerId) * 0.9 + playerAssists(playerId) * 0.45);
  }

  const playerReport = useMemo(() => {
    const seen = new Set<string>();
    return teams
      .flatMap((team) => teamPlayerPool(team, players).map((player) => ({ team, player })))
      .filter(({ team, player }) => {
        const key = `${team.id}-${player.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map(({ team, player }) => ({
        team,
        player,
        goals: playerGoals(player.id),
        assists: playerAssists(player.id),
        rating: getRating(player.id) ?? 0
      }))
      .sort((a, b) => b.rating - a.rating || b.goals - a.goals || b.assists - a.assists);
  }, [teams, players, matchEvents, ratingMap]);

  const manOfTheMatch = playerReport[0];

  async function startMatch() {
    setMessage("");
    const started = new Date();
    const response = await fetch("/api/matches/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchId: match.id,
        startedDate: localDate(),
        startedTime: started.toTimeString().slice(0, 5)
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.error ?? "Could not start match.");
      return;
    }
    setLocalMatch(data.match ?? { ...localMatch, status: "LIVE", scheduled_date: localDate(), match_time: started.toTimeString().slice(0, 5) });
    startTransition(() => router.refresh());
  }

  async function recordGoal(input: { playerId: string; teamId?: string; assistId?: string | null; minute?: string | number | null }) {
    setMessage("");
    const teamId = input.teamId ?? goalTeamId;
    const minute = input.minute === "" || input.minute === undefined || input.minute === null ? currentMinute : input.minute;
    const response = await fetch("/api/matches/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchId: match.id,
        teamId,
        playerId: input.playerId,
        assistPlayerId: input.assistId ?? null,
        minute
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.error ?? "Could not record goal.");
      return;
    }
    const scorer = players.find((player) => player.id === input.playerId)?.display_name ?? "Player";
    setMessage(`Goal added for ${scorer} at ${minute}'.`);
    if (data.event) {
      setLocalEvents((current) => [data.event, ...current.filter((event) => event.id !== data.event.id)]);
    }
    setPendingPlayerId("");
    setAssistPlayerId("");
    setCustomMinute("");
    startTransition(() => router.refresh());
  }

  function chooseTeam(teamId: string) {
    setGoalTeamId(teamId);
    setPendingPlayerId("");
    setAssistPlayerId("");
  }

  async function quickGoal(player: PlayerLite) {
    setPendingPlayerId(player.id);
    await recordGoal({ playerId: player.id, teamId: activeTeam?.id });
  }

  async function detailedGoal() {
    if (!pendingPlayerId) {
      setMessage("Pick the scorer first.");
      return;
    }
    await recordGoal({
      playerId: pendingPlayerId,
      teamId: activeTeam?.id,
      assistId: assistPlayerId || null,
      minute: customMinute || currentMinute
    });
  }

  async function endMatch() {
    if (!confirm("End this match?")) return;
    const response = await fetch("/api/matches/end", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId: match.id })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.error ?? "Could not end match.");
      return;
    }
    setLocalMatch(data.match ?? { ...localMatch, status: "ENDED" });
    startTransition(() => router.refresh());
  }

  return (
    <section className="match-centre-layout">
      <div className="match-main-stack">
        <div className="broadcast-scoreboard">
          <div className="broadcast-topline">
            <span className={`inline-flex items-center gap-2 ${live ? "text-red-300" : "text-white/58"}`}>
              {live ? <Radio size={15} /> : <Flag size={15} />}
              {ended ? "Full time report" : live ? "Live match" : localMatch.status}
            </span>
            <span className="match-clock-pill">{matchClock}</span>
            <span>{leader}</span>
          </div>

          <div className="scoreline-grid">
            <div className="score-team text-right">
              <div className="team-crest ml-auto">{getTeamInitial(teamA?.name, "A")}</div>
              <h2>{teamA?.name ?? "Team A"}</h2>
              <p>{teamAEvents.map((event) => `${event.scorer?.display_name ?? "Goal"} ${eventMinute(event)}`).join("  ") || "No goals"}</p>
            </div>
            <div className="score-total">
              <span>{scoreA}</span>
              <b>-</b>
              <span>{scoreB}</span>
            </div>
            <div className="score-team">
              <div className="team-crest">{getTeamInitial(teamB?.name, "B")}</div>
              <h2>{teamB?.name ?? "Team B"}</h2>
              <p>{teamBEvents.map((event) => `${event.scorer?.display_name ?? "Goal"} ${eventMinute(event)}`).join("  ") || "No goals"}</p>
            </div>
          </div>

          <div className="broadcast-meta">
            <span><CalendarClock size={16} /> {localMatch.scheduled_date} {localMatch.match_time}</span>
            <span><MapPin size={16} /> {localMatch.location}</span>
            <span><Activity size={16} /> {latestEvent ? `Latest: ${latestEvent.scorer?.display_name ?? "Goal"} ${eventMinute(latestEvent)}` : "Awaiting first event"}</span>
          </div>
        </div>

        <div className="match-pitch-grid">
          <TeamPitch team={teamA} fallbackPlayers={players} events={matchEvents} getRating={getRating} getGoals={playerGoals} getAssists={playerAssists} fallbackName="Team A" />
          <TeamPitch team={teamB} fallbackPlayers={players} events={matchEvents} getRating={getRating} getGoals={playerGoals} getAssists={playerAssists} fallbackName="Team B" />
        </div>

        <div className="match-report-grid">
          <div className="report-panel">
            <div className="section-title mb-4"><h2>{ended ? "Match Report" : "Live Timeline"}</h2><Target size={20} /></div>
            <div className="timeline-rail">
              {matchEvents.map((event) => {
                const home = event.team_id === teamA?.id;
                return (
                  <div key={event.id} className={`timeline-event ${home ? "timeline-event-home" : "timeline-event-away"}`}>
                    <div className="timeline-minute">{eventMinute(event)}</div>
                    <div className="timeline-card">
                      <div className="font-black">{event.scorer?.display_name ?? "Goal"}</div>
                      <div className="text-sm text-[var(--muted)]">
                        {home ? teamA?.name ?? "Team A" : teamB?.name ?? "Team B"}
                        {event.assister?.display_name ? `, assist ${event.assister.display_name}` : ""}
                      </div>
                    </div>
                  </div>
                );
              })}
              {!matchEvents.length ? (
                <div className="empty-state">
                  <div>
                    <Target className="mx-auto mb-3 text-[var(--accent-dark)]" size={28} />
                    <p className="font-black text-[var(--foreground)]">No goals yet</p>
                    <p className="mt-1 text-sm">Goals, assists and major moments will appear here.</p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="report-panel">
            <div className="section-title mb-4"><h2>Player Ratings</h2><Star size={20} /></div>
            {manOfTheMatch ? (
              <div className="mom-card mb-3">
                <Award size={22} />
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-wide text-white/54">{ended ? "Man of the Match" : "Top performer"}</p>
                  <h3>{manOfTheMatch.player.display_name}</h3>
                  <p>{manOfTheMatch.team.name} - {manOfTheMatch.goals} G, {manOfTheMatch.assists} A</p>
                </div>
                <b>{manOfTheMatch.rating.toFixed(1)}</b>
              </div>
            ) : null}
            <div className="player-report-list">
              {playerReport.slice(0, 8).map((row) => (
                <div key={`${row.team.id}-${row.player.id}`} className="player-report-row">
                  <div className="player-report-photo">
                    {row.player.profile_image ? <img src={optimizedPhotoUrl(row.player.profile_image, 84) ?? row.player.profile_image} alt="" loading="lazy" decoding="async" /> : row.player.preferred_position}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-black">{row.player.display_name}</div>
                    <div className="truncate text-xs font-bold text-[var(--muted)]">{row.team.name} - {row.player.preferred_position}</div>
                  </div>
                  <div className="text-right text-xs font-black text-[var(--muted)]">
                    <div>{row.goals} G</div>
                    <div>{row.assists} A</div>
                  </div>
                  <b>{row.rating.toFixed(1)}</b>
                </div>
              ))}
              {!playerReport.length ? <div className="empty-state min-h-0">Player ratings will appear after teams are picked.</div> : null}
            </div>
          </div>
        </div>
      </div>

      <aside className="match-side-stack">
        <div className="surface p-4">
          <div className="section-title mb-3"><h2>Teams</h2><Users size={20} /></div>
          <div className="grid gap-2">
            {teams.map((team) => (
              <div key={team.id} className="data-row flex items-center justify-between gap-3 p-3">
                <span className="flex min-w-0 items-center gap-2 font-black"><Shield size={17} /> <span className="truncate">{team.name}</span></span>
                <span className="rounded-lg bg-[#e8f5ef] px-2 py-1 text-xs font-black text-[var(--accent-dark)]">
                  {matchEvents.filter((event) => event.team_id === team.id).length}
                </span>
              </div>
            ))}
            {!teams.length ? <div className="empty-state min-h-0">Teams will appear when the match starts.</div> : null}
          </div>
        </div>

        {canManage ? (
          <div className="match-control-panel grid gap-4 p-4 sm:p-5">
            <div className="relative z-10">
              <p className="text-xs font-black uppercase tracking-wide text-white/62">Broadcast console</p>
              <h2 className="text-2xl font-black text-white">Goal Studio</h2>
              <p className="mt-1 text-sm font-bold text-white/64">Tap a player to score instantly. Use details for assists.</p>
            </div>
            {!live && !ended ? (
              <button className="btn-primary" type="button" onClick={startMatch}><Play size={18} /> Start Match</button>
            ) : null}

            <div className="relative z-10 grid grid-cols-2 gap-2">
              {teams.map((team) => {
                const selected = team.id === activeTeam?.id;
                const teamScore = matchEvents.filter((event) => event.team_id === team.id).length;
                return (
                  <button
                    key={team.id}
                    className={`team-score-button ${selected ? "team-score-button-active" : ""}`}
                    type="button"
                    onClick={() => chooseTeam(team.id)}
                  >
                    <span>{team.name}</span>
                    <b>{teamScore}</b>
                  </button>
                );
              })}
            </div>

            <div className="relative z-10 grid gap-2">
              <div className="flex items-center justify-between gap-2 text-xs font-black uppercase tracking-wide text-white/68">
                <span className="inline-flex items-center gap-2"><Zap size={14} /> Quick scorer</span>
              <span>{isPending ? "Syncing" : live ? `Auto ${currentMinute}'` : ended ? "Match ended" : "Start match first"}</span>
              </div>
              <div className="scorer-grid">
                {activePlayers.map((player) => (
                  <button
                    key={player.id}
                    className={`player-tap-card ${pendingPlayerId === player.id ? "player-tap-card-selected" : ""}`}
                    disabled={!live}
                    type="button"
                    onClick={() => quickGoal(player)}
                  >
                    <span className="player-tap-photo">
                      {player.profile_image ? <img src={optimizedPhotoUrl(player.profile_image, 88) ?? player.profile_image} alt="" loading="lazy" decoding="async" /> : player.preferred_position}
                    </span>
                    <span className="min-w-0 text-left">
                      <span className="block truncate font-black">{player.display_name}</span>
                      <span className="block text-xs font-black uppercase text-white/56">{player.preferred_position}</span>
                    </span>
                    <Target size={18} />
                  </button>
                ))}
                {!activePlayers.length ? (
                  <div className="rounded-lg border border-white/18 bg-white/10 p-3 text-sm font-bold text-white/72">
                    Add players to this team before recording goals.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="relative z-10 rounded-lg border border-white/18 bg-white/10 p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-white/56">Goal details</p>
                  <p className="text-sm font-bold text-white/78">Optional assist and minute override</p>
                </div>
                <Sparkles className="text-[var(--amber)]" size={18} />
              </div>
              <div className="grid gap-2">
                <select className="field" value={pendingPlayerId} onChange={(event) => setPendingPlayerId(event.target.value)} disabled={!live}>
                  <option value="">Select scorer</option>
                  {activePlayers.map((player) => <option key={player.id} value={player.id}>{player.display_name}</option>)}
                </select>
                <select className="field" value={assistPlayerId} onChange={(event) => setAssistPlayerId(event.target.value)} disabled={!live || !pendingPlayerId}>
                  <option value="">No assist</option>
                  {availableAssists.map((player) => <option key={player.id} value={player.id}>{player.display_name}</option>)}
                </select>
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <input className="field" value={customMinute} onChange={(event) => setCustomMinute(event.target.value)} type="number" min="0" placeholder={`Minute ${currentMinute || ""}`} disabled={!live} />
                  <button className="btn-primary px-3" disabled={!live || !pendingPlayerId} type="button" onClick={detailedGoal}><Check size={18} /> Save</button>
                </div>
              </div>
            </div>

            <button className="btn-danger" disabled={ended} type="button" onClick={endMatch}><Siren size={18} /> End Match</button>
            {message ? <p className="relative z-10 rounded-lg bg-white/14 p-3 text-sm font-bold text-white">{message}</p> : null}
          </div>
        ) : (
          <div className="empty-state">Only group admins can update live events.</div>
        )}
      </aside>
    </section>
  );
}
