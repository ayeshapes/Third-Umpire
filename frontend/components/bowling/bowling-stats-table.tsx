"use client";

/**
 * Ticket 8.1 -- Improved bowling statistics table / rankings.
 *
 * Sortable leaderboard, same wiring and interaction pattern as
 * components/batting/batting-stats-table.tsx: one useChartData call
 * scoped by the global filter bar, client-side sort over a
 * server-capped result set, horizontal scroll instead of reflowing
 * into cards. Lower-is-better columns (economy, average, strike
 * rate) default-sort ascending on first click since "best" for those
 * stats is the smallest number, unlike the batting table's runs-desc
 * default.
 */

import { useMemo, useState } from "react";
import { useChartData } from "@/hooks/use-chart-data";

export interface BowlingLeaderboardRow {
  bowler_id: number;
  bowler_name: string;
  team_code: string;
  matches: number;
  innings: number;
  overs: number;
  wickets: number;
  economy: number;
  average: number | null;
  strike_rate: number | null;
  best_figures: string; // e.g. "4/22"
  five_wicket_hauls: number;
  maidens: number;
}

type SortKey = Exclude<keyof BowlingLeaderboardRow, "bowler_id" | "bowler_name" | "team_code" | "best_figures">;

/** Columns where a *smaller* number is the better performance. */
const ASCENDING_BETTER: Partial<Record<SortKey, true>> = {
  economy: true,
  average: true,
  strike_rate: true,
};

interface ColumnDef {
  key: SortKey;
  label: string;
  format?: (row: BowlingLeaderboardRow) => string;
}

const COLUMNS: ColumnDef[] = [
  { key: "matches", label: "M" },
  { key: "innings", label: "Inn" },
  { key: "overs", label: "Ov" },
  { key: "wickets", label: "Wkts" },
  { key: "economy", label: "Econ", format: (r) => r.economy.toFixed(2) },
  { key: "average", label: "Avg", format: (r) => (r.average != null ? r.average.toFixed(2) : "--") },
  { key: "strike_rate", label: "SR", format: (r) => (r.strike_rate != null ? r.strike_rate.toFixed(1) : "--") },
  { key: "five_wicket_hauls", label: "5W" },
  { key: "maidens", label: "Mdns" },
];

export function BowlingStatsTable() {
  const { data, isLoading, isError, error, refetch, isFetching } = useChartData<BowlingLeaderboardRow[]>(
    "/api/analytics/bowling/leaderboard"
  );
  const [sortKey, setSortKey] = useState<SortKey>("wickets");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const rows = useMemo(() => {
    if (!data) return [];
    const sorted = [...data].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const an = av == null ? Infinity : av;
      const bn = bv == null ? Infinity : bv;
      return an === bn ? 0 : an < bn ? -1 : 1;
    });
    return sortDir === "desc" ? sorted.reverse() : sorted;
  }, [data, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      // "Best" defaults differently per column: for economy/average/SR
      // the best value is the smallest, so lead with ascending; for
      // everything else (wickets, overs, 5W, maidens) lead with the
      // biggest number first, same convention as the batting table.
      setSortDir(ASCENDING_BETTER[key] ? "asc" : "desc");
    }
  }

  return (
    <div className="rounded-2xl border border-line-strong bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-ivory">Bowling Rankings</h3>
        {isFetching && !isLoading && <span className="text-xs text-fg-faint">Updating…</span>}
      </div>

      {isLoading ? (
        <div role="status" aria-label="Loading bowling rankings" className="flex flex-col gap-2">
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
          <table className="w-full min-w-[680px] border-collapse text-sm">
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
                <th scope="col" className="py-2 pr-4 font-medium">
                  Best
                </th>
              </tr>
            </thead>
            <tbody className={isFetching ? "opacity-50 transition-opacity duration-150" : "opacity-100"}>
              {rows.map((row, i) => (
                <tr
                  key={row.bowler_id}
                  className={`border-b border-line-strong/60 transition-colors last:border-0 hover:bg-surface-2/40 ${i < 3 ? "text-ivory" : "text-fg-muted"}`}
                >
                  <td className="sticky left-0 whitespace-nowrap bg-surface py-2 pr-4 font-medium">
                    {i < 3 && <span className="mr-1.5 text-crimson-bright">#{i + 1}</span>}
                    {row.bowler_name}
                    <span className="ml-1.5 text-xs text-fg-faint">{row.team_code}</span>
                  </td>
                  {COLUMNS.map((col) => (
                    <td key={col.key} className="py-2 pr-4 tabular-nums">
                      {col.format ? col.format(row) : row[col.key]}
                    </td>
                  ))}
                  <td className="py-2 pr-4 tabular-nums">{row.best_figures}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
