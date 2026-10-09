"use client";

import { CalendarClock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ScheduleAuctionMatchForm({ matchId, defaultPlayers }: { matchId: string; defaultPlayers: number }) {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function schedule(formData: FormData) {
    setMessage("");
    const response = await fetch("/api/matches/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchId,
        scheduledDate: formData.get("scheduledDate"),
        matchTime: formData.get("matchTime"),
        location: formData.get("location"),
        maximumPlayers: formData.get("maximumPlayers")
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.error ?? "Could not schedule match.");
      return;
    }
    setMessage("Match scheduled.");
    router.refresh();
  }

  return (
    <form action={schedule} className="surface grid gap-3 p-4">
      <div>
        <p className="eyebrow">After auction</p>
        <h2 className="text-xl font-black">Schedule Match</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <input className="field" name="scheduledDate" required type="date" />
        <input className="field" name="matchTime" required type="time" />
      </div>
      <input className="field" name="location" placeholder="Ground / location" required />
      <input className="field" name="maximumPlayers" min="2" type="number" defaultValue={Math.max(defaultPlayers, 2)} />
      <button className="btn-primary" type="submit"><CalendarClock size={18} /> Save Schedule</button>
      {message ? <p className="rounded-lg bg-[#e8f5ef] p-3 text-sm font-bold text-[var(--accent-dark)]">{message}</p> : null}
    </form>
  );
}
