"use client";

/**
 * Ticket 7.1 -- Improved batting statistics table / rankings.
 *
 * Sortable leaderboard scoped by the global filter bar (same
 * useChartData wiring as everything else on this page). Sorting is
 * client-side over whatever page of rows the endpoint returns --
 * cheap because these leaderboards are already capped server-side,
 * same pattern as the /api/filters/matches cap in the filter router.
 *
 * Responsive: the table scrolls horizontally on narrow screens
 * (`overflow-x-auto` wrapper) rather than trying to reflow a
 * multi-column stats table into a card layout, which would make the
 * numbers harder to compare against each other -- horizontal scan is
 * how these tables are read even on desktop.
 */

import { useMemo, useState } from "react";
import { useChartData } from "@/hooks/use-chart-data";

export interface BattingLeaderboardRow {
  player_id: number;
  player_name: string;
  team_code: string;
  matches: number;
  innings: number;
  runs: number;
  average: number | null;
  strike_rate: number;
  highest_score: number;
  not_outs: number;
  hundreds: number;
  fifties: number;
  fours: number;
  sixes: number;
}

type SortKey = Exclude<keyof BattingLeaderboardRow, "player_id" | "player_name" | "team_code">;

interface ColumnDef {
  key: SortKey;
  label: string;
  format?: (row: BattingLeaderboardRow) => string;
}

const COLUMNS: ColumnDef[] = [
  { key: "matches", label: "M" },
  { key: "innings", label: "Inn" },
  { key: "runs", label: "Runs" },
  { key: "average", label: "Avg", format: (r) => (r.average != null ? r.average.toFixed(2) : "--") },
  { key: "strike_rate", label: "SR", format: (r) => r.strike_rate.toFixed(1) },
  { key: "highest_score", label: "HS" },
  { key: "hundreds", label: "100s" },
  { key: "fifties", label: "50s" },
  { key: "fours", label: "4s" },
  { key: "sixes", label: "6s" },
];

export function BattingStatsTable() {
  const { data, isLoading, isError, error, refetch, isFetching } = useChartData<BattingLeaderboardRow[]>(
    "/api/analytics/batting/leaderboard"
  );
  const [sortKey, setSortKey] = useState<SortKey>("runs");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const rows = useMemo(() => {
    if (!data) return [];
    const sorted = [...data].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const an = av == null ? -Infinity : av;
      const bn = bv == null ? -Infinity : bv;
      return an === bn ? 0 : an < bn ? -1 : 1;
    });
    return sortDir === "desc" ? sorted.reverse() : sorted;
  }, [data, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  return (
    <div className="rounded-2xl border border-line-strong bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-ivory">Batting Rankings</h3>
        {isFetching && !isLoading && <span className="text-xs text-fg-faint">Updating…</span>}
      </div>

      {isLoading ? (
        <div role="status" aria-label="Loading batting rankings" className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-9 w-full animate-pulse rounded-lg bg-surface-2" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex h-32 flex-col items-center justify-center gap-2 text-xs text-crimson-bright">
          <span className="text-center">{error instanceof Error ? error.message : "Failed to load rankings"}</span>
          <button type="button" onClick={() => refetch()} className="font-medium underline underline-offset-2">
            Retry
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-xs text-fg-faint">No data for the current filters</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line-strong bg-surface-2/50 text-left text-xs uppercase tracking-widest text-fg-faint">
                <th scope="col" className="sticky left-0 bg-[var(--color-surface-2)]/50 py-2.5 pr-4 font-semibold">
                  Player
                </th>
                {COLUMNS.map((col) => (
                  <th key={col.key} scope="col" className="py-2 pr-4 font-medium">
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className="flex items-center gap-1 whitespace-nowrap hover:text-ivory"
                      aria-label={`Sort by ${col.label}`}
                    >
                      {col.label}
                      {sortKey === col.key && <span aria-hidden="true">{sortDir === "desc" ? "▾" : "▴"}</span>}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className={isFetching ? "opacity-50 transition-opacity duration-150" : "opacity-100"}>
              {rows.map((row, i) => (
                <tr
                  key={row.player_id}
                  className={`border-b border-line-strong/60 transition-colors last:border-0 hover:bg-surface-2/40 ${i < 3 ? "text-ivory" : "text-fg-muted"}`}
                >
                  <td className="sticky left-0 whitespace-nowrap bg-surface py-2 pr-4 font-medium">
                    {i < 3 && <span className="mr-1.5 text-crimson-bright">#{i + 1}</span>}
                    {row.player_name}
                    <span className="ml-1.5 text-xs text-fg-faint">{row.team_code}</span>
                  </td>
                  {COLUMNS.map((col) => (
                    <td key={col.key} className="py-2 pr-4 tabular-nums">
                      {col.format ? col.format(row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
