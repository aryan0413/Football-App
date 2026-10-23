import { MatchdayDashboard } from "@/components/football/MatchdayDashboard";
import { OnboardingForm } from "@/components/football/OnboardingForm";
import { getCurrentAppUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getUserStats } from "@/lib/stats";
import { auth } from "@clerk/nextjs/server";

export default async function HomePage() {
  const { userId } = await auth();
  if (!userId) {
    return (
      <MatchdayDashboard
        stats={{ matches: 0, goals: 0, assists: 0, wins: 0, motm: 0, averageRating: 0 }}
        memberships={[]}
        matches={[]}
        invitations={[]}
      />
    );
  }

  const user = await getCurrentAppUser();
  if (!user)
    return (
      <div className="page-wrap">
        <OnboardingForm />
      </div>
    );

  const supabase = getSupabaseAdmin();
  const [stats, groupsResult, invitationsResult] = await Promise.all([
    getUserStats(user.id),
    supabase
      .from("group_members")
      .select("role, groups(id, name, logo, description)")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: false }),
    supabase
      .from("group_invitations")
      .select("id, groups(name), inviter:invited_by(display_name)")
      .eq("invited_user_id", user.id)
      .eq("status", "PENDING")
  ]);
  const memberships = (groupsResult.data ?? []).filter((membership: any) => membership.groups?.id);
  const groupIds = memberships.map((membership: any) => membership.groups.id);
  const matchesResult = groupIds.length
    ? await supabase
        .from("matches")
        .select(
          "id, scheduled_date, match_time, location, status, maximum_players, groups(name), match_availability(status)"
        )
        .in("group_id", groupIds)
        .in("status", ["SCHEDULED", "LIVE"])
        .order("scheduled_date", { ascending: true })
        .limit(4)
    : { data: [] };

  return (
    <MatchdayDashboard
      user={user}
      stats={stats}
      memberships={memberships as any}
      matches={(matchesResult.data ?? []) as any}
      invitations={(invitationsResult.data ?? []) as any}
    />
  );
}
