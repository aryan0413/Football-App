import { LiveMatchRoom } from "@/components/football/LiveMatchRoom";
import { getCurrentAppUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { redirect } from "next/navigation";

export default async function MatchRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentAppUser();
  if (!user) redirect("/");

  const { id } = await params;
  const supabase = getSupabaseAdmin();
  const { data: match } = await supabase
    .from("matches")
    .select("id, group_id, scheduled_date, match_time, location, status, groups(name)")
    .eq("id", id)
    .maybeSingle();

  if (!match) redirect("/match");

  const [{ data: membership }, { data: teams }, { data: events }, { data: members }, { data: ratings }] = await Promise.all([
    supabase.from("group_members").select("role").eq("group_id", match.group_id).eq("user_id", user.id).maybeSingle(),
    supabase
      .from("teams")
      .select("id, name, captain_id, captain:captain_id(display_name, preferred_position), team_players(users(id, display_name, preferred_position, profile_image))")
      .eq("match_id", match.id)
      .order("name"),
    supabase
      .from("match_events")
      .select("id, event_type, team_id, player_id, assist_player_id, minute, created_at, scorer:player_id(id, display_name, preferred_position, profile_image), assister:assist_player_id(id, display_name, preferred_position, profile_image)")
      .eq("match_id", match.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("group_members")
      .select("users(id, display_name, username, preferred_position, profile_image)")
      .eq("group_id", match.group_id),
    supabase
      .from("player_ratings")
      .select("rated_player_id, rating")
      .eq("match_id", match.id)
  ]);

  if (!membership) redirect("/match");
  const canManage = membership.role === "OWNER" || membership.role === "ADMIN";
  const players = (members ?? []).map((row: any) => row.users).filter(Boolean);

  return (
    <div className="page-wrap">
      <header className="py-3 text-white">
        <p className="eyebrow">Match Centre</p>
        <h1 className="text-4xl font-black">{(match as any).groups?.name ?? "Football Match"}</h1>
        <p className="text-sm font-medium text-white/62">{match.scheduled_date} at {match.match_time} - {match.location}</p>
      </header>
      <LiveMatchRoom match={match} teams={(teams ?? []) as any} players={players as any} events={(events ?? []) as any} ratings={(ratings ?? []) as any} canManage={canManage} />
    </div>
  );
}
