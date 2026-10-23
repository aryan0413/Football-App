"use client";

import {
  ArrowUpRight,
  BarChart3,
  ChevronRight,
  Gavel,
  LayoutDashboard,
  Plus,
  Shield,
  Trophy,
  UserRound
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthActions } from "@/components/football/AuthActions";

const items = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/match", label: "My Matches", mobile: "Matches", icon: Trophy },
  { href: "/auction", label: "Auctions", icon: Gavel },
  { href: "/groups", label: "My Groups", mobile: "Groups", icon: Shield },
  { href: "/stats", label: "Performance", mobile: "Stats", icon: BarChart3 },
  { href: "/profile", label: "Player Profile", mobile: "Profile", icon: UserRound }
];

export function Navigation() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === href : pathname.startsWith(href));
  const current = items.find((item) => isActive(item.href));

  return (
    <>
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-[var(--accent)] focus:p-3 focus:text-black"
        href="#main-content"
      >
        Skip to content
      </a>
      <aside className="app-nav-panel">
        <Link href="/" className="nav-brand" aria-label="Football Groups home">
          <span className="brand-mark">
            <Shield size={23} strokeWidth={2.2} />
          </span>
          <span>
            <span className="brand-name">Football</span>
            <span className="brand-subtitle">GROUPS</span>
          </span>
        </Link>
        <p className="nav-caption">Workspace</p>
        <nav aria-label="Main navigation">
          {items.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className={`nav-link ${isActive(href) ? "nav-link-active" : ""}`}
            >
              <Icon size={18} />
              <span>{label}</span>
              {isActive(href) ? <span className="nav-active-dot" /> : null}
            </Link>
          ))}
        </nav>
        <div className="nav-footer">
          <Link href="/profile">
            <span className="nav-footer-icon">
              <UserRound size={16} />
            </span>
            <span>My account</span>
            <ArrowUpRight size={14} className="ml-auto" />
          </Link>
        </div>
      </aside>
      <div className="workspace-bar">
        <div className="workspace-breadcrumb">
          <Shield size={14} />
          <span>Workspace</span>
          <ChevronRight size={12} />
          <strong>{current?.label ?? "Football Groups"}</strong>
        </div>
        <Link className="mobile-brand" href="/">
          <Shield size={20} />
          <span>
            Football<span className="hidden sm:inline"> Groups</span>
          </span>
        </Link>
        <div className="workspace-actions">
          <Link className="btn-secondary" href="/match?create=1" title="Create a match">
            <Plus size={15} />
            <span>New match</span>
          </Link>
          <AuthActions />
        </div>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {items.map(({ href, label, mobile, icon: Icon }) => (
          <Link key={href} href={href} className="mobile-nav-link" aria-current={isActive(href) ? "page" : undefined}>
            <Icon size={19} />
            <span>{mobile ?? label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
