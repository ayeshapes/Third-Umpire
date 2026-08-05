"use client";

/**
 * Ticket 9.2 -- Match Insights page.
 * Ticket 9.3 -- Match Highlights.
 *
 * "A detailed analytics page for every match" is implemented as one
 * page template driven by the `match` filter -- the last level of the
 * Ticket 6.7 cascade (season -> team -> player -> venue -> match) --
 * rather than a separate route per match id. That means:
 *   - The match picker, URL sync (Ticket 6.5, `?match=...`), and
 *     presets (Ticket 6.6) this page needs already exist; nothing
 *     match-specific to build there.
 *
 * Repoint fix: every section below was pointed at a separate
 * illustrative placeholder path that doesn't exist. None of them
 * needed a new endpoint -- `/api/matches/{match_id}/detail` already
 * returns everything (see lib/api/match-charts.ts), so this page
 * fetches it once via useMatchDetail and hands each section its
 * slice directly instead of each section fetching its own path.
 *
 * Manhattan, Partnership Timeline, and Estimated Win Probability were
 * removed from this page; Momentum Changes, Best Partnership, and
 * Match Facts were removed from <MatchHighlights>.
 */

import type { ReactNode } from "react";
import { useMemo } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { FilterBar } from "@/components/filters/filter-bar";
import { useFilters } from "@/store/filters";
import { useMatchDetail } from "@/hooks/use-match-detail";
import { toWormGraph } from "@/lib/api/match-charts";
import { MatchSummary } from "@/components/match/match-summary";
import { MatchTimeline } from "@/components/match/match-timeline";
import { MatchHighlights } from "@/components/match/match-highlights";
import { WormGraph } from "@/components/charts/worm-graph";
import { RunRateComparison } from "@/components/charts/run-rate-comparison";

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="mb-4 text-xs font-medium uppercase tracking-widest text-fg-faint">{children}</p>;
}

export default function MatchInsightsPage() {
  const { filters } = useFilters();
  const hasMatch = filters.match !== null;
  const { data: raw } = useMatchDetail(filters.match);

  const wormData = useMemo(() => (raw ? toWormGraph(raw) : null), [raw]);

  return (
    <div>
      <PageHeader
        eyebrow="Analytics"
        title="Match Insights"
        description="Pick a match from the filter bar below for its full breakdown -- summary, timeline, scoring charts, and highlights."
      />

      <div className="mb-8">
        {/* This page is driven by the season -> team -> opponent -> player
            -> venue -> match cascade (picking a match is the point of the
            page), plus city -- toss/result/innings/phase/etc don't scope
            "which match" so they're left off here. */}
        <FilterBar fields={["season", "team", "opponent", "player", "venue", "match", "city"]} />
      </div>

      {!hasMatch ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-line-strong bg-surface px-6 py-16 text-center">
          <p className="text-sm font-medium text-ivory">No match selected</p>
          <p className="max-w-sm text-xs text-fg-faint">
            Narrow down by season, team, or venue in the filter bar above, then pick a match from the Match dropdown to see its
            full analytics.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-8">
            <SectionLabel>Match Summary</SectionLabel>
            <MatchSummary />
          </div>

          <div className="mb-8">
            <SectionLabel>Timeline</SectionLabel>
            <MatchTimeline />
          </div>

          <div className="mb-8">
            <SectionLabel>Scoring Charts</SectionLabel>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <WormGraph data={wormData} title="Worm Graph" />
              <RunRateComparison title="Run Rate Comparison" />
            </div>
          </div>

          <div>
            <SectionLabel>Highlights</SectionLabel>
            <MatchHighlights />
          </div>
        </>
      )}
    </div>
  );
}
