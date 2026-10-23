import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  Gavel,
  Plus,
  Shield,
  Trophy,
  UserPlus,
  Users
} from "lucide-react";
import { StatGrid } from "@/components/football/StatGrid";
import { MatchCard } from "@/components/football/cards/MatchCard";
import { fallbackPhoto, optimizedPhotoUrl } from "@/lib/images";
import type { UserStats } from "@/lib/types";

type DashboardProps = {
  user?: { display_name: string; username: string; profile_image: string | null; preferred_position: string };
  stats: UserStats;
  memberships: Array<{ role: string; groups: { id: string; name: string; logo: string | null } }>;
  matches: Array<Parameters<typeof MatchCard>[0]["match"]>;
  invitations: Array<{ id: string; groups?: { name: string } | null; inviter?: { display_name: string } | null }>;
};

export function MatchdayDashboard({ user, stats, memberships, matches, invitations }: DashboardProps) {
  const featured = matches.find((match) => match.status === "LIVE") ?? matches[0];
  const date = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Kolkata"
  }).format(new Date());

  return (
    <div className="page-wrap">
      <header>
        <div className="dashboard-heading">
          {user ? (
            <img src={optimizedPhotoUrl(user.profile_image, 80) ?? fallbackPhoto()} alt="" width={40} height={40} />
          ) : null}
          <div>
            <h1>Matchday</h1>
            <p>{user ? `${user.display_name} / ${date}` : date}</p>
          </div>
        </div>
        <Link className="btn-primary" href={user ? "/match?create=1" : "/sign-in"}>
          <Plus size={15} /> Create match
        </Link>
      </header>

      {user ? <StatGrid stats={stats} /> : null}

      <div className="dashboard-grid">
        <div className="dashboard-main">
          <section className="matchday-banner" aria-label="Matchday spotlight">
            <Image
              src="/stadium.webp"
              alt="Football stadium and pitch under the floodlights"
              fill
              sizes="(max-width: 767px) 100vw, (max-width: 1023px) 65vw, 70vw"
              preload
            />
            <div className="banner-content">
              <span className="banner-kicker">
                <Trophy size={13} />{" "}
                {featured ? (featured.status === "LIVE" ? "Live match" : "Next kickoff") : "Football Groups"}
              </span>
              <h2>
                {featured ? (
                  (featured.groups?.name ?? "Matchday")
                ) : user ? (
                  <>
                    Ready for your
                    <br />
                    next kickoff?
                  </>
                ) : (
                  <>
                    Football.
                    <br />
                    Your way.
                  </>
                )}
              </h2>
              <p>
                {featured
                  ? `${featured.scheduled_date} / ${featured.match_time.slice(0, 5)} / ${featured.location}`
                  : user
                    ? "Your next fixture is waiting to be scheduled."
                    : "The home of your football group."}
              </p>
              <Link
                className="btn-primary"
                href={featured ? `/match/${featured.id}` : user ? "/match?create=1" : "/sign-in"}
              >
                {featured
                  ? featured.status === "LIVE"
                    ? "Join live match"
                    : "View fixture"
                  : user
                    ? "Schedule a match"
                    : "Sign in"}
                <ArrowUpRight size={15} />
              </Link>
            </div>
          </section>

          <section className="dashboard-section">
            <div className="section-title">
              <h2>
                My matches <span className="section-count">{matches.length}</span>
              </h2>
              <Link className="section-link" href="/match">
                All matches <ArrowRight size={13} />
              </Link>
            </div>
            <div className="dashboard-fixtures">
              {matches.map((match) => (
                <MatchCard key={match.id} match={match} />
              ))}
              {!matches.length ? (
                <div className="dashboard-empty">
                  <CalendarDays size={24} />
                  <div>
                    <h3>{user ? "No upcoming fixtures" : "Your next matchday"}</h3>
                    <p className="mt-2">{user ? "No matches scheduled." : "Sign in to see your matches."}</p>
                  </div>
                  <Link className="section-link" href={user ? "/match?create=1" : "/sign-in"}>
                    {user ? "Schedule match" : "Sign in"}
                    <ArrowRight size={13} />
                  </Link>
                </div>
              ) : null}
            </div>
          </section>

          <section className="dashboard-section">
            <div className="section-title">
              <h2>Quick access</h2>
              <ArrowUpRight size={16} />
            </div>
            <div className="dashboard-actions">
              <Link className="quick-action" href="/groups">
                <span className="quick-action-icon">
                  <Shield size={19} />
                </span>
                <span>
                  <strong>My groups</strong>
                  <small>
                    {memberships.length} {memberships.length === 1 ? "group" : "groups"}
                  </small>
                </span>
                <ChevronRight />
              </Link>
              <Link className="quick-action" href="/auction">
                <span className="quick-action-icon">
                  <Gavel size={19} />
                </span>
                <span>
                  <strong>Auction room</strong>
                  <small>Build your squad</small>
                </span>
                <ChevronRight />
              </Link>
              <Link className="quick-action" href="/stats">
                <span className="quick-action-icon">
                  <Trophy size={19} />
                </span>
                <span>
                  <strong>Performance</strong>
                  <small>Your season so far</small>
                </span>
                <ChevronRight />
              </Link>
            </div>
          </section>
        </div>

        <aside className="dashboard-aside">
          <section className="performance-summary">
            <div className="section-title">
              <h2>My performance</h2>
              <Trophy size={16} />
            </div>
            <div className="performance-rating">
              <strong>{user ? stats.averageRating.toFixed(1) : "--"}</strong>
              <span>/ 10 average rating</span>
            </div>
            <div className="performance-numbers">
              <div>
                <b>{user ? stats.matches : "--"}</b>
                <span>Matches</span>
              </div>
              <div>
                <b>{user ? stats.goals : "--"}</b>
                <span>Goals</span>
              </div>
              <div>
                <b>{user ? stats.assists : "--"}</b>
                <span>Assists</span>
              </div>
            </div>
            <Link href="/stats" className="section-link">
              View all stats
              <ArrowUpRight size={13} />
            </Link>
          </section>
          <section className="dashboard-section">
            <div className="section-title">
              <h2>
                My groups <span className="section-count">{memberships.length}</span>
              </h2>
              <Link className="section-link" href="/groups" aria-label="View groups">
                <Plus size={16} />
              </Link>
            </div>
            {memberships.map(({ groups: group, role }) => (
              <Link key={group.id} href={`/groups/${group.id}`} className="dashboard-group">
                <img
                  src={optimizedPhotoUrl(group.logo, 72) ?? fallbackPhoto()}
                  width={36}
                  height={36}
                  alt=""
                  loading="lazy"
                />
                <div className="min-w-0">
                  <strong className="truncate">{group.name}</strong>
                  <small>{role.toLowerCase()}</small>
                </div>
                <ChevronRight />
              </Link>
            ))}
            {!memberships.length ? (
              <div className="empty-state">
                <div>
                  <Users size={22} className="mx-auto mb-3" />
                  <p>No groups yet</p>
                  <Link href="/groups" className="section-link mt-3">
                    Find your group <ArrowRight size={12} />
                  </Link>
                </div>
              </div>
            ) : null}
          </section>
          <section className="dashboard-section">
            <div className="section-title">
              <h2>Invitations</h2>
              <UserPlus size={16} />
            </div>
            {invitations.map((invite) => (
              <Link key={invite.id} href="/groups" className="dashboard-group">
                <span className="quick-action-icon">
                  <Shield size={16} />
                </span>
                <div className="min-w-0">
                  <strong className="truncate">{invite.groups?.name}</strong>
                  <small>From {invite.inviter?.display_name}</small>
                </div>
                <ChevronRight />
              </Link>
            ))}
            {!invitations.length ? (
              <p className="py-3 text-xs text-[var(--muted)]">You&apos;re all caught up.</p>
            ) : null}
          </section>
        </aside>
      </div>
      <footer className="dashboard-footer">
        <span>
          <Shield size={12} /> Football Groups
        </span>
        <span>{user ? `@${user.username}` : "Matchday workspace"}</span>
      </footer>
    </div>
  );
}
