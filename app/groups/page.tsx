import { getCurrentAppUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { GroupManager } from "@/components/football/GroupManager";
import { redirect } from "next/navigation";
import { parseAuctionState } from "@/lib/auctionLive";

export default async function GroupsPage() {
  const user = await getCurrentAppUser();
  if (!user) redirect("/");

  const supabase = getSupabaseAdmin();
  const { data: memberships, error: membershipsError } = await supabase
    .from("group_members")
    .select("role, groups(id, name, logo, description, created_at)")
    .eq("user_id", user.id);
  if (membershipsError) throw membershipsError;
  const footballMemberships = (memberships ?? []).filter((membership: any) => {
    const name = String(membership.groups?.name ?? "");
    return name && !name.includes("@") && !name.toLowerCase().includes("'s org");
  });
  const visibleMemberships = footballMemberships.length ? footballMemberships : (memberships ?? []);
  const groupIds = visibleMemberships.map((membership: any) => membership.groups.id);
  const [membersResult, roomsResult] = groupIds.length ? await Promise.all([
    supabase.from("group_members").select("group_id").in("group_id", groupIds),
    supabase.from("matches").select("id, group_id, notes, auctions(status)").in("group_id", groupIds)
      .eq("status", "AUCTION").order("created_at", { ascending: false })
  ]) : [{ data: [], error: null }, { data: [], error: null }];
  if (membersResult.error) throw membersResult.error;
  if (roomsResult.error) throw roomsResult.error;
  const activeByGroup: Record<string, string> = {};
  for (const row of roomsResult.data ?? [] as any[]) {
    const auction = Array.isArray(row.auctions) ? row.auctions[0] : row.auctions;
    if (auction?.status !== "ENDED" && parseAuctionState(row.notes).status !== "ENDED") activeByGroup[row.group_id] ??= row.id;
  }
  const memberCounts = new Map<string, number>();
  (membersResult.data ?? []).forEach((row: { group_id: string }) =>
    memberCounts.set(row.group_id, (memberCounts.get(row.group_id) ?? 0) + 1)
  );
  const groupsWithCounts = visibleMemberships.map((membership: any) => ({
    ...membership,
    groups: { ...membership.groups, member_count: memberCounts.get(membership.groups.id) ?? 0 }
  }));

  return (
    <div className="page-wrap">
      <header className="group-page-hero app-hero p-5 text-white sm:p-6">
        <div className="relative z-10">
          <p className="eyebrow">Workspace / Groups</p>
          <h1 className="mt-2 text-4xl font-black">My groups</h1>
          <p className="text-sm font-medium text-white/62">
            {visibleMemberships.length} football {visibleMemberships.length === 1 ? "group" : "groups"}
          </p>
        </div>
      </header>

      <GroupManager memberships={groupsWithCounts as any} activeByGroup={activeByGroup} />
    </div>
  );
}
