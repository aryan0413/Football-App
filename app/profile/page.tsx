import { OnboardingForm } from "@/components/football/OnboardingForm";
import { getCurrentAppUser } from "@/lib/auth";
import { fallbackPhoto, optimizedPhotoUrl } from "@/lib/images";
import { getUserStats } from "@/lib/stats";
import { Shirt, Shield, Trophy } from "lucide-react";

export default async function ProfilePage() {
  const user = await getCurrentAppUser();
  if (!user) {
    return <div className="page-wrap grid min-h-[calc(100vh-40px)] content-start py-4 sm:content-center"><OnboardingForm /></div>;
  }
  const stats = await getUserStats(user.id);

  return (
    <div className="page-wrap">
      <section className="profile-hero-card p-4 sm:p-5">
        <div className="relative z-10 grid gap-4 lg:grid-cols-[auto_1fr_auto] lg:items-end">
          <img
            src={optimizedPhotoUrl(user.profile_image, 256) ?? fallbackPhoto()}
            alt=""
            loading="eager"
            decoding="async"
            className="h-28 w-28 rounded-lg border-2 border-white/42 object-cover shadow-2xl sm:h-32 sm:w-32"
          />
          <div className="min-w-0">
            <p className="text-sm font-black uppercase text-white/58">@{user.username}</p>
            <h1 className="mt-1 break-words text-4xl font-black leading-tight text-white sm:text-5xl">{user.display_name}</h1>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="position-chip"><Shirt size={14} /> {user.preferred_position}</span>
              <span className="position-chip"><Shield size={14} /> {user.secondary_position ?? "Flexible"}</span>
              <span className="position-chip"><Trophy size={14} /> {stats.matches} matches</span>
            </div>
          </div>
          <div className="scoreboard min-w-44 p-4 text-center">
            <p className="text-xs font-black uppercase text-white/50">Overall</p>
            <div className="mt-1 text-5xl font-black">{stats.averageRating.toFixed(1)}</div>
            <p className="text-xs font-bold text-white/50">player rating</p>
          </div>
        </div>
      </section>
      <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="stat-card"><div className="text-xs font-black uppercase tracking-wide text-[var(--muted)]">Matches</div><div className="mt-2 text-4xl font-black">{stats.matches}</div></div>
        <div className="stat-card"><div className="text-xs font-black uppercase tracking-wide text-[var(--muted)]">Goals + Assists</div><div className="mt-2 text-4xl font-black">{stats.goals + stats.assists}</div></div>
        <div className="stat-card"><div className="text-xs font-black uppercase tracking-wide text-[var(--muted)]">Win Rate</div><div className="mt-2 text-4xl font-black">{stats.matches ? ((stats.wins / stats.matches) * 100).toFixed(1) : "0"}%</div></div>
        <div className="stat-card"><div className="text-xs font-black uppercase tracking-wide text-[var(--muted)]">MOTM</div><div className="mt-2 text-4xl font-black">{stats.motm}</div></div>
      </section>
    </div>
  );
}
