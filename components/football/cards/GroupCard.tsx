import { fallbackPhoto, optimizedPhotoUrl } from "@/lib/images";
import { CalendarClock, ChevronRight, ShieldCheck, Trophy, Users } from "lucide-react";
import Link from "next/link";

type GroupCardProps = {
  group: {
    id: string;
    name: string;
    logo: string | null;
    description: string | null;
  };
  role: string;
  memberCount?: number;
  nextMatch?: {
    scheduled_date: string;
    match_time: string;
    location: string;
    status: string;
  } | null;
};

export function GroupCard({ group, role, memberCount = 0, nextMatch }: GroupCardProps) {
  return (
    <article className="group-card surface overflow-hidden transition">
      <div className="group-card-lightbar" />
      <div className="group-card-body grid gap-3 p-3 sm:p-4">
        <div className="group-card-header">
          <div className="group-crest-shell">
            <img src={optimizedPhotoUrl(group.logo, 132) ?? fallbackPhoto()} alt="" loading="lazy" decoding="async" className="group-crest-image" />
          </div>
          <div className="min-w-0">
            <p className="eyebrow">Private club</p>
            <h2 className="truncate text-2xl font-black">{group.name}</h2>
            <p className="line-clamp-2 text-sm text-[var(--muted)]">{group.description ?? "Private football group"}</p>
          </div>
          <span className="group-role-badge">{role}</span>
        </div>

        <div className="group-card-metrics">
          <div className="club-metric">
            <Users className="text-[var(--accent-dark)]" size={18} />
            <div className="mt-2 text-xs font-bold text-[var(--muted)]">Players</div>
            <div className="font-black">{memberCount}</div>
          </div>
          <div className="club-metric">
            <CalendarClock className="text-[var(--accent-dark)]" size={18} />
            <div className="mt-2 text-xs font-bold text-[var(--muted)]">Next Match</div>
            <div className="truncate font-black">{nextMatch ? nextMatch.scheduled_date : "-"}</div>
          </div>
          <div className="club-metric">
            <Trophy className="text-[var(--accent-dark)]" size={18} />
            <div className="mt-2 text-xs font-bold text-[var(--muted)]">Leaders</div>
            <div className="font-black">After matches</div>
          </div>
        </div>

        {nextMatch ? (
          <div className="fixture-ribbon text-sm">
            <div className="font-black">{nextMatch.match_time} - {nextMatch.location}</div>
            <div className="text-[var(--muted)]">{nextMatch.status}</div>
          </div>
        ) : null}

        <div className="group-card-actions grid gap-2 sm:grid-cols-2">
          <Link className="btn-dark" href={`/groups/${group.id}`}>
            <ShieldCheck size={18} />
            Open Group
          </Link>
          <Link className="btn-secondary" href={`/groups/${group.id}?panel=schedule`}>
            Schedule Match
            <ChevronRight size={18} />
          </Link>
        </div>
      </div>
    </article>
  );
}
