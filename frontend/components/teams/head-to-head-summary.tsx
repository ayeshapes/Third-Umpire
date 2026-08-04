"use client";

/**
 * Team Comparison Studio: Head-to-Head.
 *
 * The one question every team comparison starts with -- "who wins
 * when these two actually play" -- answered as a single split bar
 * (wins/no-results proportional to width) plus the raw counts and
 * average winning margins either side. Deliberately not folded into
 * <BattingComparison>/<BowlingComparison>: those describe how each
 * team performs in general, this describes how they've done *against
 * each other specifically*, which can diverge a lot from overall form.
 */

import { useMemo } from "react";
import { useTeamHeadToHead } from "@/hooks/use-team-head-to-head";
import { toHeadToHeadSummary } from "@/lib/api/team-head-to-head";
import type { TeamLite } from "./types";

export interface HeadToHeadSummaryData {
  team_a: TeamLite;
  team_b: TeamLite;
  total_matches: number;
  team_a_wins: number;
  team_b_wins: number;
  no_results: number;
  team_a_win_pct: number;
  team_b_win_pct: number;
  team_a_avg_margin_runs: number | null;
  team_b_avg_margin_runs: number | null;
  current_streak: { team_code: string; count: number } | null;
}

export interface HeadToHeadSummaryProps {
  teamAId: number | null;
  teamBId: number | null;
}

function StatBlock({ label, value, accentClass }: { label: string; value: string; accentClass: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl bg-surface-2 px-3 py-3">
      <span className={`text-xl font-semibold tabular-nums ${accentClass}`}>{value}</span>
      <span className="text-center text-[10px] uppercase tracking-widest text-fg-faint">{label}</span>
    </div>
  );
}

export function HeadToHeadSummary({ teamAId, teamBId }: HeadToHeadSummaryProps) {
  const { data: raw, isLoading, isError, error, refetch, isFetching } = useTeamHeadToHead(teamAId, teamBId);
  const data = useMemo(() => (raw ? toHeadToHeadSummary(raw.raw, raw.teamA, raw.teamB) : null), [raw]);

  if (teamAId === null || teamBId === null) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-line-strong bg-surface px-6 py-12 text-center text-xs text-fg-faint">
        Pick two teams above to see their head-to-head record.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line-strong bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-ivory">Head-to-Head Record</h3>
        {isFetching && !isLoading && <span className="text-xs text-fg-faint">Updating…</span>}
      </div>

      {isLoading ? (
        <div role="status" aria-label="Loading head-to-head record" className="flex flex-col gap-4">
          <div className="h-3 w-full animate-pulse rounded-full bg-surface-2" />
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 w-full animate-pulse rounded-xl bg-surface-2" />
            ))}
          </div>
        </div>
      ) : isError ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 text-xs text-crimson-bright">
          <span className="text-center">{error instanceof Error ? error.message : "Failed to load head-to-head record"}</span>
          <button type="button" onClick={() => refetch()} className="font-medium underline underline-offset-2">
            Retry
          </button>
        </div>
      ) : !data || data.total_matches === 0 ? (
        <div className="flex h-40 items-center justify-center text-xs text-fg-faint">These teams haven&apos;t met yet</div>
      ) : (
        <div className={`flex flex-col gap-4 transition-opacity duration-150 ${isFetching ? "opacity-50" : "opacity-100"}`}>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-2">
            <div className="h-full bg-crimson-bright" style={{ width: `${data.team_a_win_pct}%` }} />
            <div className="h-full bg-fg-muted" style={{ width: `${data.team_b_win_pct}%` }} />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-crimson-bright">
              <span className="h-2 w-2 rounded-full bg-crimson-bright" />
              {data.team_a.team_code} {data.team_a_win_pct.toFixed(0)}%
            </span>
            {data.current_streak && (
              <span className="text-fg-faint">
                {data.current_streak.team_code} on a {data.current_streak.count}-match streak
              </span>
            )}
            <span className="flex items-center gap-1.5 text-ivory">
              {data.team_b.team_code} {data.team_b_win_pct.toFixed(0)}%
              <span className="h-2 w-2 rounded-full bg-fg-muted" />
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <StatBlock label={`${data.team_a.team_code} Wins`} value={String(data.team_a_wins)} accentClass="text-crimson-bright" />
            <StatBlock label="Matches Played" value={String(data.total_matches)} accentClass="text-ivory" />
            <StatBlock label={`${data.team_b.team_code} Wins`} value={String(data.team_b_wins)} accentClass="text-ivory" />
          </div>

          <div className="grid grid-cols-2 gap-2 border-t border-line-strong pt-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-fg-faint">Avg margin ({data.team_a.team_code} wins)</span>
              <span className="tabular-nums text-fg-muted">
                {data.team_a_avg_margin_runs != null ? `${data.team_a_avg_margin_runs.toFixed(0)} runs` : "--"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-fg-faint">Avg margin ({data.team_b.team_code} wins)</span>
              <span className="tabular-nums text-fg-muted">
                {data.team_b_avg_margin_runs != null ? `${data.team_b_avg_margin_runs.toFixed(0)} runs` : "--"}
              </span>
            </div>
          </div>
          {data.no_results > 0 && (
            <p className="text-center text-[11px] text-fg-faint">
              {data.no_results} match{data.no_results === 1 ? "" : "es"} with no result
            </p>
          )}
        </div>
      )}
    </div>
  );
}
