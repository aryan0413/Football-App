import { AuctionHub } from "@/components/football/AuctionHub";
import { AuctionRoom } from "@/components/football/AuctionRoom";
import { AuctionSetupForm } from "@/components/football/AuctionSetupForm";
import { ScheduleAuctionMatchForm } from "@/components/football/ScheduleAuctionMatchForm";
import { getAuctionSnapshot, parseAuctionState } from "@/lib/auctionLive";
import { getCurrentAppUser } from "@/lib/auth";
import { withPlayerPhotoUrls } from "@/lib/playerPhotos";
import { getSupabaseAdmin } from "@/lib/supabase";
import { uniqueNamedTeams } from "@/lib/teams";
import { ArrowLeft, Gavel } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function AuctionPage({ searchParams }: { searchParams: Promise<{ matchId?: string }> }) {
  const user = await getCurrentAppUser();
  if (!user) redirect("/");
  const { matchId } = await searchParams;
  const supabase = getSupabaseAdmin();

  if (!matchId) {
    const { data: memberships, error } = await supabase.from("group_members")
      .select("role, groups(id, name, logo, description)").eq("user_id", user.id).order("joined_at", { ascending: false });
    if (error) throw error;
    const football = (memberships ?? []).filter((row: any) => row.groups?.name && !row.groups.name.includes("@") && !row.groups.name.toLowerCase().includes("'s org"));
    const visible = football.length ? football : memberships ?? [];
    const ids = visible.map((row: any) => row.groups.id);
    const [membersResult, roomsResult] = ids.length ? await Promise.all([
      supabase.from("group_members").select("group_id, users(id, display_name, username, preferred_position, profile_image)").in("group_id", ids),
      supabase.from("matches").select("id, group_id, notes, auctions(status)").in("group_id", ids).eq("status", "AUCTION").order("created_at", { ascending: false })
    ]) : [{ data: [], error: null }, { data: [], error: null }];
    if (membersResult.error) throw membersResult.error;
    if (roomsResult.error) throw roomsResult.error;
    const playersByGroup: Record<string, any[]> = {};
    for (const row of withPlayerPhotoUrls(membersResult.data ?? []) as any[]) {
      if (row.users) (playersByGroup[row.group_id] ??= []).push(row.users);
    }
    const activeByGroup: Record<string, string> = {};
    for (const row of roomsResult.data ?? [] as any[]) {
      const auction = Array.isArray(row.auctions) ? row.auctions[0] : row.auctions;
      if (auction?.status !== "ENDED" && parseAuctionState(row.notes).status !== "ENDED") activeByGroup[row.group_id] ??= row.id;
    }
    return <div className="page-wrap">
      <header className="py-3 text-white"><p className="eyebrow">Auction</p><h1 className="text-4xl font-black">Auctions</h1>
        <p className="text-sm font-medium text-white/62">{visible.length} groups available</p></header>
      <AuctionHub groups={visible as any} playersByGroup={playersByGroup} activeByGroup={activeByGroup} />
    </div>;
  }

  const { data: match, error } = await supabase.from("matches")
    .select("id, group_id, scheduled_date, match_time, location, maximum_players, status, notes, groups(name)").eq("id", matchId).maybeSingle();
  if (error) throw error;
  if (!match) return <div className="page-wrap"><div className="empty-state"><div>
    <Gavel className="mx-auto mb-3 text-[var(--accent-dark)]" size={30} /><p className="font-black">No auction selected</p>
    <Link className="btn-dark mt-4" href="/auction"><ArrowLeft size={18} /> Auctions</Link>
  </div></div></div>;
  const { data: membership, error: membershipError } = await supabase.from("group_members").select("role")
    .eq("group_id", match.group_id).eq("user_id", user.id).maybeSingle();
  if (membershipError) throw membershipError;
  if (!membership) redirect("/auction");
  const canManage = ["OWNER", "ADMIN"].includes(membership.role);
  const snapshot = await getAuctionSnapshot(supabase, match.id, match);
  const setupTeams = uniqueNamedTeams(snapshot.teams);
  const captainIds = setupTeams.map((team) => team.captain_id).filter(Boolean);
  const setupComplete = new Set(captainIds).size === 2 && Boolean(snapshot.state.auctioneerId) && snapshot.selectedPlayers.length >= 1;
  const needsSetup = snapshot.state.status === "DRAFT" && !setupComplete;
  const { data: members, error: playersError } = needsSetup
    ? await supabase.from("group_members").select("users(id, display_name, username, preferred_position, profile_image)").eq("group_id", match.group_id)
    : { data: [], error: null };
  if (playersError) throw playersError;
  return <div className="page-wrap">
    <header className="flex flex-wrap items-end justify-between gap-3 py-3 text-white"><div>
      <p className="eyebrow">Auction Room</p><h1 className="text-4xl font-black">{(match as any).groups?.name ?? "Football"} Auction</h1>
      <p className="text-sm font-medium text-white/62">{match.scheduled_date} at {match.match_time} - {match.location}</p>
    </div><Link className="btn-secondary" href="/groups"><ArrowLeft size={18} /> Groups</Link></header>
    {needsSetup ? <AuctionSetupForm matchId={match.id} teams={setupTeams as any}
      players={withPlayerPhotoUrls((members ?? []).map((row: any) => row.users).filter(Boolean))}
      selectedPlayerIds={snapshot.selectedPlayers.map((player: any) => player.id)} auctioneerId={snapshot.state.auctioneerId} canManage={canManage} />
      : <AuctionRoom matchId={match.id} initialSnapshot={snapshot as any} currentUserId={user.id} canManage={canManage} />}
    {canManage && match.status === "AUCTION" && snapshot.state.status === "ENDED" ? <section className="mt-4">
      <ScheduleAuctionMatchForm matchId={match.id} defaultPlayers={snapshot.selectedPlayers.length || match.maximum_players} />
    </section> : null}
  </div>;
}
