"use client";

/**
 * Ticket 8.1 -- Complete Bowling Dashboard.
 * Ticket 8.2 -- Advanced Bowling Visualizations.
 * Ticket 8.3 -- Bowling Conditions Analysis.
 *
 * Bowling-side mirror of app/(dashboard)/batting/page.tsx: same
 * layout skeleton, same <FilterBar>/useChartData wiring (the shared
 * filter store already has everything a bowling page needs --
 * season/team/player/venue/opponent/phase/battingOrder/etc, see
 * store/filters/types.ts -- so there's nothing bowling-specific to
 * add to the store itself, just new chart/table components reading
 * from it).
 *
 * Layout, top to bottom:
 *   1. Filter bar (global, shared with every other dashboard page)
 *   2. Bowling Overview -- season-wide counting stats (Ticket 8.1)
 *   3. Advanced KPIs -- economy/average/strike-rate/dot% (Ticket 8.1)
 *   4. Visualizations -- six purpose-built chart types (Ticket 8.2),
 *      each picked for the specific question it answers; see each
 *      component's own docstring for why that shape fits that data
 *   5. Match Conditions -- venue/opposition/phase/bowling-order
 *      breakdowns (Ticket 8.3), same "breakdown across a dimension"
 *      idea as the batting page's Match Conditions section -- these
 *      complement rather than duplicate the single-value filters in
 *      the bar above.
 *   6. Bowling Rankings -- sortable leaderboard table (Ticket 8.1)
 *
 * Chart endpoint paths below are illustrative, same caveat as
 * lib/api/charts.ts: the analytics router isn't part of this
 * codebase slice, so point these at your real routes.
 */

import type { ReactNode } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { FilterBar } from "@/components/filters/filter-bar";
import { BowlingOverviewCards } from "@/components/bowling/bowling-overview-cards";
import { BowlingKpiCards } from "@/components/bowling/bowling-kpi-cards";
import { BowlingStatsTable } from "@/components/bowling/bowling-stats-table";
import { PitchMap } from "@/components/charts/pitch-map";
import { WicketDistribution } from "@/components/charts/wicket-distribution";
import { EconomyAnalysis } from "@/components/charts/economy-analysis";
import { DotBallAnalysis } from "@/components/charts/dot-ball-analysis";
import { DismissalTypes } from "@/components/charts/dismissal-types";
import { BowlingLengthAnalysis } from "@/components/charts/bowling-length-analysis";
import { VenueComparison } from "@/components/charts/bowling-venue-comparison";
import { OppositionComparison } from "@/components/charts/bowling-opposition-comparison";
import { BowlingPhaseAnalysis } from "@/components/charts/bowling-phase-analysis";
import { BowlingFirstVsDefending } from "@/components/charts/bowling-first-vs-defending";

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="mb-4 text-xs font-medium uppercase tracking-widest text-fg-faint">{children}</p>;
}

export default function BowlingAnalyticsPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Analytics"
        title="Bowling"
        description="Season totals, rate stats, pitch-by-pitch breakdowns, and rankings -- all scoped to the filters below."
      />

      <div className="mb-8">
        <FilterBar />
      </div>

      <div className="mb-8">
        <SectionLabel>Bowling Overview</SectionLabel>
        <BowlingOverviewCards />
      </div>

      <div className="mb-8">
        <SectionLabel>Advanced KPIs</SectionLabel>
        <BowlingKpiCards />
      </div>

      <div className="mb-8">
        <SectionLabel>Visualizations</SectionLabel>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <PitchMap path="/api/analytics/bowling/pitch-map" title="Pitch Map" />
          <WicketDistribution path="/api/analytics/bowling/wicket-distribution" title="Wicket Distribution" />
          <EconomyAnalysis path="/api/analytics/bowling/economy" title="Economy Analysis" />
          <DotBallAnalysis path="/api/analytics/bowling/dot-balls" title="Dot Ball Analysis" />
          <DismissalTypes path="/api/analytics/bowling/dismissal-types" title="Dismissal Types" />
          <BowlingLengthAnalysis path="/api/analytics/bowling/length" title="Bowling Length Analysis" />
        </div>
      </div>

      <div className="mb-8">
        <SectionLabel>Match Conditions</SectionLabel>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <VenueComparison path="/api/analytics/bowling/by-venue" title="Venue Comparison" />
          <OppositionComparison path="/api/analytics/bowling/by-opposition" title="Opposition Comparison" />
          <BowlingPhaseAnalysis path="/api/analytics/bowling/by-phase" title="Powerplay / Middle / Death" />
          <BowlingFirstVsDefending path="/api/analytics/bowling/by-bowling-order" title="Bowling First vs Defending" />
        </div>
      </div>

      <div>
        <SectionLabel>Rankings</SectionLabel>
        <BowlingStatsTable />
      </div>
    </div>
  );
}
