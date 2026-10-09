"use client";

import { fallbackPhoto, optimizedPhotoUrl } from "@/lib/images";
import { Gavel, Search, Send, ShieldCheck, Trophy, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MatchCard } from "@/components/football/cards/MatchCard";

type GroupRoomProps = {
  group: {
    id: string;
    name: string;
    logo: string | null;
    description: string | null;
  };
  role: string;
  members: Array<{
    role: string;
    users: {
      id: string;
      display_name: string;
      username: string;
      preferred_position: string;
      profile_image: string | null;
    };
  }>;
  matches: any[];
  leaderboard: any[];
  initialPanel?: string;
};

export function GroupRoom({ group, role, members, matches, leaderboard, initialPanel }: GroupRoomProps) {
  const router = useRouter();
  const [tab, setTab] = useState(initialPanel === "schedule" ? "matches" : "overview");
  const [scheduleOpen, setScheduleOpen] = useState(initialPanel === "schedule");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [auctionStarting, setAuctionStarting] = useState(false);
  const canManage = role === "OWNER" || role === "ADMIN";
  const canChangeRoles = role === "OWNER";
  const activeAuction = matches.find((match) => match.status === "AUCTION");
  const playableMatches = matches.filter((match) => match.status !== "AUCTION");
  const nextMatch = playableMatches.find((match) => match.status !== "ENDED");
  const completedMatches = playableMatches.filter((match) => match.status === "ENDED");

  async function scheduleMatch(formData: FormData) {
    setMessage("");
    const response = await fetch("/api/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        groupId: group.id,
        scheduledDate: formData.get("scheduledDate"),
        matchTime: formData.get("matchTime"),
        location: formData.get("location"),
        maximumPlayers: formData.get("maximumPlayers"),
        withoutAuction: formData.get("auctionEnabled") !== "on"
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.error ?? "Could not schedule match.");
      return;
    }
    setMessage("Match scheduled.");
    setScheduleOpen(false);
    router.refresh();
  }

  async function searchUsers(formData: FormData) {
    setMessage("");
    const q = String(formData.get("q") ?? "");
    const response = await fetch(`/api/groups/search-users?groupId=${group.id}&q=${encodeURIComponent(q)}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.error ?? "Search failed.");
      return;
    }
    setSearchResults(data.users ?? []);
  }

  async function invite(invitedUserId: string) {
    const response = await fetch("/api/groups/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId: group.id, invitedUserId })
    });
    const data = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Invitation sent." : data.error ?? "Could not send invitation.");
  }

  async function changeRole(userId: string, nextRole: "ADMIN" | "PLAYER") {
    const response = await fetch("/api/groups/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId: group.id, userId, role: nextRole })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.error ?? "Could not update role.");
      return;
    }
    setMessage(nextRole === "ADMIN" ? "Player made group admin." : "Admin changed back to player.");
    router.refresh();
  }

  async function startAuction() {
    if (auctionStarting) return;
    if (activeAuction) {
      router.push(`/auction?matchId=${activeAuction.id}`);
      return;
    }
    setAuctionStarting(true);
    setMessage("");
    const response = await fetch("/api/auctions/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId: group.id })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.error ?? "Could not start auction.");
      setAuctionStarting(false);
      return;
    }
    router.push(`/auction?matchId=${data.matchId}`);
  }

  return (
    <div className="grid gap-4">
      <section className="app-hero p-4 sm:p-5">
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
            <img src={optimizedPhotoUrl(group.logo, 160) ?? fallbackPhoto()} alt="" loading="lazy" decoding="async" className="h-20 w-20 rounded-lg border border-white/24 object-cover" />
            <div className="min-w-0">
              <p className="text-sm font-black text-white/62">{members.length} players</p>
              <h1 className="break-words text-3xl font-black text-white sm:text-4xl">{group.name}</h1>
              <p className="mt-1 max-w-2xl text-sm text-white/68">{group.description ?? "Private football group"}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canManage ? <button className="btn-primary" type="button" onClick={() => setScheduleOpen((open) => !open)}>Schedule Match</button> : null}
            {canManage ? <button className="btn-secondary" type="button" onClick={() => setInviteOpen((open) => !open)}>Invite Player</button> : null}
          </div>
        </div>
      </section>

      {message ? <p className="rounded-lg bg-white px-3 py-2 text-sm font-bold text-[var(--muted)]">{message}</p> : null}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {["overview", "members", "matches", "leaderboard"].map((item) => (
          <button key={item} className={tab === item ? "btn-dark" : "btn-secondary"} type="button" onClick={() => setTab(item)}>
            {item[0].toUpperCase() + item.slice(1)}
          </button>
        ))}
      </div>

      <div className="group-room-layout">
        <div className="grid gap-3">
          {scheduleOpen ? (
            <form action={scheduleMatch} className="surface grid gap-3 p-4">
              <h2 className="text-xl font-black">Schedule Match</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <input className="field" name="scheduledDate" type="date" required />
                <input className="field" name="matchTime" type="time" required />
              </div>
              <input className="field" name="location" placeholder="Ground / location" required />
              <input className="field" name="maximumPlayers" type="number" min="2" defaultValue={12} />
              <label className="flex items-center gap-2 text-sm font-bold"><input name="auctionEnabled" type="checkbox" defaultChecked /> Auction enabled</label>
              <button className="btn-primary" type="submit">Save Match</button>
            </form>
          ) : null}

          {inviteOpen ? (
            <div className="surface grid gap-3 p-4">
              <form action={searchUsers} className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <input className="field" name="q" placeholder="Search player name or @username" />
                <button className="btn-secondary" type="submit"><Search size={18} /> Search</button>
              </form>
              {searchResults.map((result) => (
                <div key={result.id} className="data-row flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="font-black">{result.display_name}</div>
                    <div className="text-sm text-[var(--muted)]">@{result.username} - {result.preferred_position}</div>
                  </div>
                  <button className="btn-primary w-full sm:w-fit" type="button" onClick={() => invite(result.id)}><Send size={18} /> Invite</button>
                </div>
              ))}
            </div>
          ) : null}

          {tab === "overview" ? (
            <>
              <div className="surface p-3 sm:p-4">
                <div className="section-title mb-3"><h2>Next Match</h2><ShieldCheck size={20} /></div>
                {nextMatch ? <MatchCard match={nextMatch} /> : <div className="empty-state">No upcoming match scheduled</div>}
              </div>
              <div className="surface p-3 sm:p-4">
                <div className="section-title mb-3"><h2>Recent Result</h2><Trophy size={20} /></div>
                {completedMatches[0] ? <MatchCard match={completedMatches[0]} /> : <div className="empty-state">No completed matches yet</div>}
              </div>
            </>
          ) : null}

          {tab === "members" ? (
            <div className="surface grid gap-2 p-3 sm:p-4">
              {members.map((member) => (
                <div key={member.users.id} className="data-row flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <img src={optimizedPhotoUrl(member.users.profile_image, 88) ?? fallbackPhoto()} alt="" loading="lazy" decoding="async" className="h-11 w-11 rounded-lg object-cover" />
                    <div className="min-w-0">
                      <div className="truncate font-black">{member.users.display_name}</div>
                      <div className="truncate text-sm text-[var(--muted)]">@{member.users.username} - {member.users.preferred_position}</div>
                    </div>
                    <span className="rounded-lg bg-[#e8f5ef] px-2 py-1 text-xs font-black text-[var(--accent-dark)]">{member.role}</span>
                  </div>
                  {canChangeRoles && member.role === "PLAYER" ? (
                    <button className="btn-secondary w-full sm:w-fit" type="button" onClick={() => changeRole(member.users.id, "ADMIN")}>
                      Make Admin
                    </button>
                  ) : null}
                  {canChangeRoles && member.role === "ADMIN" ? (
                    <button className="btn-secondary w-full sm:w-fit" type="button" onClick={() => changeRole(member.users.id, "PLAYER")}>
                      Remove Admin
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {tab === "matches" ? (
            <div className="surface grid gap-3 p-3 sm:p-4">
              {playableMatches.map((match) => <MatchCard key={match.id} match={match} />)}
              {!playableMatches.length ? <div className="empty-state">No matches yet</div> : null}
            </div>
          ) : null}

          {tab === "leaderboard" ? (
            <div className="surface grid gap-2 p-3 sm:p-4">
              {leaderboard.map((row, index) => (
                <div key={row.user_id} className="data-row grid gap-2 p-3 sm:grid-cols-[auto_1fr_repeat(4,auto)] sm:items-center">
                  <div className="font-black text-[var(--accent-dark)]">#{index + 1}</div>
                  <div className="font-black">{row.display_name ?? "Player"}</div>
                  <div>{row.goals ?? 0} G</div>
                  <div>{row.assists ?? 0} A</div>
                  <div>{Number(row.average_rating ?? 0).toFixed(1)} Rating</div>
                  <div>{row.motm ?? 0} MOTM</div>
                </div>
              ))}
              {!leaderboard.length ? <div className="empty-state">Leaderboard appears after completed matches</div> : null}
            </div>
          ) : null}
        </div>

        <aside className="group-side-stack">
          <div className="pitch-card p-4">
            <div className="relative z-10">
              <p className="text-xs font-black uppercase tracking-wide text-white/62">Auction</p>
              <h2 className="text-2xl font-black text-white">Build Teams</h2>
              <p className="mt-2 text-sm text-white/68">{activeAuction ? "Continue the active auction for this group." : "Finalize availability, then start an auction for this group."}</p>
              <button className="btn-primary mt-5 w-full" disabled={auctionStarting} type="button" onClick={startAuction}><Gavel size={18} /> {auctionStarting ? "Starting..." : activeAuction ? "Open Auction" : "Start Auction"}</button>
            </div>
          </div>
          <div className="surface p-3 sm:p-4">
            <div className="section-title mb-3"><h2>Group Snapshot</h2><Users size={20} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-[var(--panel-soft)] p-3"><div className="text-xs font-bold text-[var(--muted)]">Players</div><div className="text-2xl font-black">{members.length}</div></div>
              <div className="rounded-lg bg-[var(--panel-soft)] p-3"><div className="text-xs font-bold text-[var(--muted)]">Matches</div><div className="text-2xl font-black">{playableMatches.length}</div></div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
