"use client";

import { Gavel, ShieldCheck, UserPlus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { GroupCard } from "@/components/football/cards/GroupCard";

type Membership = {
  role: string;
  groups: {
    id: string;
    name: string;
    logo: string | null;
    description: string | null;
    member_count?: number;
  };
};

export function GroupManager({ memberships, activeByGroup = {} }: {
  memberships: Membership[];
  activeByGroup?: Record<string, string>;
}) {
  const router = useRouter();
  const [items, setItems] = useState(memberships);
  const [message, setMessage] = useState("");
  const [createOpen, setCreateOpen] = useState(!memberships.length);
  const [joinOpen, setJoinOpen] = useState(false);
  const [openingGroupId, setOpeningGroupId] = useState("");
  const [navigating, startTransition] = useTransition();
  useEffect(() => setItems(memberships), [memberships]);

  async function createGroup(formData: FormData) {
    setMessage("");
    const response = await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData))
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Could not create group.");
      return;
    }
    setItems((current) => [{ role: "OWNER", groups: { ...data.group, member_count: 1 } }, ...current]);
    setCreateOpen(false);
    setMessage("Group created.");
  }

  async function joinGroup(formData: FormData) {
    setMessage("");
    const response = await fetch("/api/groups/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupName: formData.get("groupName") })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.error ?? "Could not join group.");
      return;
    }
    setItems((current) => {
      if (current.some((item) => item.groups.id === data.group.id)) return current;
      return [{ role: "PLAYER", groups: data.group }, ...current];
    });
    setMessage("Joined group.");
    router.refresh();
  }

  async function startAuction(groupId: string) {
    if (openingGroupId || navigating) return;
    const membership = items.find((item) => item.groups.id === groupId);
    const activeRoom = activeByGroup[groupId];
    if (!activeRoom && !["OWNER", "ADMIN"].includes(membership?.role ?? "")) {
      setMessage("Only a group owner or admin can start an auction.");
      return;
    }
    setMessage("");
    setOpeningGroupId(groupId);
    if (activeRoom) {
      startTransition(() => router.push(`/auction?matchId=${activeRoom}`));
      setOpeningGroupId("");
      return;
    }
    try {
      const response = await fetch("/api/auctions/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(data.error ?? (response.status === 403 ? "Only a group owner or admin can start an auction." : "Could not start auction."));
        return;
      }
      startTransition(() => router.push(`/auction?matchId=${data.matchId}`));
    } catch {
      setMessage("Connection interrupted. Please try again.");
    } finally {
      setOpeningGroupId("");
    }
  }

  return (
    <section className="groups-command-board mt-3 grid gap-3">
      <div className="groups-actions-rail flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" type="button" onClick={() => setCreateOpen((open) => !open)}>
            <ShieldCheck size={18} />
            Create Group
          </button>
          <button className="btn-secondary" type="button" onClick={() => setJoinOpen((open) => !open)}>
            <UserPlus size={18} />
            Join Group
          </button>
        </div>
        {message ? (
          <p className="rounded-lg bg-white px-3 py-2 text-sm font-bold text-[var(--muted)]">{message}</p>
        ) : null}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {createOpen ? (
          <form action={createGroup} className="group-form-panel pitch-card grid gap-3 p-4">
            <div className="relative z-10">
              <p className="text-xs font-black uppercase tracking-wide text-white/62">New group</p>
              <h2 className="mt-1 text-2xl font-black text-white">Create Football Group</h2>
            </div>
            <input className="field" placeholder="Sunday Football Bengaluru" name="name" required />
            <textarea className="field min-h-28" placeholder="Description" name="description" />
            <button className="btn-primary w-full" type="submit">
              <ShieldCheck size={18} /> Create and add players
            </button>
          </form>
        ) : null}

        {joinOpen ? (
          <form action={joinGroup} className="group-form-panel surface grid gap-3 p-4">
            <div>
              <p className="eyebrow">Join group</p>
              <h2 className="text-xl font-black">Enter Group Name</h2>
            </div>
            <input className="field" name="groupName" placeholder="Exact group name" required />
            <button className="btn-dark w-full" type="submit">
              <UserPlus size={18} /> Join Group
            </button>
          </form>
        ) : null}
      </div>

      <div className="group-card-grid">
        {items.map((membership) => (
          <div key={membership.groups.id} className="group-card-stack grid gap-3">
            <GroupCard group={membership.groups} role={membership.role} memberCount={membership.groups.member_count} />
            {activeByGroup[membership.groups.id] || ["OWNER", "ADMIN"].includes(membership.role) ? <button
              className="group-auction-control btn-dark w-full"
              type="button"
              disabled={Boolean(openingGroupId) || navigating}
              onClick={() => startAuction(membership.groups.id)}
            >
              <Gavel size={18} />
              {openingGroupId === membership.groups.id || navigating ? "Opening room..."
                : activeByGroup[membership.groups.id] ? "Rejoin Auction" : "Start Auction Now"}
            </button> : <p className="px-1 text-sm text-[var(--muted)]">Only a group owner or admin can start an auction.</p>}
          </div>
        ))}

        {!items.length ? (
          <div className="empty-state">
            <div>
              <Users className="mx-auto mb-3 text-[var(--accent-dark)]" size={28} />
              <p className="font-black text-[var(--foreground)]">No groups yet</p>
              <p className="mt-1 text-sm">Create your first group to invite players and schedule matches.</p>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
