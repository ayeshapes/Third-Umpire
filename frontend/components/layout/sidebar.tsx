"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
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
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/players", label: "Players", icon: Users },
  { href: "/teams", label: "Teams", icon: Shield },
  { href: "/matches", label: "Matches", icon: Swords },
  { href: "/seasons", label: "Seasons", icon: CalendarRange },
  { href: "/venues", label: "Venues", icon: MapPin },
  { href: "/records", label: "Records", icon: Trophy },
  { href: "/head-to-head", label: "Head-to-Head", icon: Handshake },
  { href: "/analytics", label: "Analytics", icon: LineChart },
  { href: "/insights", label: "Insights", icon: Lightbulb },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-line bg-void/95 backdrop-blur-sm transition-all duration-300 md:flex",
        collapsed ? "w-[76px]" : "w-64"
      )}
    >
      <Link href="/" className="flex items-center gap-2.5 px-5 py-6">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-crimson font-display text-sm font-bold text-ivory">
          TU
        </span>
        {!collapsed && (
          <span className="font-display text-base font-semibold uppercase tracking-wide text-ivory">
            Third Umpire
          </span>
        )}
      </Link>

      <nav className="flex-1 space-y-1 px-3">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
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
      </nav>

      <button
        onClick={() => setCollapsed((c) => !c)}
        className="mx-3 mb-5 flex items-center justify-center gap-2 rounded-xl border border-line py-2 text-xs text-fg-muted transition-colors hover:border-line-strong hover:text-ivory"
      >
        {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
        {!collapsed && "Collapse"}
      </button>
    </aside>
  );
}
