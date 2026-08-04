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
 *   - Every section below is wired the same way as Batting/Bowling:
 *     useChartData reads the shared filter store and refetches on any
 *     change -- picking a different match from the bar just refreshes
 *     this page in place, same as changing `season` does on Batting.
 *   - <WormGraph>, <ManhattanChart>, and <PartnershipAnalysis> are
 *     reused as-is from Ticket 7.2 (pointed at match-scoped endpoint
 *     paths) instead of rebuilding chart types this page also needs.
 *
 * Chart endpoint paths are illustrative, same caveat as
 * lib/api/charts.ts: the matches/analytics routers aren't part of
 * this codebase slice.
 */

import type { ReactNode } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { FilterBar } from "@/components/filters/filter-bar";
import { useFilters } from "@/store/filters";
import { MatchSummary } from "@/components/match/match-summary";
import { MatchTimeline } from "@/components/match/match-timeline";
import { MatchHighlights } from "@/components/match/match-highlights";
import { WormGraph } from "@/components/charts/worm-graph";
import { ManhattanChart } from "@/components/charts/manhattan-chart";
import { RunRateComparison } from "@/components/charts/run-rate-comparison";
import { PartnershipTimeline } from "@/components/charts/partnership-timeline";
import { WinProbability } from "@/components/charts/win-probability";

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="mb-4 text-xs font-medium uppercase tracking-widest text-fg-faint">{children}</p>;
}

export default function MatchInsightsPage() {
  const { filters } = useFilters();
  const hasMatch = filters.match !== null;

  return (
    <div>
      <PageHeader
        eyebrow="Analytics"
        title="Match Insights"
        description="Pick a match from the filter bar below for its full breakdown -- summary, timeline, scoring charts, and highlights."
      />

      <div className="mb-8">
        <FilterBar />
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
            <MatchSummary path="/api/matches/summary" />
          </div>

          <div className="mb-8">
            <SectionLabel>Timeline</SectionLabel>
            <MatchTimeline path="/api/matches/timeline" />
          </div>

          <div className="mb-8">
            <SectionLabel>Scoring Charts</SectionLabel>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <WormGraph path="/api/matches/worm" title="Worm Graph" />
              <ManhattanChart path="/api/matches/manhattan" title="Manhattan Graph" />
              <RunRateComparison path="/api/matches/run-rate-comparison" title="Run Rate Comparison" />
              <PartnershipTimeline path="/api/matches/partnership-timeline" title="Partnership Timeline" />
            </div>
          </div>

          <div className="mb-8">
            <SectionLabel>Estimated Win Probability</SectionLabel>
            <WinProbability path="/api/matches/win-probability" title="Estimated Win Probability" />
          </div>

          <div>
            <SectionLabel>Highlights</SectionLabel>
            <MatchHighlights path="/api/matches/highlights" />
          </div>
        </>
      )}
    </div>
  );
}
