"use client";

/**
 * Team Comparison Studio: Batting Comparison.
 *
 * Same table shape as components/players/career-stats-comparison.tsx
 * (one row per stat, both sides' values, leading value picked out in
 * crimson using the same `higherIsBetter` convention) but scoped to
 * BATTING_COMPARISON_METRICS/TeamBattingStats only -- kept as its own
 * section+endpoint rather than folded into a combined table because
 * the brief calls out Batting and Bowling as separate comparisons.
 */

import { useTeamComparison } from "@/hooks/use-team-comparison";
import { BATTING_COMPARISON_METRICS, type TeamBattingComparisonData } from "./types";

function leader(higherIsBetter: boolean, a: number | string | null, b: number | string | null): "a" | "b" | null {
  if (typeof a !== "number" || typeof b !== "number" || a === b) return null;
  const aWins = higherIsBetter ? a > b : a < b;
  return aWins ? "a" : "b";
}

export interface BattingComparisonProps {
  path: string;
  teamAId: number | null;
  teamBId: number | null;
}

export function BattingComparison({ path, teamAId, teamBId }: BattingComparisonProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = useTeamComparison<TeamBattingComparisonData>(
    path,
    teamAId,
    teamBId
  );

  if (teamAId === null || teamBId === null) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-line-strong bg-surface px-6 py-12 text-center text-xs text-fg-faint">
        Pick two teams above to compare batting.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line-strong bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-ivory">Batting Comparison</h3>
        {isFetching && !isLoading && <span className="text-xs text-fg-faint">Updating…</span>}
      </div>

      {isLoading ? (
        <div role="status" aria-label="Loading batting comparison" className="flex flex-col gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-8 w-full animate-pulse rounded bg-surface-2" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 text-xs text-crimson-bright">
          <span className="text-center">{error instanceof Error ? error.message : "Failed to load batting comparison"}</span>
          <button type="button" onClick={() => refetch()} className="font-medium underline underline-offset-2">
            Retry
          </button>
        </div>
      ) : !data ? (
        <div className="flex h-40 items-center justify-center text-xs text-fg-faint">No batting data for these teams</div>
      ) : (
        <div className={`transition-opacity duration-150 ${isFetching ? "opacity-50" : "opacity-100"}`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line-strong text-left text-xs uppercase tracking-widest text-fg-faint">
                  <th scope="col" className="sticky left-0 bg-surface py-2 pr-4 font-medium">
                    Stat
                  </th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">
                    <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-crimson-bright" />
                    {data.team_a.team_code}
                  </th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">
                    <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-fg-muted" />
                    {data.team_b.team_code}
                  </th>
                </tr>
              </thead>
              <tbody>
                {BATTING_COMPARISON_METRICS.map((metric) => {
                  const aValue = data.team_a.stats[metric.key];
                  const bValue = data.team_b.stats[metric.key];
                  const lead = leader(metric.higherIsBetter, aValue, bValue);
                  return (
                    <tr key={String(metric.key)} className="border-b border-line-strong/60 last:border-0">
                      <td className="sticky left-0 whitespace-nowrap bg-surface py-2 pr-4 text-fg-muted">{metric.label}</td>
                      <td
                        className={`py-2 pr-4 text-right tabular-nums ${
                          lead === "a" ? "font-semibold text-crimson-bright" : "text-fg-muted"
                        }`}
                      >
                        {metric.format(aValue)}
                      </td>
                      <td
                        className={`py-2 pr-4 text-right tabular-nums ${
                          lead === "b" ? "font-semibold text-ivory" : "text-fg-muted"
                        }`}
                      >
                        {metric.format(bValue)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
