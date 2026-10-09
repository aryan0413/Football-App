"use client";

import { Gavel, ShieldCheck, UserPlus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { GroupCard } from "@/components/football/cards/GroupCard";

type Membership = {
  role: string;
  groups: {
    id: string;
    name: string;
    logo: string | null;
    description: string | null;
  };
};

export function GroupManager({ memberships }: { memberships: Membership[] }) {
  const router = useRouter();
  const [items, setItems] = useState(memberships);
  const [message, setMessage] = useState("");
  const [createOpen, setCreateOpen] = useState(!memberships.length);
  const [joinOpen, setJoinOpen] = useState(false);

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
    setItems((current) => [{ role: "OWNER", groups: data.group }, ...current]);
    setMessage("Group created. You can now invite players.");
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
    setMessage("");
    const response = await fetch("/api/auctions/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.error ?? "Could not start auction.");
      return;
    }
    router.push(`/auction?matchId=${data.matchId}`);
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
        {message ? <p className="rounded-lg bg-white px-3 py-2 text-sm font-bold text-[var(--muted)]">{message}</p> : null}
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
          <button className="btn-primary w-full" type="submit"><ShieldCheck size={18} /> Create and add players</button>
          </form>
        ) : null}

        {joinOpen ? (
          <form action={joinGroup} className="group-form-panel surface grid gap-3 p-4">
          <div>
            <p className="eyebrow">Join group</p>
            <h2 className="text-xl font-black">Enter Group Name</h2>
          </div>
          <input className="field" name="groupName" placeholder="Exact group name" required />
          <button className="btn-dark w-full" type="submit"><UserPlus size={18} /> Join Group</button>
          </form>
        ) : null}
      </div>

      <div className="group-card-grid">
        {items.map((membership) => (
          <div key={membership.groups.id} className="group-card-stack grid gap-3">
            <GroupCard group={membership.groups} role={membership.role} />
            <button className="group-auction-control btn-dark w-full" type="button" onClick={() => startAuction(membership.groups.id)}>
              <Gavel size={18} />
              Start Auction Now
            </button>
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
