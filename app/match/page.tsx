import { MyMatches } from "@/components/football/MyMatches";
import { getCurrentAppUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { redirect } from "next/navigation";

export default async function MatchPage() {
  const user = await getCurrentAppUser();
  if (!user) redirect("/");

  const supabase = getSupabaseAdmin();
  const { data: memberships } = await supabase
    .from("group_members")
    .select("role, groups(id, name)")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: false });

  const footballMemberships = (memberships ?? []).filter((membership: any) => {
    const name = String(membership.groups?.name ?? "");
    return name && !name.includes("@") && !name.toLowerCase().includes("'s org");
  });
  const visibleMemberships = footballMemberships.length ? footballMemberships : (memberships ?? []);
  const groupIds = visibleMemberships.map((membership: any) => membership.groups.id);
  const { data: matches } = groupIds.length
    ? await supabase
        .from("matches")
        .select("id, group_id, scheduled_date, match_time, location, maximum_players, status, groups(name), match_availability(status), teams(id, name), match_events(id, event_type, team_id)")
        .in("group_id", groupIds)
        .in("status", ["SCHEDULED", "LIVE", "ENDED"])
        .order("scheduled_date", { ascending: true })
    : { data: [] };

  return (
    <div className="page-wrap">
      <header className="flex flex-wrap items-end justify-between gap-3 py-3 text-white">
        <div>
          <p className="eyebrow">Matchday</p>
          <h1 className="text-4xl font-black">My Matches</h1>
          <p className="text-sm font-medium text-white/62">Upcoming, live, and completed games for your football groups.</p>
        </div>
      </header>

      <MyMatches groups={visibleMemberships as any} matches={(matches ?? []) as any} />
    </div>
  );
}
