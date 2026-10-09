import { Award, Crosshair, Medal, Percent, ShieldCheck, Sparkles, Trophy, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { UserStats } from "@/lib/types";

export function StatGrid({ stats }: { stats: UserStats }) {
  const values: Array<[string, string | number, LucideIcon]> = [
    ["Matches", stats.matches, Users],
    ["Goals", stats.goals, Crosshair],
    ["Assists", stats.assists, Sparkles],
    ["G+A", stats.goals + stats.assists, Trophy],
    ["Avg Rating", stats.averageRating.toFixed(1), Medal],
    ["Wins", stats.wins, ShieldCheck],
    ["Win Rate", stats.matches ? `${((stats.wins / stats.matches) * 100).toFixed(1)}%` : "0%", Percent],
    ["MOTM", stats.motm, Award]
  ];

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 2xl:grid-cols-8">
      {values.map(([label, value, Icon]) => (
        <div key={label} className="stat-card">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-black uppercase tracking-wide text-[var(--muted)]">{label}</div>
            <Icon className="text-[var(--accent-dark)]" size={18} />
          </div>
          <div className="mt-2 text-3xl font-black">{value}</div>
        </div>
      ))}
    </div>
  );
}
