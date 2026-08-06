"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LayoutDashboard, LineChart, Menu, Shield, Trophy, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const NAV_LINKS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/players", label: "Players", icon: Users },
  { href: "/teams", label: "Teams", icon: Shield },
  { href: "/records", label: "Records", icon: Trophy },
  { href: "/analytics", label: "Analytics", icon: LineChart },
];

export function PublicNavbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-void/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-crimson font-display text-sm font-bold text-on-crimson">
            TU
          </span>
          <span className="font-display text-base font-semibold uppercase tracking-wide">Third Umpire</span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm text-fg-muted md:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="transition-colors hover:text-ivory">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/players">
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex">View Players</Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="primary" size="sm">Explore Analytics</Button>
          </Link>
          <button
            onClick={() => setMobileOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-line text-fg-muted transition-colors hover:border-line-strong hover:text-ivory md:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-4 w-4" />
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            aria-label="Close menu"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 flex h-full w-72 max-w-[80vw] flex-col border-r border-line bg-void">
            <div className="flex items-center justify-between px-5 py-6">
              <Link href="/" className="flex items-center gap-2.5" onClick={() => setMobileOpen(false)}>
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-crimson font-display text-sm font-bold text-on-crimson">
                  TU
                </span>
                <span className="font-display text-base font-semibold uppercase tracking-wide text-ivory">
                  Third Umpire
                </span>
              </Link>
              <button
                aria-label="Close menu"
                onClick={() => setMobileOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-muted hover:bg-surface-2 hover:text-ivory"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-5">
              {NAV_LINKS.map((link) => {
                const active = pathname === link.href || pathname?.startsWith(link.href + "/");
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-crimson/15 text-ivory"
                        : "text-fg-muted hover:bg-surface-2 hover:text-ivory"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-[18px] w-[18px] shrink-0",
                        active ? "text-crimson-bright" : "text-fg-muted group-hover:text-ivory"
                      )}
                    />
                    <span className="truncate">{link.label}</span>
                    {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-crimson-bright" />}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
