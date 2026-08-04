"use client";

/**
 * Team Comparison Studio: Bowling Comparison.
 *
 * Mirror of components/teams/batting-comparison.tsx, scoped to
 * BOWLING_COMPARISON_METRICS/TeamBowlingStats and its own endpoint --
 * see that file's doc comment for why batting/bowling stay split.
 */

import { useTeamComparison } from "@/hooks/use-team-comparison";
import { BOWLING_COMPARISON_METRICS, type TeamBowlingComparisonData } from "./types";

function leader(higherIsBetter: boolean, a: number | string | null, b: number | string | null): "a" | "b" | null {
  if (typeof a !== "number" || typeof b !== "number" || a === b) return null;
  const aWins = higherIsBetter ? a > b : a < b;
  return aWins ? "a" : "b";
}

export interface BowlingComparisonProps {
  path: string;
  teamAId: number | null;
  teamBId: number | null;
}

export function BowlingComparison({ path, teamAId, teamBId }: BowlingComparisonProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = useTeamComparison<TeamBowlingComparisonData>(
    path,
    teamAId,
    teamBId
  );

  if (teamAId === null || teamBId === null) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-line-strong bg-surface px-6 py-12 text-center text-xs text-fg-faint">
        Pick two teams above to compare bowling.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line-strong bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-ivory">Bowling Comparison</h3>
        {isFetching && !isLoading && <span className="text-xs text-fg-faint">Updating…</span>}
      </div>

      {isLoading ? (
        <div role="status" aria-label="Loading bowling comparison" className="flex flex-col gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-8 w-full animate-pulse rounded bg-surface-2" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 text-xs text-crimson-bright">
          <span className="text-center">{error instanceof Error ? error.message : "Failed to load bowling comparison"}</span>
          <button type="button" onClick={() => refetch()} className="font-medium underline underline-offset-2">
            Retry
          </button>
        </div>
      ) : !data ? (
        <div className="flex h-40 items-center justify-center text-xs text-fg-faint">No bowling data for these teams</div>
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
                {BOWLING_COMPARISON_METRICS.map((metric) => {
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
