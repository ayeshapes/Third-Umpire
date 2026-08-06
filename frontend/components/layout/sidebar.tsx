"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Shield,
  Swords,
  CalendarRange,
  MapPin,
  Trophy,
  Handshake,
  LineChart,
  Lightbulb,
  ArrowLeftRight,
  ChevronsLeft,
  ChevronsRight,
  X,
} from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/players", label: "Players", icon: Users },
  { href: "/players/compare", label: "Compare Players", icon: ArrowLeftRight },
  { href: "/teams", label: "Teams", icon: Shield },
  { href: "/matches", label: "Matches", icon: Swords },
  { href: "/seasons", label: "Seasons", icon: CalendarRange },
  { href: "/venues", label: "Venues", icon: MapPin },
  { href: "/records", label: "Records", icon: Trophy },
  { href: "/head-to-head", label: "Head-to-Head", icon: Handshake },
  { href: "/analytics", label: "Analytics", icon: LineChart },
  { href: "/insights", label: "Insights", icon: Lightbulb },
];

function NavLinks({
  pathname,
  collapsed,
  onNavigate,
}: {
  pathname: string | null;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <>
      {NAV.map((item) => {
        // "/players" would otherwise also match "/players/compare" via the
        // startsWith check below (both are under the same section) --
        // exclude that one nested route so only the more specific
        // "Compare Players" item highlights while on it.
        const active =
          pathname === item.href ||
          (pathname?.startsWith(item.href + "/") &&
            !(item.href === "/players" && pathname?.startsWith("/players/compare")));
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            title={collapsed ? item.label : undefined}
            onClick={onNavigate}
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
            {!collapsed && <span className="truncate">{item.label}</span>}
            {active && !collapsed && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-crimson-bright" />}
          </Link>
        );
      })}
    </>
  );
}

export function Sidebar({ showDesktopRail = true }: { showDesktopRail?: boolean } = {}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Mirrors the command palette's window-event pattern (see
  // openCommandPalette in components/shared/command-palette.tsx) so the
  // topbar's hamburger button can open this drawer without any shared
  // context/store.
  useEffect(() => {
    function onOpenRequest() {
      setMobileOpen(true);
    }
    window.addEventListener("open-mobile-nav", onOpenRequest);
    return () => window.removeEventListener("open-mobile-nav", onOpenRequest);
  }, []);

  // Close the drawer automatically on route change so navigating doesn't
  // leave it open behind the new page.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Desktop sidebar -- unchanged, hidden below md. Skipped entirely on
          pages (like the public homepage) that mount Sidebar only for its
          mobile drawer, via showDesktopRail={false}. */}
      {showDesktopRail && (
        <aside
          className={cn(
            "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-line bg-void/95 backdrop-blur-sm transition-all duration-300 md:flex",
            collapsed ? "w-[76px]" : "w-64"
          )}
        >
          <Link href="/" className="flex items-center gap-2.5 px-5 py-6">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-crimson font-display text-sm font-bold text-on-crimson">
              TU
            </span>
            {!collapsed && (
              <span className="font-display text-base font-semibold uppercase tracking-wide text-ivory">
                Third Umpire
              </span>
            )}
          </Link>

          <nav className="flex-1 space-y-1 px-3">
            <NavLinks pathname={pathname} collapsed={collapsed} />
          </nav>

          <button
            onClick={() => setCollapsed((c) => !c)}
            className="mx-3 mb-5 flex items-center justify-center gap-2 rounded-xl border border-line py-2 text-xs text-fg-muted transition-colors hover:border-line-strong hover:text-ivory"
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
            {!collapsed && "Collapse"}
          </button>
        </aside>
      )}

      {/* Mobile drawer -- only mounted below md, opened via the topbar's
          hamburger button dispatching "open-mobile-nav". */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            aria-label="Close menu"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 flex h-full w-72 max-w-[80vw] flex-col border-r border-line bg-void">
            <div className="flex items-center justify-between px-5 py-6">
              <Link href="/" className="flex items-center gap-2.5" onClick={() => setMobileOpen(false)}>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-crimson font-display text-sm font-bold text-on-crimson">
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
              <NavLinks pathname={pathname} collapsed={false} onNavigate={() => setMobileOpen(false)} />
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}

/** Call from anywhere (e.g. the topbar's hamburger button) to open the mobile nav drawer imperatively. */
export function openMobileNav() {
  window.dispatchEvent(new Event("open-mobile-nav"));
}
