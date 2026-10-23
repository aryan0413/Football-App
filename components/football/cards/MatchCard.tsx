import { ArrowUpRight, Clock, MapPin, Users } from "lucide-react";
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
  const date = new Date(`${match.scheduled_date}T12:00:00`);
  const validDate = !Number.isNaN(date.getTime());
  const href = auction ? `/auction?matchId=${match.id}` : `/match/${match.id}`;

  return (
    <article className="fixture-card">
      <div className="fixture-date">
        <strong>{validDate ? date.getDate() : "--"}</strong>
        <span>{validDate ? date.toLocaleDateString("en-GB", { month: "short" }) : "TBC"}</span>
      </div>
      <div className="min-w-0">
        <div className="fixture-title">
          <h3>{match.groups?.name ?? "Football group"}</h3>
          <span
            className={`status-chip ${live ? "status-chip-live" : match.status === "ENDED" ? "status-chip-muted" : ""}`}
          >
            {live
              ? "LIVE"
              : match.status === "SCHEDULED"
                ? "Upcoming"
                : match.status === "ENDED"
                  ? "Full time"
                  : "Auction"}
          </span>
        </div>
        <div className="fixture-meta">
          <span>
            <Clock size={12} />
            {match.match_time.slice(0, 5)}
          </span>
          <span>
            <MapPin size={12} />
            {match.location}
          </span>
          <span>
            <Users size={12} />
            {inCount}/{match.maximum_players}
          </span>
        </div>
      </div>
      <Link href={href} className="fixture-action">
        {auction ? "Rejoin auction" : live ? "Watch live" : match.status === "ENDED" ? "Match report" : "View match"}
        <ArrowUpRight />
      </Link>
    </article>
  );
}
