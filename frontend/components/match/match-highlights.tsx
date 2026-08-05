"use client";

/**
 * Ticket 9.3 -- Match Highlights.
 *
 * The "if you only have a minute" section of the match page: a
 * curated, explained subset of what happened, as opposed to
 * <MatchTimeline>'s complete chronological ball log. One backend
 * endpoint returns all five requirements together since they're
 * produced by the same post-match analysis pass and are cheap to
 * render as one card -- splitting into five separate fetches would
 * just mean five loading states for content that's always ready at
 * the same time.
 */

import type { ReactNode } from "react";
import { useMemo } from "react";
import { useFilters } from "@/store/filters";
import { useMatchDetail } from "@/hooks/use-match-detail";
import { toMatchHighlights } from "@/lib/api/match-charts";

export interface TurningPoint {
  innings: 1 | 2;
  over: number;
  description: string;
}

export interface MomentumChange {
  innings: 1 | 2;
  over: number;
  description: string;
  /** Which side momentum swung toward. */
  favored: "team1" | "team2";
}

export interface BestPartnership {
  batter1: string;
  batter2: string;
  wicket: number;
  runs: number;
  balls: number;
}

export interface BestBowlingSpell {
  bowler: string;
  overs: number;
  runs: number;
  wickets: number;
}

export interface MatchHighlightsData {
  turning_points: TurningPoint[];
  best_partnership: BestPartnership | null;
  best_bowling_spell: BestBowlingSpell | null;
  momentum_changes: MomentumChange[];
  match_facts: string[];
}

function HighlightCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line-strong bg-surface p-5">
      <h3 className="mb-3 text-sm font-medium text-ivory">{title}</h3>
      {children}
    </div>
  );
}

function EventList({ items, emptyText }: { items: { over: number; innings: 1 | 2; description: string }[]; emptyText: string }) {
  if (items.length === 0) {
    return <p className="text-xs text-fg-faint">{emptyText}</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span className="mt-0.5 shrink-0 text-xs font-medium tabular-nums text-fg-faint">
            {item.innings}.{item.over.toFixed(1)}
          </span>
          <span className="text-sm text-fg-muted">{item.description}</span>
        </li>
      ))}
    </ul>
  );
}

export function MatchHighlights() {
  const { filters } = useFilters();
  const { data: raw, isLoading, isError, error, refetch, isFetching } = useMatchDetail(filters.match);
  const data = useMemo(() => (raw ? toMatchHighlights(raw) : null), [raw]);

  if (isLoading) {
    return (
      <div role="status" aria-label="Loading match highlights" className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-40 animate-pulse rounded-2xl bg-surface-2" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-line-strong bg-surface p-8 text-xs text-crimson-bright">
        <span>{error instanceof Error ? error.message : "Failed to load match highlights"}</span>
        <button type="button" onClick={() => refetch()} className="font-medium underline underline-offset-2">
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-line-strong bg-surface p-8 text-xs text-fg-faint">
        No highlights available for this match
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 gap-4 md:grid-cols-2 transition-opacity duration-150 ${isFetching ? "opacity-50" : "opacity-100"}`}>
      <HighlightCard title="Turning Points">
        <EventList items={data.turning_points} emptyText="No standout turning points identified for this match." />
      </HighlightCard>

      <HighlightCard title="Best Bowling Spell">
        {data.best_bowling_spell ? (
          <div>
            <p className="text-sm font-medium text-ivory">{data.best_bowling_spell.bowler}</p>
            <p className="mt-1 text-xs text-fg-faint">
              {data.best_bowling_spell.wickets}/{data.best_bowling_spell.runs} off {data.best_bowling_spell.overs} overs
            </p>
          </div>
        ) : (
          <p className="text-xs text-fg-faint">No bowling spell data available.</p>
        )}
      </HighlightCard>
    </div>
  );
}

