"use client";

/**
 * Ticket 9.2 -- Timeline.
 *
 * A chronological feed of the match's notable balls (wickets,
 * boundaries, milestones, innings breaks) rather than the full
 * ball-by-ball log -- the point is to let someone reconstruct how the
 * match unfolded in 30 seconds, which the granular over-by-over
 * charts below it (Worm/Manhattan/Run Rate) don't narrate on their
 * own. Distinct from <MatchHighlights>' "Turning Points": this is
 * *every* notable ball in order; Turning Points is a curated subset
 * with an explanation of *why* each one mattered.
 */

import { useChartData } from "@/hooks/use-chart-data";

export type TimelineEventType = "wicket" | "four" | "six" | "fifty" | "hundred" | "innings_break" | "milestone";

export interface TimelineEvent {
  innings: 1 | 2;
  /** Over.ball, e.g. 14.3 */
  over: number;
  description: string;
  type: TimelineEventType;
}

export interface MatchTimelineData {
  events: TimelineEvent[];
}

export interface MatchTimelineProps {
  path: string;
}

const EVENT_STYLES: Record<TimelineEventType, string> = {
  wicket: "bg-crimson-bright",
  six: "bg-ivory",
  four: "bg-fg-muted",
  fifty: "bg-ivory",
  hundred: "bg-ivory",
  innings_break: "bg-fg-faint",
  milestone: "bg-fg-muted",
};

const EVENT_LABELS: Record<TimelineEventType, string> = {
  wicket: "Wicket",
  six: "Six",
  four: "Four",
  fifty: "Fifty",
  hundred: "Hundred",
  innings_break: "Innings Break",
  milestone: "Milestone",
};

export function MatchTimeline({ path }: MatchTimelineProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = useChartData<MatchTimelineData>(path);

  return (
    <div className="rounded-2xl border border-line-strong bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-ivory">Timeline</h3>
        {isFetching && !isLoading && <span className="text-xs text-fg-faint">Updating…</span>}
      </div>

      {isLoading ? (
        <div role="status" aria-label="Loading timeline" className="flex flex-col gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 w-full animate-pulse rounded bg-surface-2" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 text-xs text-crimson-bright">
          <span className="text-center">{error instanceof Error ? error.message : "Failed to load timeline"}</span>
          <button type="button" onClick={() => refetch()} className="font-medium underline underline-offset-2">
            Retry
          </button>
        </div>
      ) : !data || data.events.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-xs text-fg-faint">No timeline data for this match</div>
      ) : (
        <ol
          className={`flex max-h-96 flex-col gap-0 overflow-y-auto transition-opacity duration-150 ${
            isFetching ? "opacity-50" : "opacity-100"
          }`}
        >
          {data.events.map((event, i) => (
            <li key={`${event.innings}-${event.over}-${i}`} className="flex gap-3 border-l border-line-strong pb-4 pl-4 last:pb-0">
              <span className={`-ml-[21px] mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${EVENT_STYLES[event.type]}`} />
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium text-fg-faint">
                  Inn {event.innings} · Ov {event.over.toFixed(1)} · {EVENT_LABELS[event.type]}
                </span>
                <span className="text-sm text-fg-muted">{event.description}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
