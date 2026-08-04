"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import type { OrangeCapEntry, PurpleCapEntry } from "@/types/api";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

function PlayerRow({
  rank,
  name,
  primaryValue,
  primaryLabel,
  secondaryValue,
  href,
}: {
  rank: number;
  name: string;
  primaryValue: string;
  primaryLabel: string;
  secondaryValue: string;
  href: string;
}) {
  return (
    <Link href={href} className="group flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface-2">
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold scoreboard-digits",
          rank === 1 ? "bg-amber/15 text-amber" : "bg-surface-2 text-fg-faint"
        )}
      >
        {rank}
      </span>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold text-fg-muted transition-colors group-hover:text-crimson-bright">
        {initials(name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ivory">{name}</span>
        <span className="block text-[11px] text-fg-faint">{secondaryValue}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className="scoreboard-digits block text-sm font-semibold text-ivory">{primaryValue}</span>
        <span className="block text-[10px] uppercase tracking-wide text-fg-faint">{primaryLabel}</span>
      </span>
    </Link>
  );
}

export function TrendingPlayers({
  batters,
  bowlers,
}: {
  batters: OrangeCapEntry[];
  bowlers: PurpleCapEntry[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4 }}>
        <Card>
          <CardHeader>
            <CardTitle>Trending Batters</CardTitle>
          </CardHeader>
          <CardContent>
            {batters.length === 0 ? (
              <EmptyState compact title="No batting data yet" />
            ) : (
              <div className="space-y-0.5">
                {batters.slice(0, 5).map((p, i) => (
                  <PlayerRow
                    key={p.player_id}
                    rank={i + 1}
                    name={p.display_name ?? p.full_name}
                    primaryValue={String(p.total_runs)}
                    primaryLabel="runs"
                    secondaryValue={`SR ${p.strike_rate ?? "—"} · Avg ${p.average ?? "—"}`}
                    href={`/players/${p.player_id}`}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, delay: 0.08 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Trending Bowlers</CardTitle>
          </CardHeader>
          <CardContent>
            {bowlers.length === 0 ? (
              <EmptyState compact title="No bowling data yet" />
            ) : (
              <div className="space-y-0.5">
                {bowlers.slice(0, 5).map((p, i) => (
                  <PlayerRow
                    key={p.player_id}
                    rank={i + 1}
                    name={p.display_name ?? p.full_name}
                    primaryValue={String(p.total_wickets)}
                    primaryLabel="wkts"
                    secondaryValue={`Econ ${p.economy ?? "—"} · Avg ${p.average ?? "—"}`}
                    href={`/players/${p.player_id}`}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
