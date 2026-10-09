import { GroupRoom } from "@/components/football/GroupRoom";
import { getCurrentAppUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { redirect } from "next/navigation";

export default async function GroupPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ panel?: string }>;
}) {
  const user = await getCurrentAppUser();
  if (!user) redirect("/");

  const { id } = await params;
  const { panel } = await searchParams;
  const supabase = getSupabaseAdmin();

  const { data: membership } = await supabase
    .from("group_members")
    .select("role, groups(id, name, logo, description)")
    .eq("group_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership?.groups) redirect("/groups");

  const [membersResult, matchesResult, leaderboardResult] = await Promise.all([
    supabase
      .from("group_members")
      .select("role, users(id, display_name, username, preferred_position, profile_image)")
      .eq("group_id", id)
      .order("joined_at", { ascending: true }),
    supabase
      .from("matches")
      .select("id, group_id, scheduled_date, match_time, location, maximum_players, status, groups(name), match_availability(status)")
      .eq("group_id", id)
      .order("scheduled_date", { ascending: false }),
    supabase
      .from("player_stat_summary")
      .select("user_id, matches, goals, assists, wins, motm, average_rating")
      .eq("group_id", id)
      .order("goals", { ascending: false })
  ]);

  const leaderboardIds = (leaderboardResult.data ?? []).map((row: any) => row.user_id);
  const { data: leaderboardUsers } = leaderboardIds.length
    ? await supabase.from("users").select("id, display_name").in("id", leaderboardIds)
    : { data: [] };
  const namesById = new Map((leaderboardUsers ?? []).map((player: any) => [player.id, player.display_name]));
  const leaderboard = (leaderboardResult.data ?? []).map((row: any) => ({
    ...row,
    display_name: namesById.get(row.user_id) ?? "Player"
  }));

  return (
    <div className="page-wrap">
      <GroupRoom
        group={(membership.groups as any)}
        role={membership.role}
        members={(membersResult.data ?? []) as any}
        matches={(matchesResult.data ?? []) as any}
        leaderboard={leaderboard as any}
        initialPanel={panel}
      />
    </div>
  );
}
