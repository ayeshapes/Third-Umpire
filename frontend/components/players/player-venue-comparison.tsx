"use client";

/**
 * Ticket 12.1 -- Venue Comparison (player-level).
 *
 * Distinct from components/venue/team-performance-comparison.tsx
 * (Ticket 10.2, which compares *teams'* records across venues): this
 * breaks each *player's* output down by venue, one paired bar row per
 * ground, so you can see whose game travels and whose is home-track
 * dependent -- something the career-total row in <CareerStatsComparison>
 * necessarily flattens away.
 */

import { usePlayerComparison } from "@/hooks/use-player-comparison";

export interface PlayerVenueRow {
  venue_id: number;
  venue_name: string;
  player_a_average: number | null;
  player_b_average: number | null;
  player_a_matches: number;
  player_b_matches: number;
}

export interface PlayerVenueComparisonData {
  player_a_name: string;
  player_b_name: string;
  venues: PlayerVenueRow[];
}

export interface PlayerVenueComparisonProps {
  path: string;
  playerAId: number | null;
  playerBId: number | null;
}

export function PlayerVenueComparison({ path, playerAId, playerBId }: PlayerVenueComparisonProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = usePlayerComparison<PlayerVenueComparisonData>(
    path,
    playerAId,
    playerBId
  );

  if (playerAId === null || playerBId === null) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-line-strong bg-surface px-6 py-12 text-center text-xs text-fg-faint">
        Pick two players above to compare by venue.
      </div>
    );
  }

  const maxAvg = data ? Math.max(...data.venues.flatMap((v) => [v.player_a_average ?? 0, v.player_b_average ?? 0]), 1) : 1;

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
        <div className="flex h-40 items-center justify-center text-xs text-fg-faint">No shared venue data for these players</div>
      ) : (
        <div className={`flex flex-col gap-3 transition-opacity duration-150 ${isFetching ? "opacity-50" : "opacity-100"}`}>
          {data.venues.map((v) => (
            <div key={v.venue_id} className="flex flex-col gap-1">
              <p className="truncate text-xs font-medium text-fg-muted" title={v.venue_name}>
                {v.venue_name}
              </p>
              {([
                ["a", v.player_a_average, v.player_a_matches, "bg-crimson-bright", "text-crimson-bright"],
                ["b", v.player_b_average, v.player_b_matches, "bg-fg-muted", "text-ivory"],
              ] as const).map(([side, avg, matches, barClass, labelClass]) => (
                <div key={side} className="flex items-center gap-2">
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className={`h-full rounded-full ${barClass}`}
                      style={{ width: `${avg != null ? Math.max((avg / maxAvg) * 100, 3) : 0}%` }}
                    />
                  </div>
                  <span className={`w-24 shrink-0 text-right text-xs tabular-nums ${labelClass}`}>
                    {avg != null ? avg.toFixed(1) : "--"}
                    <span className="ml-1 text-fg-faint">({matches})</span>
                  </span>
                </div>
              ))}
            </div>
          ))}
          <div className="mt-1 flex flex-wrap items-center justify-center gap-4">
            <span className="flex items-center gap-1.5 text-xs text-fg-faint">
              <span className="h-2 w-2 rounded-full bg-crimson-bright" /> {data.player_a_name} avg (matches)
            </span>
            <span className="flex items-center gap-1.5 text-xs text-fg-faint">
              <span className="h-2 w-2 rounded-full bg-fg-muted" /> {data.player_b_name} avg (matches)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
