"use client";

import { Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function StartMatchButton({ matchId }: { matchId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function startMatch() {
    setLoading(true);
    const now = new Date();
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const response = await fetch("/api/matches/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchId,
        startedDate: localDate,
        startedTime: now.toTimeString().slice(0, 5)
      })
    });
    setLoading(false);
    if (response.ok) {
      router.push(`/match/${matchId}`);
      return;
    }
    router.refresh();
  }

  return (
    <button className="btn-primary w-full" disabled={loading} type="button" onClick={startMatch}>
      <Play size={18} />
      {loading ? "Starting..." : "Start Match"}
    </button>
  );
}
