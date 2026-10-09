import { AuctionHub } from "@/components/football/AuctionHub";
import { AuctionRoom } from "@/components/football/AuctionRoom";
import { AuctionSetupForm } from "@/components/football/AuctionSetupForm";
import { ScheduleAuctionMatchForm } from "@/components/football/ScheduleAuctionMatchForm";
import { getAuctionSnapshot, parseAuctionState } from "@/lib/auctionLive";
import { getCurrentAppUser } from "@/lib/auth";
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

  const { data: memberships } = await supabase
    .from("group_members")
    .select("role, groups(id, name, logo, description)")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: false });
  const footballMemberships = (memberships ?? []).filter((membership: any) => {
    const name = String(membership.groups?.name ?? "");
    return name && !name.includes("@") && !name.toLowerCase().includes("'s org");
  });
  const visibleMemberships = footballMemberships.length ? footballMemberships : (memberships ?? []);

  if (!matchId) {
    const groupIds = visibleMemberships.map((membership: any) => membership.groups.id);
    const { data: members } = groupIds.length
      ? await supabase
          .from("group_members")
          .select("group_id, users(id, display_name, username, preferred_position, profile_image)")
          .in("group_id", groupIds)
      : { data: [] };
    const playersByGroup = (members ?? []).reduce((acc: Record<string, any[]>, row: any) => {
      acc[row.group_id] = acc[row.group_id] ?? [];
      if (row.users) acc[row.group_id].push(row.users);
      return acc;
    }, {});

    return (
      <div className="page-wrap">
        <header className="py-3 text-white">
          <p className="eyebrow">Auction</p>
          <h1 className="text-4xl font-black">Auction Hub</h1>
          <p className="text-sm font-medium text-white/62">Start an auction from your group players first, then schedule the match after.</p>
        </header>
        <AuctionHub groups={visibleMemberships as any} playersByGroup={playersByGroup} />
      </div>
    );
  }

  const { data: match } = await supabase
    .from("matches")
    .select("id, group_id, scheduled_date, match_time, location, maximum_players, status, notes, groups(name)")
    .eq("id", matchId)
    .maybeSingle();

  if (!match) {
    return (
      <div className="page-wrap">
        <div className="empty-state">
          <div>
            <Gavel className="mx-auto mb-3 text-[var(--accent-dark)]" size={30} />
            <p className="font-black text-[var(--foreground)]">No auction selected</p>
            <Link className="btn-dark mt-4" href="/groups"><ArrowLeft size={18} /> Back to groups</Link>
          </div>
        </div>
      </div>
    );
  }

  const [{ data: membership }, { data: auction }, { data: groupPlayers }, { data: confirmedPlayers }, { data: basicTeams }] = await Promise.all([
    supabase.from("group_members").select("role").eq("group_id", match.group_id).eq("user_id", user.id).maybeSingle(),
    supabase.from("auctions").select("*").eq("match_id", match.id).maybeSingle(),
    supabase
      .from("group_members")
      .select("users(id, display_name, username, preferred_position, profile_image)")
      .eq("group_id", match.group_id),
    supabase
      .from("match_availability")
      .select("users(id, display_name, username, preferred_position, profile_image)")
      .eq("match_id", match.id)
      .eq("status", "PLAYING"),
    supabase
      .from("teams")
      .select("id, name, captain_id")
      .eq("match_id", match.id)
      .order("name")
  ]);

  if (!membership) redirect("/auction");
  const canManage = membership.role === "OWNER" || membership.role === "ADMIN";

  let setupTeams = uniqueNamedTeams(basicTeams ?? []);
  if (setupTeams.length < 2) {
    const existingNames = new Set(setupTeams.map((team: any) => String(team.name).toLowerCase()));
    const rows = ["Team A", "Team B"]
      .filter((name) => !existingNames.has(name.toLowerCase()))
      .map((name) => ({ match_id: match.id, name }));
    if (rows.length) {
      await supabase.from("teams").insert(rows);
      const { data: freshTeams } = await supabase
        .from("teams")
        .select("id, name, captain_id")
        .eq("match_id", match.id)
        .order("name");
      setupTeams = uniqueNamedTeams(freshTeams ?? []);
    }
  }

  const allGroupPlayers = (groupPlayers ?? []).map((row: any) => row.users).filter(Boolean);
  const selectedPlayerIds = (confirmedPlayers ?? []).map((row: any) => row.users?.id).filter(Boolean);
  const captainIds = setupTeams.map((team: any) => team.captain_id).filter(Boolean);
  const setupState = parseAuctionState((match as any).notes, auction?.status === "LIVE" ? "LIVE" : "DRAFT");
  const setupComplete = new Set(captainIds).size >= 2 && Boolean(setupState.auctioneerId) && selectedPlayerIds.length >= 1;

  const header = (
    <header className="flex flex-wrap items-end justify-between gap-3 py-3 text-white">
      <div>
        <p className="eyebrow">Auction Room</p>
        <h1 className="text-4xl font-black">{(match as any).groups?.name ?? "Football"} Auction</h1>
        <p className="text-sm font-medium text-white/62">{match.scheduled_date} at {match.match_time} - {match.location}</p>
      </div>
      <Link className="btn-secondary" href="/groups"><ArrowLeft size={18} /> Groups</Link>
    </header>
  );

  if (!setupComplete && auction?.status !== "LIVE") {
    return (
      <div className="page-wrap">
        {header}
        <AuctionSetupForm
          matchId={match.id}
          teams={setupTeams as any}
          players={allGroupPlayers as any}
          selectedPlayerIds={selectedPlayerIds as any}
          auctioneerId={setupState.auctioneerId}
          canManage={canManage}
        />
      </div>
    );
  }

  const snapshot = await getAuctionSnapshot(supabase, match.id);

  return (
    <div className="page-wrap">
      {header}
      <AuctionRoom
        matchId={match.id}
        initialSnapshot={snapshot as any}
        currentUserId={user.id}
        canManage={canManage}
      />

      {match.status === "AUCTION" && snapshot.state.status === "ENDED" ? (
        <section className="mt-4">
          <ScheduleAuctionMatchForm matchId={match.id} defaultPlayers={snapshot.selectedPlayers.length || match.maximum_players} />
        </section>
      ) : null}
    </div>
  );
}
