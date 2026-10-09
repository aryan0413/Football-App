import { getCurrentAppUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { GroupManager } from "@/components/football/GroupManager";
import { redirect } from "next/navigation";

export default async function GroupsPage() {
  const user = await getCurrentAppUser();
  if (!user) redirect("/");

  const supabase = getSupabaseAdmin();
  const { data: memberships } = await supabase
    .from("group_members")
    .select("role, groups(id, name, logo, description, created_at)")
    .eq("user_id", user.id);
  const footballMemberships = (memberships ?? []).filter((membership: any) => {
    const name = String(membership.groups?.name ?? "");
    return name && !name.includes("@") && !name.toLowerCase().includes("'s org");
  });
  const visibleMemberships = footballMemberships.length ? footballMemberships : (memberships ?? []);

  return (
    <div className="page-wrap">
      <header className="group-page-hero app-hero p-5 text-white sm:p-6">
        <div className="relative z-10">
          <p className="eyebrow">Clubhouse</p>
          <h1 className="mt-2 text-4xl font-black">Groups</h1>
          <p className="text-sm font-medium text-white/62">Create private groups, invite players, and keep stats separate by community.</p>
        </div>
      </header>

      <GroupManager memberships={visibleMemberships as any} />
    </div>
  );
}
