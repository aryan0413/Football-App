import { AuthActions } from "@/components/football/AuthActions";
import { OnboardingForm } from "@/components/football/OnboardingForm";
import { StatGrid } from "@/components/football/StatGrid";
import { MatchCard } from "@/components/football/cards/MatchCard";
import { getCurrentAppUser } from "@/lib/auth";
import { fallbackPhoto, optimizedPhotoUrl } from "@/lib/images";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getUserStats } from "@/lib/stats";
import { auth } from "@clerk/nextjs/server";
import { CalendarDays, Radio, Shield, UserPlus, Users } from "lucide-react";
import Link from "next/link";

export default async function HomePage() {
  const { userId } = await auth();
  if (!userId) {
    return (
      <section className="page-wrap grid content-start py-6 sm:py-8">
        <div className="app-hero grid gap-6 p-5 sm:p-8 lg:grid-cols-[1.05fr_0.95fr] lg:p-10">
          <div className="relative z-10 min-w-0 max-w-2xl">
            <p className="eyebrow text-white/75">Private football communities</p>
            <h1 className="mt-3 break-words text-4xl font-black leading-tight sm:text-6xl">Matchday, managed like a pro.</h1>
            <p className="mt-4 max-w-xl text-lg text-white/72">
              Groups, auctions, fixtures, live scores, and player history in one polished football hub.
            </p>
            <div className="mt-7">
              <AuthActions />
            </div>
          </div>
          <div className="relative z-10 grid min-w-0 content-end">
            <div className="scoreboard p-4 shadow-2xl">
              <div className="flex items-center justify-between text-xs font-black uppercase tracking-wide text-white/52">
                <span className="inline-flex items-center gap-2"><Radio size={14} /> Live room</span>
                <span>Ready</span>
              </div>
              <div className="mt-5 grid grid-cols-3 items-center text-center">
                <div>
                  <div className="text-sm font-black text-white/62">TEAM A</div>
                  <div className="mt-2 text-6xl font-black">0</div>
                </div>
                <div className="text-sm font-black text-[var(--amber)]">VS</div>
                <div>
                  <div className="text-sm font-black text-white/62">TEAM B</div>
                  <div className="mt-2 text-6xl font-black">0</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const user = await getCurrentAppUser();

  if (!user) {
    return (
      <div className="page-wrap grid min-h-[calc(100vh-40px)] content-start py-4 sm:content-center">
        <OnboardingForm />
      </div>
    );
  }

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
  const groupIds = (groupsResult.data ?? []).map((membership: any) => membership.groups.id);
  const matchesResult = groupIds.length
    ? await supabase
        .from("matches")
        .select("id, scheduled_date, match_time, location, status, maximum_players, groups(name), match_availability(status)")
        .in("group_id", groupIds)
        .in("status", ["SCHEDULED", "LIVE"])
        .order("scheduled_date", { ascending: true })
        .limit(4)
    : { data: [] };

  return (
    <div className="page-wrap">
      <header className="app-hero p-5 sm:p-7">
        <div className="relative z-10 grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex min-w-0 items-center gap-4">
            <img
              src={optimizedPhotoUrl(user.profile_image, 160) ?? fallbackPhoto()}
              alt=""
              loading="eager"
              decoding="async"
              className="h-20 w-20 rounded-lg border-2 border-white/34 object-cover shadow-xl"
            />
            <div className="min-w-0">
              <p className="text-sm font-black uppercase text-white/58">@{user.username}</p>
              <h1 className="break-words text-3xl font-black text-white sm:text-5xl">Welcome back, {user.display_name}</h1>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="position-chip">{user.preferred_position}</span>
                <span className="position-chip">{stats.matches} matches</span>
              </div>
            </div>
          </div>
          <div className="justify-self-start lg:justify-self-end"><AuthActions /></div>
        </div>
      </header>

      <section className="mt-4">
        <StatGrid stats={stats} />
      </section>

      <section className="mt-4 grid gap-3 xl:grid-cols-[1.28fr_0.72fr]">
        <div className="surface p-3 sm:p-4">
          <div className="section-title mb-3">
            <h2>Upcoming Matches</h2>
            <CalendarDays size={20} />
          </div>
          <div className="grid gap-2.5">
            {(matchesResult.data ?? []).map((match: any) => (
              <MatchCard key={match.id} match={match} />
            ))}
            {!(matchesResult.data ?? []).length ? (
              <div className="empty-state">
                <div>
                  <CalendarDays className="mx-auto mb-3 text-[var(--accent-dark)]" size={28} />
                  <p className="font-black text-[var(--foreground)]">No matches scheduled</p>
                  <p className="mt-1 text-sm">Create a group, then schedule the next session.</p>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3">
          <div className="surface p-3 sm:p-4">
            <div className="section-title mb-3">
              <h2>Groups</h2>
              <Shield size={20} />
            </div>
            <div className="grid gap-2">
              {(groupsResult.data ?? []).map((membership: any) => (
                <Link key={membership.groups.id} href="/groups" className="data-row flex items-center justify-between gap-3 p-3 transition hover:border-[var(--accent)]">
                  <span className="min-w-0 truncate font-black">{membership.groups.name}</span>
                  <span className="text-xs font-black text-[var(--accent-dark)]">{membership.role}</span>
                </Link>
              ))}
              {!(groupsResult.data ?? []).length ? (
                <div className="empty-state min-h-0">
                  <div>
                    <Shield className="mx-auto mb-2 text-[var(--accent-dark)]" size={24} />
                    <p className="text-sm">No groups yet</p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="surface p-3 sm:p-4">
            <div className="section-title mb-3">
              <h2>Invitations</h2>
              <Users size={20} />
            </div>
            <div className="grid gap-2">
              {(invitationsResult.data ?? []).map((invite: any) => (
                <div key={invite.id} className="rounded-lg bg-[#f4f6f2] p-3 text-sm">
                  <b>{invite.groups?.name}</b>
                  <div className="text-[var(--muted)]">Invited by {invite.inviter?.display_name}</div>
                </div>
              ))}
              {!(invitationsResult.data ?? []).length ? (
                <div className="empty-state min-h-0">
                  <div>
                    <UserPlus className="mx-auto mb-2 text-[var(--accent-dark)]" size={24} />
                    <p className="text-sm">No pending invites</p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
