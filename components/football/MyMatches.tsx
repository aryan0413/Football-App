"use client";

import { CalendarClock, Clock, MapPin, Play, Plus, Radio, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type GroupOption = {
  role: string;
  groups: {
    id: string;
    name: string;
  };
};

type MatchItem = {
  id: string;
  group_id: string;
  scheduled_date: string;
  match_time: string;
  location: string;
  maximum_players: number;
  status: string;
  groups?: { name: string } | null;
  match_availability?: Array<{ status: string }>;
  teams?: Array<{ id: string; name: string }>;
  match_events?: Array<{ id: string; event_type: string; team_id: string | null }>;
};

export function MyMatches({ groups, matches }: { groups: GroupOption[]; matches: MatchItem[] }) {
  const router = useRouter();
  const [localMatches, setLocalMatches] = useState(matches);
  const [selectedId, setSelectedId] = useState(matches.find((match) => match.status === "LIVE")?.id ?? matches[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [scheduleOpen, setScheduleOpen] = useState(!matches.length);
  const [pendingRsvp, setPendingRsvp] = useState("");
  const selected = localMatches.find((match) => match.id === selectedId) ?? localMatches[0];
  const selectedIsAuction = selected?.status === "AUCTION";
  const selectedHref = selectedIsAuction ? `/auction?matchId=${selected.id}` : selected ? `/match/${selected.id}` : "#";
  const selectedActionLabel = selectedIsAuction ? "Join back auction" : selected?.status === "LIVE" ? "Live now" : "Open match room";

  const selectedScore = useMemo(() => {
    const teamA = selected?.teams?.[0];
    const teamB = selected?.teams?.[1];
    const events = selected?.match_events ?? [];
    return {
      teamA,
      teamB,
      teamAGoals: events.filter((event) => event.event_type === "GOAL" && event.team_id === teamA?.id).length,
      teamBGoals: events.filter((event) => event.event_type === "GOAL" && event.team_id === teamB?.id).length
    };
  }, [selected]);

  async function createMatch(formData: FormData) {
    setMessage("");
    const withoutAuction = formData.get("withoutAuction") === "on";
    const response = await fetch("/api/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        groupId: formData.get("groupId"),
        scheduledDate: formData.get("scheduledDate"),
        matchTime: formData.get("matchTime"),
        location: formData.get("location"),
        maximumPlayers: formData.get("maximumPlayers"),
        withoutAuction
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.error ?? "Could not create match.");
      return;
    }
    setMessage("Match scheduled.");
    setLocalMatches((current) => [data.match, ...current]);
    setSelectedId(data.match.id);
    router.refresh();
  }

  async function rsvp(matchId: string, status: "PLAYING" | "MAYBE" | "NOT_PLAYING") {
    if (pendingRsvp) return;
    setPendingRsvp(status);
    const response = await fetch("/api/matches/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId, status })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.error ?? "Could not update availability.");
      setPendingRsvp("");
      return;
    }
    setLocalMatches((current) =>
      current.map((match) =>
        match.id === matchId
          ? { ...match, match_availability: [...(match.match_availability ?? []), { status }] }
          : match
      )
    );
    setPendingRsvp("");
    router.refresh();
  }

  return (
    <section className="matches-board">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <button className="btn-primary" type="button" onClick={() => setScheduleOpen((open) => !open)}>
            <Plus size={18} />
            Schedule Match
          </button>
        </div>
        {message ? <p className="rounded-lg bg-white px-3 py-2 text-sm font-bold text-[var(--muted)]">{message}</p> : null}
      </div>

      {scheduleOpen ? (
        <form action={createMatch} className="pitch-card grid gap-3 p-4">
          <div className="relative z-10">
            <p className="text-xs font-black uppercase tracking-wide text-white/62">Create match</p>
            <h2 className="text-xl font-black text-white">New Football Match</h2>
          </div>
          <div className="grid gap-3 lg:grid-cols-[1.2fr_0.85fr_0.85fr]">
            <select className="field" name="groupId" required defaultValue={groups[0]?.groups.id ?? ""}>
              <option value="" disabled>Select group</option>
              {groups.map((group) => (
                <option key={group.groups.id} value={group.groups.id}>{group.groups.name}</option>
              ))}
            </select>
            <input className="field" name="scheduledDate" type="date" />
            <input className="field" name="matchTime" type="time" />
          </div>
          <div className="grid gap-3 lg:grid-cols-[1fr_160px]">
            <input className="field" name="location" placeholder="Ground / location" />
            <input className="field" name="maximumPlayers" min="2" placeholder="Players" type="number" defaultValue={12} />
          </div>
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm font-bold text-white">
                <input name="withoutAuction" type="checkbox" />
                Without auction
              </label>
            </div>
            <button className="btn-primary min-w-40" disabled={!groups.length} type="submit"><Plus size={18} /> Create</button>
          </div>
        </form>
      ) : null}

      <div className="matches-layout">
        <div className="match-list-panel surface">
          <div className="section-title mb-3">
            <h2>My Matches</h2>
            <Trophy size={20} />
          </div>
          <div className="match-list-scroll">
            {localMatches.map((match) => {
              const playing = (match.match_availability ?? []).filter((item) => item.status === "PLAYING").length;
              const active = selected?.id === match.id;
              return (
                <button
                  key={match.id}
                  className={`data-row grid gap-2 p-3 text-left ${active ? "border-[var(--accent)]" : ""}`}
                  type="button"
                  onClick={() => setSelectedId(match.id)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-black">{match.groups?.name ?? "Football group"}</span>
                    <span className={`rounded-lg px-2 py-1 text-xs font-black ${match.status === "LIVE" ? "bg-red-600 text-white" : "bg-[#e8f5ef] text-[var(--accent-dark)]"}`}>
                      {match.status === "LIVE" ? "LIVE" : match.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs font-bold text-[var(--muted)]">
                    <span className="flex items-center gap-1"><CalendarClock size={14} /> {match.scheduled_date}</span>
                    <span className="flex items-center gap-1"><Clock size={14} /> {match.match_time}</span>
                    <span className="flex items-center gap-1"><Users size={14} /> {playing}/{match.maximum_players}</span>
                  </div>
                </button>
              );
            })}
            {!localMatches.length ? (
              <div className="empty-state min-h-0">
                <div>
                  <Trophy className="mx-auto mb-2 text-[var(--accent-dark)]" size={24} />
                  <p className="font-black text-[var(--foreground)]">No matches yet</p>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="match-preview-panel surface overflow-hidden">
        <div className="scoreboard p-4 sm:p-5">
          <div className="mb-5 flex items-center justify-between text-xs font-black uppercase tracking-wide text-white/52">
            <span>{selected ? selected.groups?.name ?? "Match" : "Waiting for match"}</span>
            <span className="flex items-center gap-1">{selected?.status === "LIVE" ? <Radio size={14} /> : null}{selected?.status ?? "Idle"}</span>
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
            <div>
              <div className="truncate text-sm font-black text-white/64">{selectedScore.teamA?.name ?? "Team A"}</div>
              <div className="mt-3 text-6xl font-black sm:text-7xl">{selectedScore.teamAGoals}</div>
            </div>
            <div className="rounded-lg bg-white/10 px-3 py-2 text-sm font-black text-[var(--amber)]">VS</div>
            <div>
              <div className="truncate text-sm font-black text-white/64">{selectedScore.teamB?.name ?? "Team B"}</div>
              <div className="mt-3 text-6xl font-black sm:text-7xl">{selectedScore.teamBGoals}</div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 p-3 sm:p-4">
          {selected ? (
            <>
              <div className="grid gap-2 text-sm font-bold text-[var(--muted)] sm:grid-cols-3">
                <span className="flex items-center gap-2"><CalendarClock size={17} /> {selected.scheduled_date}</span>
                <span className="flex items-center gap-2"><Clock size={17} /> {selected.match_time}</span>
                <span className="flex items-center gap-2"><MapPin size={17} /> {selected.location}</span>
              </div>
              {selectedIsAuction ? (
                <div className="data-row p-3 text-sm font-bold text-[var(--muted)]">
                  Auction active. Finish it before match room opens.
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-3">
                  <button className="btn-primary" disabled={Boolean(pendingRsvp)} type="button" onClick={() => rsvp(selected.id, "PLAYING")}>{pendingRsvp === "PLAYING" ? "Saving..." : "Playing"}</button>
                  <button className="btn-secondary" disabled={Boolean(pendingRsvp)} type="button" onClick={() => rsvp(selected.id, "MAYBE")}>{pendingRsvp === "MAYBE" ? "Saving..." : "Maybe"}</button>
                  <button className="btn-secondary" disabled={Boolean(pendingRsvp)} type="button" onClick={() => rsvp(selected.id, "NOT_PLAYING")}>{pendingRsvp === "NOT_PLAYING" ? "Saving..." : "Out"}</button>
                </div>
              )}
              <Link className="btn-dark w-full" href={selectedHref}>
                <Play size={18} />
                {selectedActionLabel}
              </Link>
            </>
          ) : (
            <div className="empty-state">
              <div>
                <Trophy className="mx-auto mb-3 text-[var(--accent-dark)]" size={28} />
                <p className="font-black text-[var(--foreground)]">No match selected</p>
                <p className="mt-1 text-sm">Schedule a match to open the room.</p>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </section>
  );
}
