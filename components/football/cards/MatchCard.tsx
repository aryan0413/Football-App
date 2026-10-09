import { CalendarClock, ChevronRight, Clock, MapPin, Radio, Users } from "lucide-react";
import Link from "next/link";

type MatchCardProps = {
  match: {
    id: string;
    scheduled_date: string;
    match_time: string;
    location: string;
    maximum_players: number;
    status: string;
    groups?: { name: string } | null;
    match_availability?: Array<{ status: string }>;
  };
};

export function MatchCard({ match }: MatchCardProps) {
  const inCount = (match.match_availability ?? []).filter((item) => item.status === "PLAYING").length;
  const live = match.status === "LIVE";
  const auction = match.status === "AUCTION";
  const actionHref = auction ? `/auction?matchId=${match.id}` : `/match/${match.id}`;
  const actionLabel = auction ? "Join Back Auction" : live ? "Live Match" : "View Match";

  return (
    <article className="data-row grid gap-2.5 p-3 transition hover:border-[var(--accent)] hover:shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-base font-black sm:text-lg">{match.groups?.name ?? "Football group"}</div>
          <div className="mt-1 flex flex-wrap gap-3 text-xs font-bold text-[var(--muted)]">
            <span className="flex items-center gap-1"><CalendarClock size={14} /> {match.scheduled_date}</span>
            <span className="flex items-center gap-1"><Clock size={14} /> {match.match_time}</span>
            <span className="flex items-center gap-1"><MapPin size={14} /> {match.location}</span>
          </div>
        </div>
        <span className={`shrink-0 rounded-lg px-2 py-1 text-xs font-black ${live ? "bg-red-600 text-white" : "bg-[#e8f5ef] text-[var(--accent-dark)]"}`}>
          {live ? <span className="inline-flex items-center gap-1"><Radio size={12} /> LIVE</span> : match.status}
        </span>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="flex items-center gap-2 text-sm font-bold text-[var(--muted)]"><Users size={16} /> {inCount}/{match.maximum_players} IN</span>
        <Link className="btn-secondary min-h-10 px-3 sm:w-fit" href={actionHref}>
          {actionLabel}
          <ChevronRight size={16} />
        </Link>
      </div>
    </article>
  );
}
