"use client";

/**
 * Ticket 12.1 -- Career Statistics comparison.
 *
 * One row per stat (batting/bowling/fielding, grouped) with both
 * players' values side by side and the leading value picked out in
 * crimson -- a table reads this comparison more directly than two
 * separate StatCard grids would, since the point is "how do these
 * two numbers relate," not "what is this one number." The lead
 * highlight reuses the same `higherIsBetter` flag the insights engine
 * (lib/player-insights.ts) uses, so the table and the prose summary
 * below it never disagree about who's ahead on a given stat.
 */

import { Fragment } from "react";
import { usePlayerComparison } from "@/hooks/use-player-comparison";
import { COMPARISON_METRICS, type PlayerCareerComparisonData, type ComparisonMetric } from "./types";

const GROUP_LABELS: Record<ComparisonMetric["group"], string> = {
  batting: "Batting",
  bowling: "Bowling",
  fielding: "Fielding",
};

function leader(metric: ComparisonMetric, a: number | string | null, b: number | string | null): "a" | "b" | null {
  if (typeof a !== "number" || typeof b !== "number" || a === b) return null;
  const aWins = metric.higherIsBetter ? a > b : a < b;
  return aWins ? "a" : "b";
}

export interface CareerStatsComparisonProps {
  path: string;
  playerAId: number | null;
  playerBId: number | null;
}

export function CareerStatsComparison({ path, playerAId, playerBId }: CareerStatsComparisonProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = usePlayerComparison<PlayerCareerComparisonData>(
    path,
    playerAId,
    playerBId
  );

  if (playerAId === null || playerBId === null) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-line-strong bg-surface px-6 py-12 text-center text-xs text-fg-faint">
        Pick two players above to compare career statistics.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line-strong bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-ivory">Career Statistics</h3>
        {isFetching && !isLoading && <span className="text-xs text-fg-faint">Updating…</span>}
      </div>

      {isLoading ? (
        <div role="status" aria-label="Loading career statistics" className="flex flex-col gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-8 w-full animate-pulse rounded bg-surface-2" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 text-xs text-crimson-bright">
          <span className="text-center">{error instanceof Error ? error.message : "Failed to load career statistics"}</span>
          <button type="button" onClick={() => refetch()} className="font-medium underline underline-offset-2">
            Retry
          </button>
        </div>
      ) : !data ? (
        <div className="flex h-40 items-center justify-center text-xs text-fg-faint">No career data for these players</div>
      ) : (
        <div className={`transition-opacity duration-150 ${isFetching ? "opacity-50" : "opacity-100"}`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line-strong text-left text-xs uppercase tracking-widest text-fg-faint">
                  <th scope="col" className="sticky left-0 bg-surface py-2 pr-4 font-medium">
                    Stat
                  </th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">
                    <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-crimson-bright" />
                    {data.player_a.display_name ?? data.player_a.full_name}
                  </th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">
                    <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-fg-muted" />
                    {data.player_b.display_name ?? data.player_b.full_name}
                  </th>
                </tr>
              </thead>
              <tbody>
                {(["batting", "bowling", "fielding"] as const).map((group) => (
                  <Fragment key={group}>
                    <tr>
                      <td colSpan={3} className="pb-1 pt-4 text-xs font-medium uppercase tracking-widest text-fg-faint first:pt-2">
                        {GROUP_LABELS[group]}
                      </td>
                    </tr>
                    {COMPARISON_METRICS.filter((m) => m.group === group).map((metric) => {
                      const aValue = data.player_a.stats[metric.key];
                      const bValue = data.player_b.stats[metric.key];
                      const lead = leader(metric, aValue, bValue);
                      return (
                        <tr key={metric.key} className="border-b border-line-strong/60 last:border-0">
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
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
