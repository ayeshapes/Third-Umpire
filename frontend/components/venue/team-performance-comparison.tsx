"use client";

/**
 * Ticket 10.2 -- Venue Comparison: Team Performance.
 *
 * "Which teams perform best where" -- one column per selected venue,
 * each a leaderboard of every team's record at that venue (matches,
 * win%, avg score), sorted best-to-worst. Side by side is the whole
 * point of this requirement: reading the same team's row across
 * columns shows whether a team's form is venue-specific or holds
 * everywhere, which a single combined table sorted one way couldn't
 * show as directly.
 */

import { useVenueComparison } from "@/hooks/use-venue-comparison";

export interface TeamVenueRecord {
  team_name: string;
  team_code: string;
  matches: number;
  wins: number;
  losses: number;
  win_pct: number;
  avg_score: number;
}

export interface VenueTeamPerformance {
  venue_id: number;
  venue_name: string;
  teams: TeamVenueRecord[];
}

export interface TeamPerformanceComparisonData {
  venues: VenueTeamPerformance[];
}

export interface TeamPerformanceComparisonProps {
  path: string;
  venueIds: number[];
}

// Tailwind needs statically-written class names to pick them up (a
// template-literal `xl:grid-cols-${n}` is invisible to its scanner),
// so the column count maps through this lookup instead.
const GRID_COLS_XL: Record<number, string> = {
  1: "xl:grid-cols-1",
  2: "xl:grid-cols-2",
  3: "xl:grid-cols-3",
  4: "xl:grid-cols-4",
};

export function TeamPerformanceComparison({ path, venueIds }: TeamPerformanceComparisonProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = useVenueComparison<TeamPerformanceComparisonData>(
    path,
    venueIds
  );

  if (venueIds.length < 2) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-line-strong bg-surface px-6 py-12 text-center text-xs text-fg-faint">
        Pick at least 2 venues above to compare team performance.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line-strong bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-ivory">Team Performance</h3>
        {isFetching && !isLoading && <span className="text-xs text-fg-faint">Updating…</span>}
      </div>

      {isLoading ? (
        <div role="status" aria-label="Loading team performance" className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {venueIds.map((id) => (
            <div key={id} className="flex flex-col gap-2">
              <div className="h-4 w-32 animate-pulse rounded bg-surface-2" />
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-8 w-full animate-pulse rounded bg-surface-2" />
              ))}
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 text-xs text-crimson-bright">
          <span className="text-center">{error instanceof Error ? error.message : "Failed to load team performance"}</span>
          <button type="button" onClick={() => refetch()} className="font-medium underline underline-offset-2">
            Retry
          </button>
        </div>
      ) : !data || data.venues.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-xs text-fg-faint">No team performance data for these venues</div>
      ) : (
        <div
          className={`grid grid-cols-1 gap-4 transition-opacity duration-150 md:grid-cols-2 ${
            GRID_COLS_XL[Math.min(data.venues.length, 4)]
          } ${isFetching ? "opacity-50" : "opacity-100"}`}
        >
          {data.venues.map((venue) => {
            const rows = [...venue.teams].sort((a, b) => b.win_pct - a.win_pct);
            return (
              <div key={venue.venue_id} className="flex flex-col gap-2">
                <p className="truncate text-xs font-medium uppercase tracking-widest text-fg-faint" title={venue.venue_name}>
                  {venue.venue_name}
                </p>
                {rows.length === 0 ? (
                  <p className="text-xs text-fg-faint">No matches recorded here yet.</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {rows.map((t) => (
                      <div key={t.team_code} className="flex items-center gap-2 rounded-lg bg-surface-2 px-2.5 py-1.5">
                        <span className="min-w-0 flex-1 truncate text-xs font-medium text-ivory" title={t.team_name}>
                          {t.team_code}
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-fg-faint">
                          {t.wins}-{t.losses}
                        </span>
                        <span className="w-12 shrink-0 text-right text-xs font-medium tabular-nums text-crimson-bright">
                          {t.win_pct.toFixed(0)}%
                        </span>
                        <span className="w-10 shrink-0 text-right text-xs tabular-nums text-fg-faint">{t.avg_score.toFixed(0)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
