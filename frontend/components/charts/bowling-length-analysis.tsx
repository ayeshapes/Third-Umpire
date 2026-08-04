"use client";

/**
 * Ticket 8.2 -- Bowling Length Analysis.
 *
 * Yorker / Full / Good / Short / Bouncer -- one bar per length
 * category, sized by balls bowled with economy called out per bar,
 * plus a wicket-count marker (same "skyline + wicket dots" idea as
 * <ManhattanChart>). Where <PitchMap> shows every individual delivery
 * as a point, this aggregates them into the five length bands
 * broadcasters and coaches actually talk in -- the summary view
 * <PitchMap>'s scatter doesn't give you at a glance.
 */

import { useChartData } from "@/hooks/use-chart-data";

export type BowlingLength = "yorker" | "full" | "good" | "short" | "bouncer";

export interface BowlingLengthStat {
  length: BowlingLength;
  balls: number;
  runs: number;
  wickets: number;
  economy: number;
}

export interface BowlingLengthAnalysisProps {
  path: string;
  title?: string;
}

const LENGTH_LABEL: Record<BowlingLength, string> = {
  yorker: "Yorker",
  full: "Full",
  good: "Good",
  short: "Short",
  bouncer: "Bouncer",
};

const LENGTH_ORDER: BowlingLength[] = ["yorker", "full", "good", "short", "bouncer"];

export function BowlingLengthAnalysis({ path, title = "Bowling Length Analysis" }: BowlingLengthAnalysisProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = useChartData<BowlingLengthStat[]>(path);

  const byLength = new Map((data ?? []).map((d) => [d.length, d]));
  const maxBalls = data && data.length > 0 ? Math.max(...data.map((d) => d.balls), 1) : 1;

  return (
    <div className="rounded-2xl border border-line-strong bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-ivory">{title}</h3>
        {isFetching && !isLoading && <span className="text-xs text-fg-faint">Updating…</span>}
      </div>

      {isLoading ? (
        <div role="status" aria-label={`Loading ${title}`} className="flex h-52 items-end gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex-1 animate-pulse rounded-t bg-surface-2" style={{ height: `${30 + i * 12}%` }} />
          ))}
        </div>
      ) : isError ? (
        <div className="flex h-52 flex-col items-center justify-center gap-2 text-xs text-crimson-bright">
          <span className="text-center">{error instanceof Error ? error.message : "Failed to load length data"}</span>
          <button type="button" onClick={() => refetch()} className="font-medium underline underline-offset-2">
            Retry
          </button>
        </div>
      ) : !data || data.length === 0 ? (
        <div className="flex h-52 items-center justify-center text-xs text-fg-faint">No length data for the current filters</div>
      ) : (
        <div className={`transition-opacity duration-150 ${isFetching ? "opacity-50" : "opacity-100"}`}>
          <div className="flex h-40 items-end gap-3">
            {LENGTH_ORDER.map((len) => {
              const l = byLength.get(len);
              const heightPct = l ? Math.max((l.balls / maxBalls) * 100, 4) : 0;
              return (
                <div key={len} className="flex flex-1 flex-col items-center justify-end gap-1">
                  {l && l.wickets > 0 && (
                    <span className="flex gap-0.5" title={`${l.wickets} wicket${l.wickets === 1 ? "" : "s"}`}>
                      {Array.from({ length: Math.min(l.wickets, 6) }).map((_, w) => (
                        <span key={w} className="block h-1.5 w-1.5 rounded-full bg-chart-1" />
                      ))}
                    </span>
                  )}
                  <div
                    className="w-full rounded-t bg-ivory/50"
                    style={{ height: `${heightPct}%` }}
                    title={l ? `${LENGTH_LABEL[len]}: ${l.balls} balls, ${l.economy.toFixed(2)} econ` : LENGTH_LABEL[len]}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-2 grid grid-cols-5 gap-3 text-center">
            {LENGTH_ORDER.map((len) => {
              const l = byLength.get(len);
              return (
                <div key={len} className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-widest text-fg-faint">{LENGTH_LABEL[len]}</span>
                  <span className="text-xs tabular-nums text-fg-muted">{l ? l.economy.toFixed(2) : "--"}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
