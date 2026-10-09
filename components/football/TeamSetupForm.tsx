"use client";

import { Save, Shield } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

const formations = ["4-3-3", "4-4-2", "4-2-3-1", "3-5-2", "3-4-3", "5-3-2"];

type TeamSetupFormProps = {
  matchId: string;
  teams: Array<{ id: string; name: string; formation?: string | null; captain_id?: string | null }>;
  players: Array<{ id: string; display_name: string; preferred_position: string }>;
};

export function TeamSetupForm({ matchId, teams, players }: TeamSetupFormProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function save(formData: FormData) {
    setMessage("");
    const payload = teams.map((team) => ({
      id: team.id,
      formation: formData.get(`formation-${team.id}`),
      captainId: formData.get(`captain-${team.id}`)
    }));

    const response = await fetch("/api/teams/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId, teams: payload })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.error ?? "Could not save team setup.");
      return;
    }
    setMessage("Team setup saved.");
    router.refresh();
  }

  return (
    <form action={save} className="surface grid gap-4 p-4">
      <div className="section-title">
        <div>
          <p className="eyebrow">Before match</p>
          <h2>Team Setup</h2>
        </div>
        <Shield size={20} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {teams.map((team) => (
          <div key={team.id} className="data-row grid gap-3 p-3">
            <h3 className="font-black">{team.name}</h3>
            <label className="grid gap-1 text-sm font-black">
              Formation
              <select className="field" name={`formation-${team.id}`} defaultValue={team.formation ?? "4-3-3"}>
                {formations.map((formation) => <option key={formation}>{formation}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-black">
              Captain
              <select className="field" name={`captain-${team.id}`} defaultValue={team.captain_id ?? ""}>
                <option value="">Select captain</option>
                {players.map((player) => (
                  <option key={player.id} value={player.id}>{player.display_name} - {player.preferred_position}</option>
                ))}
              </select>
            </label>
          </div>
        ))}
      </div>
      <button className="btn-primary w-full sm:w-fit" type="submit"><Save size={18} /> Save Team Setup</button>
      {message ? <p className="rounded-lg bg-[#e8f5ef] p-3 text-sm font-bold text-[var(--accent-dark)]">{message}</p> : null}
    </form>
  );
}
