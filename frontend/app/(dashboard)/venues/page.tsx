"use client";

/**
 * Ticket 10.1 -- Venue Intelligence.
 *
 * "Dedicated analytics pages for every venue" -- same shape of
 * decision as Match Insights (app/(dashboard)/matches/page.tsx): one
 * page template driven by the shared `venue` filter (store/filters)
 * rather than a route per venue id, so the venue picker, URL sync,
 * and presets already built for the filter bar apply here for free.
 *
 * Layout, top to bottom, follows the ticket's own requirement order:
 *   1. Venue Overview -- identity + headline numbers
 *   2. Batting Conditions / Bowling Conditions -- side by side, same
 *      venue, opposite sides of the ball
 *   3. Average Scores -- the par-score read
 *   4. Toss Impact
 *   5. Spin vs Pace
 *   6. Historical Trends
 *
 * Chart endpoint paths are illustrative, same caveat as
 * lib/api/charts.ts: the venues/analytics routers aren't part of
 * this codebase slice.
 */

import type { ReactNode } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { FilterBar } from "@/components/filters/filter-bar";
import { useFilters } from "@/store/filters";
import { VenueOverview } from "@/components/venue/venue-overview";
import { BattingConditions } from "@/components/venue/batting-conditions";
import { BowlingConditions } from "@/components/venue/bowling-conditions";
import { AverageScores } from "@/components/venue/average-scores";
import { TossImpact } from "@/components/venue/toss-impact";
import { SpinVsPace } from "@/components/venue/spin-vs-pace";
import { HistoricalTrends } from "@/components/venue/historical-trends";

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="mb-4 text-xs font-medium uppercase tracking-widest text-fg-faint">{children}</p>;
}

export default function VenueIntelligencePage() {
  const { filters } = useFilters();
  const hasVenue = filters.venue !== null;

  return (
    <div>
      <PageHeader
        eyebrow="Analytics"
        title="Venue Intelligence"
        description="Pick a venue from the filter bar below for its full read -- conditions, par scores, toss impact, and trends over time."
      />

      <div className="mb-8">
        <FilterBar />
      </div>

      {!hasVenue ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-line-strong bg-surface px-6 py-16 text-center">
          <p className="text-sm font-medium text-ivory">No venue selected</p>
          <p className="max-w-sm text-xs text-fg-faint">Pick a venue from the filter bar above to see its full intelligence report.</p>
        </div>
      ) : (
        <>
          <div className="mb-8">
            <SectionLabel>Venue Overview</SectionLabel>
            <VenueOverview path="/api/venues/overview" />
          </div>

          <div className="mb-8">
            <SectionLabel>Conditions</SectionLabel>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <BattingConditions path="/api/venues/batting-conditions" />
              <BowlingConditions path="/api/venues/bowling-conditions" />
            </div>
          </div>

          <div className="mb-8">
            <SectionLabel>Average Scores</SectionLabel>
            <AverageScores path="/api/venues/average-scores" />
          </div>

          <div className="mb-8">
            <SectionLabel>Toss Impact</SectionLabel>
            <TossImpact path="/api/venues/toss-impact" />
          </div>

          <div className="mb-8">
            <SectionLabel>Spin vs Pace</SectionLabel>
            <SpinVsPace path="/api/venues/spin-vs-pace" title="Spin vs Pace" />
          </div>

          <div>
            <SectionLabel>Historical Trends</SectionLabel>
            <HistoricalTrends path="/api/venues/historical-trends" title="Average Score by Season" />
          </div>
        </>
      )}
    </div>
  );
}
