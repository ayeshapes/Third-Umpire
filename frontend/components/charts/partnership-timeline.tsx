"use client";

/**
 * Ticket 9.2 -- Partnership Timeline.
 *
 * Every partnership of the match plotted along an over-number axis
 * (a Gantt-style row per innings), so you can read *when* each stand
 * happened and how it overlapped the run rate/win probability charts
 * above it -- distinct from <PartnershipAnalysis> (Ticket 7.2), which
 * indexes partnerships by wicket number and sizes bars by runs with
 * no notion of *when* on the innings clock they occurred. Both are
 * legitimate views of the same underlying data; this one is the
 * "timeline" the ticket specifically asks for.
 */

import { useMemo } from "react";
import { useFilters } from "@/store/filters";
import { useMatchDetail } from "@/hooks/use-match-detail";
import { toPartnershipTimeline } from "@/lib/api/match-charts";

export interface PartnershipTimelineEntry {
  innings: 1 | 2;
  wicket: number; // 1 = 1st wicket partnership, etc.
  batter1: string;
  batter2: string;
  start_over: number;
  end_over: number;
  runs: number;
}

export interface PartnershipTimelineData {
  innings_overs: number; // match format length, e.g. 20
  entries: PartnershipTimelineEntry[];
}

export interface PartnershipTimelineProps {
  title?: string;
}

export function PartnershipTimeline({ title = "Partnership Timeline" }: PartnershipTimelineProps) {
  const { filters } = useFilters();
  const { data: raw, isLoading, isError, error, refetch, isFetching } = useMatchDetail(filters.match);
  const data = useMemo(() => (raw ? toPartnershipTimeline(raw) : null), [raw]);

  const rows = useMemo(() => {
    if (!data) return { innings1: [], innings2: [] };
    return {
      innings1: data.entries.filter((e) => e.innings === 1),
      innings2: data.entries.filter((e) => e.innings === 2),
    };
  }, [data]);

  return (
    <div className="rounded-2xl border border-line-strong bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-ivory">{title}</h3>
        {isFetching && !isLoading && <span className="text-xs text-fg-faint">Updating…</span>}
      </div>

      {isLoading ? (
        <div role="status" aria-label={`Loading ${title}`} className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 w-full animate-pulse rounded bg-surface-2" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 text-xs text-crimson-bright">
          <span className="text-center">{error instanceof Error ? error.message : "Failed to load partnership timeline"}</span>
          <button type="button" onClick={() => refetch()} className="font-medium underline underline-offset-2">
            Retry
          </button>
        </div>
      ) : !data || data.entries.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-xs text-fg-faint">No partnership data for this match</div>
      ) : (
        <div className={`flex flex-col gap-5 transition-opacity duration-150 ${isFetching ? "opacity-50" : "opacity-100"}`}>
          {([
            [1, rows.innings1],
            [2, rows.innings2],
          ] as const).map(
            ([inn, entries]) =>
              entries.length > 0 && (
                <div key={inn} className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium uppercase tracking-widest text-fg-faint">Innings {inn}</span>
                  <div className="flex flex-col gap-1.5">
                    {entries.map((e) => {
                      const leftPct = (e.start_over / data.innings_overs) * 100;
                      const widthPct = Math.max(((e.end_over - e.start_over) / data.innings_overs) * 100, 2);
                      return (
                        <div key={`${e.innings}-${e.wicket}`} className="relative h-8 rounded-lg bg-surface-2">
                          <div
                            className="absolute inset-y-0 flex items-center overflow-hidden rounded-lg bg-chart-1/60 px-2"
                            style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                            title={`${e.batter1} & ${e.batter2}: ${e.runs} runs (overs ${e.start_over}-${e.end_over})`}
                          >
                            <span className="truncate text-xs font-medium text-ivory">
                              {e.batter1} &amp; {e.batter2} · {e.runs}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between text-[10px] text-fg-faint">
                    <span>Over 0</span>
                    <span>Over {data.innings_overs}</span>
                  </div>
                </div>
              )
          )}
        </div>
      )}
    </div>
  );
}
