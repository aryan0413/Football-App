"use client";

import { PlayerAvatar } from "@/components/football/PlayerAvatar";
import { Gavel, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type AuctionGroup = {
  role: string;
  groups: {
    id: string;
    name: string;
    logo: string | null;
    description: string | null;
  };
};

type AuctionPlayer = {
  id: string;
  display_name: string;
  username: string;
  preferred_position: string;
  profile_image: string | null;
};

export function AuctionHub({
  groups,
  playersByGroup
}: {
  groups: AuctionGroup[];
  playersByGroup: Record<string, AuctionPlayer[]>;
}) {
  const router = useRouter();
  const [selectedGroupId, setSelectedGroupId] = useState(groups[0]?.groups.id ?? "");
  const [message, setMessage] = useState("");
  const [starting, setStarting] = useState(false);
  const selectedGroup = groups.find((item) => item.groups.id === selectedGroupId);
  const players = selectedGroupId ? (playersByGroup[selectedGroupId] ?? []) : [];

  async function startAuction() {
    if (starting) return;
    setMessage("");
    setStarting(true);
    try {
      const response = await fetch("/api/auctions/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: selectedGroupId, maximumPlayers: Math.max(players.length, 2) })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(data.error ?? "Could not start auction.");
        setStarting(false);
        return;
      }
      router.push(`/auction?matchId=${data.matchId}`);
    } catch {
      setMessage("Connection interrupted. Please try again.");
    } finally {
      setStarting(false);
    }
  }

  return (
    <section className="auction-hub-layout">
      <div className="pitch-card auction-hub-setup">
        <div className="relative z-10 grid gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-white/62">Auction setup</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Build your teams</h2>
          </div>
          <label className="grid gap-2 text-xs text-[var(--muted)]">
            Football group
            <select
              className="field"
              value={selectedGroupId}
              onChange={(event) => setSelectedGroupId(event.target.value)}
            >
              {groups.map((group) => (
                <option key={group.groups.id} value={group.groups.id}>
                  {group.groups.name}
                </option>
              ))}
            </select>
          </label>
          <div className="rounded-lg bg-white/12 p-3 text-white">
            <div className="flex items-center justify-between text-sm font-black">
              <span className="flex items-center gap-2">
                <Users size={16} /> Available players
              </span>
              <span>{players.length}</span>
            </div>
          </div>
          <button
            className="btn-primary w-full"
            disabled={starting || !selectedGroupId || players.length < 1}
            type="button"
            onClick={startAuction}
          >
            <Gavel size={18} />
            {starting ? "Starting..." : "Start Auction"}
          </button>
          {message ? <p className="rounded-lg bg-white/14 p-3 text-sm font-bold text-white">{message}</p> : null}
        </div>
      </div>

      <div className="min-w-0">
        <div className="section-title mb-3">
          <h2>{selectedGroup?.groups.name ?? "Players"}</h2>
          <Users size={20} />
        </div>
        <div className="auction-roster">
          {players.map((player) => (
            <div key={player.id} className="data-row flex items-center gap-3 p-3">
              <PlayerAvatar src={player.profile_image} name={player.display_name} size={40} />
              <div className="min-w-0">
                <div className="truncate font-black">{player.display_name}</div>
                <div className="truncate text-sm text-[var(--muted)]">
                  @{player.username} - {player.preferred_position}
                </div>
              </div>
            </div>
          ))}
          {!players.length ? <div className="empty-state sm:col-span-2">Add players to the group first.</div> : null}
        </div>
      </div>
    </section>
  );
}
