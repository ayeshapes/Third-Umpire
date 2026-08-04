"use client";

/**
 * Team Comparison Studio: Venue Comparison.
 *
 * Distinct from components/venue/team-performance-comparison.tsx
 * (which compares *several venues'* full team leaderboards): this is
 * scoped to exactly the two selected teams, one paired win% bar per
 * venue they've both played at, same shape as
 * components/players/player-venue-comparison.tsx applied to teams --
 * "does this team's form travel, or is it home-track dependent"
 * relative to the specific opponent being compared.
 */

import { useTeamComparison } from "@/hooks/use-team-comparison";

export interface TeamVenueRow {
  venue_id: number;
  venue_name: string;
  team_a_win_pct: number | null;
  team_b_win_pct: number | null;
  team_a_matches: number;
  team_b_matches: number;
}

export interface TeamVenueComparisonData {
  team_a_code: string;
  team_b_code: string;
  venues: TeamVenueRow[];
}

export interface VenueComparisonProps {
  path: string;
  teamAId: number | null;
  teamBId: number | null;
}

export function VenueComparison({ path, teamAId, teamBId }: VenueComparisonProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = useTeamComparison<TeamVenueComparisonData>(
    path,
    teamAId,
    teamBId
  );

  if (teamAId === null || teamBId === null) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-line-strong bg-surface px-6 py-12 text-center text-xs text-fg-faint">
        Pick two teams above to compare by venue.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line-strong bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-ivory">Venue Comparison</h3>
        {isFetching && !isLoading && <span className="text-xs text-fg-faint">Updating…</span>}
      </div>

      {isLoading ? (
        <div role="status" aria-label="Loading venue comparison" className="flex flex-col gap-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 w-full animate-pulse rounded bg-surface-2" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 text-xs text-crimson-bright">
          <span className="text-center">{error instanceof Error ? error.message : "Failed to load venue comparison"}</span>
          <button type="button" onClick={() => refetch()} className="font-medium underline underline-offset-2">
            Retry
          </button>
        </div>
      ) : !data || data.venues.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-xs text-fg-faint">No shared venue data for these teams</div>
      ) : (
        <div className={`flex flex-col gap-3 transition-opacity duration-150 ${isFetching ? "opacity-50" : "opacity-100"}`}>
          {data.venues.map((v) => (
            <div key={v.venue_id} className="flex flex-col gap-1">
              <p className="truncate text-xs font-medium text-fg-muted" title={v.venue_name}>
                {v.venue_name}
              </p>
              {(
                [
                  ["a", v.team_a_win_pct, v.team_a_matches, "bg-crimson-bright", "text-crimson-bright"],
                  ["b", v.team_b_win_pct, v.team_b_matches, "bg-fg-muted", "text-ivory"],
                ] as const
              ).map(([side, winPct, matches, barClass, labelClass]) => (
                <div key={side} className="flex items-center gap-2">
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className={`h-full rounded-full ${barClass}`}
                      style={{ width: `${winPct != null ? Math.max(winPct, 3) : 0}%` }}
                    />
                  </div>
                  <span className={`w-24 shrink-0 text-right text-xs tabular-nums ${labelClass}`}>
                    {winPct != null ? `${winPct.toFixed(0)}%` : "--"}
                    <span className="ml-1 text-fg-faint">({matches})</span>
                  </span>
                </div>
              ))}
            </div>
          ))}
          <div className="mt-1 flex flex-wrap items-center justify-center gap-4">
            <span className="flex items-center gap-1.5 text-xs text-fg-faint">
              <span className="h-2 w-2 rounded-full bg-crimson-bright" /> {data.team_a_code} win% (matches)
            </span>
            <span className="flex items-center gap-1.5 text-xs text-fg-faint">
              <span className="h-2 w-2 rounded-full bg-fg-muted" /> {data.team_b_code} win% (matches)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
