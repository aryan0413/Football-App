import { StatGrid } from "@/components/football/StatGrid";
import { getCurrentAppUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getUserStats } from "@/lib/stats";
import { BarChart3 } from "lucide-react";
import { redirect } from "next/navigation";

export default async function StatsPage() {
  const user = await getCurrentAppUser();
  if (!user) redirect("/");
  const stats = await getUserStats(user.id);
  const supabase = getSupabaseAdmin();
  const { data: groupStats } = await supabase
    .from("player_stat_summary")
    .select("group_id, matches, goals, assists, wins, motm, average_rating, groups(name)")
    .eq("user_id", user.id);

  return (
    <div className="page-wrap">
      <header className="py-3 text-white">
        <p className="eyebrow">Performance</p>
        <h1 className="text-4xl font-black">Stats</h1>
        <p className="text-sm font-medium text-white/62">Overall career numbers and group-specific performance.</p>
      </header>
      <StatGrid stats={stats} />
      <section className="mt-4 grid gap-2.5">
        <h2 className="text-lg font-black text-white">By Group</h2>
        {(groupStats ?? []).map((row: any) => (
          <div key={row.group_id} className="surface grid gap-2.5 p-3 sm:grid-cols-[1fr_repeat(5,auto)] sm:items-center">
            <div className="font-black">{row.groups?.name ?? "Group"}</div>
            <div>{row.matches} Matches</div>
            <div>{row.goals} Goals</div>
            <div>{row.assists} Assists</div>
            <div>{Number(row.average_rating ?? 0).toFixed(1)} Rating</div>
            <div>{row.motm} MOTM</div>
          </div>
        ))}
        {!(groupStats ?? []).length ? (
          <div className="empty-state">
            <div>
              <BarChart3 className="mx-auto mb-3 text-[var(--accent-dark)]" size={28} />
              <p className="font-black text-[var(--foreground)]">No group stats yet</p>
              <p className="mt-1 text-sm">Stats will appear after completed matches and ratings.</p>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
