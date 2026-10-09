"use client";

import { BarChart3, Gavel, Home, Shield, Trophy, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Home", icon: Home },
  { href: "/groups", label: "Group", icon: Shield },
  { href: "/match", label: "Match", icon: Trophy },
  { href: "/auction", label: "Auction", icon: Gavel },
  { href: "/stats", label: "Stats", icon: BarChart3 },
  { href: "/profile", label: "Profile", icon: UserRound }
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <>
      <aside className="app-nav-panel fixed left-0 top-0 z-30 hidden h-screen w-[248px] px-4 py-5 text-white lg:block">
        <Link href="/" className="nav-brand mb-6 flex items-center gap-3 rounded-lg p-1">
          <span className="brand-mark">FC</span>
          <span className="min-w-0">
            <span className="block text-lg font-black leading-tight">Football Groups</span>
            <span className="text-sm font-bold text-white/54">Matchday command center</span>
          </span>
        </Link>
        <nav className="grid gap-1.5">
          {items.map((item) => {
            const Icon = item.icon;
            const active = item.href === "/" ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link ${active ? "nav-link-active" : ""}`}
              >
                <Icon size={20} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <nav className="mobile-nav fixed bottom-0 left-0 right-0 z-40 grid grid-cols-6 px-1 pb-2 pt-1.5 text-white lg:hidden">
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.href === "/" ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`grid min-h-12 place-items-center rounded-lg text-[10px] font-black ${
                active ? "bg-white text-[var(--navy)] shadow-lg" : "text-white/60"
              }`}
            >
              <Icon size={22} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
