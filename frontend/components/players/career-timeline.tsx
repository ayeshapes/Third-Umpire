"use client";

/**
 * Ticket 12.1 -- Career Timeline.
 *
 * Two Gantt-style rows spanning debut season to most recent season,
 * one segment per season sized by how much cricket that player
 * played it (matches) -- same visual idea as
 * components/charts/partnership-timeline.tsx, applied to a career
 * instead of an innings. Shows overlap (were these two ever
 * contemporaries?) and career length/shape at a glance, which no
 * other section here does -- <SeasonComparison> plots a value per
 * season but doesn't anchor either career to a shared calendar axis.
 */

import { useMemo } from "react";
import { usePlayerComparison } from "@/hooks/use-player-comparison";

export interface CareerTimelineSeason {
  season_year: number;
  matches: number;
}

export interface CareerTimelinePlayer {
  name: string;
  debut_year: number;
  last_active_year: number;
  seasons: CareerTimelineSeason[];
}

export interface CareerTimelineData {
  player_a: CareerTimelinePlayer;
  player_b: CareerTimelinePlayer;
}

export interface CareerTimelineProps {
  path: string;
  playerAId: number | null;
  playerBId: number | null;
}

function TimelineRow({ player, accentClass, minYear, maxYear }: { player: CareerTimelinePlayer; accentClass: string; minYear: number; maxYear: number }) {
  const span = Math.max(maxYear - minYear, 1);
  const maxMatches = Math.max(...player.seasons.map((s) => s.matches), 1);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-ivory">{player.name}</span>
        <span className="text-xs text-fg-faint">
          {player.debut_year}–{player.last_active_year}
        </span>
      </div>
      <div className="relative h-7 rounded-lg bg-surface-2">
        {player.seasons.map((s) => {
          const leftPct = ((s.season_year - minYear) / span) * 100;
          const widthPct = Math.max((1 / span) * 100, 1.5);
          const intensity = 0.35 + 0.65 * (s.matches / maxMatches);
          return (
            <div
              key={s.season_year}
              className={`absolute inset-y-1 rounded-sm ${accentClass}`}
              style={{ left: `${leftPct}%`, width: `${widthPct}%`, opacity: intensity }}
              title={`${player.name}, ${s.season_year}: ${s.matches} match${s.matches === 1 ? "" : "es"}`}
            />
          );
        })}
      </div>
    </div>
  );
}

export function CareerTimeline({ path, playerAId, playerBId }: CareerTimelineProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = usePlayerComparison<CareerTimelineData>(
    path,
    playerAId,
    playerBId
  );

  const bounds = useMemo(() => {
    if (!data) return null;
    return {
      minYear: Math.min(data.player_a.debut_year, data.player_b.debut_year),
      maxYear: Math.max(data.player_a.last_active_year, data.player_b.last_active_year),
    };
  }, [data]);

  if (playerAId === null || playerBId === null) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-line-strong bg-surface px-6 py-12 text-center text-xs text-fg-faint">
        Pick two players above to see their career timelines.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line-strong bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-ivory">Career Timeline</h3>
        {isFetching && !isLoading && <span className="text-xs text-fg-faint">Updating…</span>}
      </div>

      {isLoading ? (
        <div role="status" aria-label="Loading career timeline" className="flex flex-col gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-9 w-full animate-pulse rounded-lg bg-surface-2" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex h-32 flex-col items-center justify-center gap-2 text-xs text-crimson-bright">
          <span className="text-center">{error instanceof Error ? error.message : "Failed to load career timeline"}</span>
          <button type="button" onClick={() => refetch()} className="font-medium underline underline-offset-2">
            Retry
          </button>
        </div>
      ) : !data || !bounds ? (
        <div className="flex h-32 items-center justify-center text-xs text-fg-faint">No timeline data for these players</div>
      ) : (
        <div className={`flex flex-col gap-4 transition-opacity duration-150 ${isFetching ? "opacity-50" : "opacity-100"}`}>
          <TimelineRow player={data.player_a} accentClass="bg-crimson-bright" minYear={bounds.minYear} maxYear={bounds.maxYear} />
          <TimelineRow player={data.player_b} accentClass="bg-fg-muted" minYear={bounds.minYear} maxYear={bounds.maxYear} />
          <div className="flex justify-between text-[10px] text-fg-faint">
            <span>{bounds.minYear}</span>
            <span>{bounds.maxYear}</span>
          </div>
        </div>
      )}
    </div>
  );
}
