"use client";

/**
 * Ticket 12.1 -- Opposition Comparison.
 *
 * Same paired-bar shape as <PlayerVenueComparison>, broken down by
 * opponent team instead of venue -- "who struggles against pace-heavy
 * attacks" and "whose game travels" are different questions, so they
 * get separate breakdowns rather than one component with a
 * venue/opponent toggle burying either behind a click.
 */

import { usePlayerComparison } from "@/hooks/use-player-comparison";

export interface PlayerOppositionRow {
  team_id: number;
  team_name: string;
  team_code: string;
  player_a_average: number | null;
  player_b_average: number | null;
  player_a_matches: number;
  player_b_matches: number;
}

export interface PlayerOppositionComparisonData {
  player_a_name: string;
  player_b_name: string;
  oppositions: PlayerOppositionRow[];
}

export interface PlayerOppositionComparisonProps {
  path: string;
  playerAId: number | null;
  playerBId: number | null;
}

export function PlayerOppositionComparison({ path, playerAId, playerBId }: PlayerOppositionComparisonProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = usePlayerComparison<PlayerOppositionComparisonData>(
    path,
    playerAId,
    playerBId
  );

  if (playerAId === null || playerBId === null) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-line-strong bg-surface px-6 py-12 text-center text-xs text-fg-faint">
        Pick two players above to compare by opposition.
      </div>
    );
  }

  const maxAvg = data
    ? Math.max(...data.oppositions.flatMap((o) => [o.player_a_average ?? 0, o.player_b_average ?? 0]), 1)
    : 1;

  return (
    <div className="rounded-2xl border border-line-strong bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-ivory">Opposition Comparison</h3>
        {isFetching && !isLoading && <span className="text-xs text-fg-faint">Updating…</span>}
      </div>

      {isLoading ? (
        <div role="status" aria-label="Loading opposition comparison" className="flex flex-col gap-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 w-full animate-pulse rounded bg-surface-2" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 text-xs text-crimson-bright">
          <span className="text-center">{error instanceof Error ? error.message : "Failed to load opposition comparison"}</span>
          <button type="button" onClick={() => refetch()} className="font-medium underline underline-offset-2">
            Retry
          </button>
        </div>
      ) : !data || data.oppositions.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-xs text-fg-faint">No shared opposition data for these players</div>
      ) : (
        <div className={`flex flex-col gap-3 transition-opacity duration-150 ${isFetching ? "opacity-50" : "opacity-100"}`}>
          {data.oppositions.map((o) => (
            <div key={o.team_id} className="flex flex-col gap-1">
              <p className="truncate text-xs font-medium text-fg-muted" title={o.team_name}>
                vs {o.team_code}
              </p>
              {([
                ["a", o.player_a_average, o.player_a_matches, "bg-crimson-bright", "text-crimson-bright"],
                ["b", o.player_b_average, o.player_b_matches, "bg-fg-muted", "text-ivory"],
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
