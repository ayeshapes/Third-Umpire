"use client";

/**
 * Ticket 7.1 -- Batting Analytics page.
 * Ticket 7.2 -- Advanced Batting Visualizations.
 * Ticket 7.3 -- Match Conditions Analysis.
 *
 * <FilterProvider> is already mounted once in app/(dashboard)/layout.tsx,
 * so this page just reads/writes the shared filter store like every
 * other page under the dashboard -- <FilterBar> at the top scopes
 * every card, KPI, chart, and the rankings table below it, all via
 * the same useChartData hook (hooks/use-chart-data.ts), so changing a
 * filter refreshes the whole page with no page-specific wiring.
 *
 * Layout, top to bottom:
 *   1. Filter bar (global, shared with every other dashboard page)
 *   2. Season Overview -- how much cricket happened in this scope
 *   3. Advanced KPIs -- batting-specific rate stats
 *   4. Visualizations -- six purpose-built chart types (Ticket 7.2),
 *      each picked for the specific question it answers rather than
 *      defaulting to another bar chart -- see each component's own
 *      docstring for why that shape fits that data.
 *   5. Match Conditions -- Ticket 7.3's four breakdowns (venue,
 *      opposition, phase, batting order). These are deliberately
 *      *breakdowns across* a dimension rather than the corresponding
 *      single-value filter in the bar above (e.g. "runs at every
 *      venue" vs the `venue` filter narrowing everything to one) --
 *      the two are complementary, not duplicates: filter down to one
 *      venue/opponent/etc first, then these sections still show the
 *      full spread for whatever's left.
 *   6. Batting Rankings -- sortable leaderboard table
 *
 * Chart endpoint paths below are illustrative, same caveat as
 * lib/api/charts.ts: the analytics router isn't part of this
 * codebase slice, so point these at your real routes.
 */

import type { ReactNode } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { FilterBar } from "@/components/filters/filter-bar";
import { SeasonOverviewCards } from "@/components/batting/season-overview-cards";
import { BattingKpiCards } from "@/components/batting/batting-kpi-cards";
import { BattingStatsTable } from "@/components/batting/batting-stats-table";
import { WagonWheel } from "@/components/charts/wagon-wheel";
import { ManhattanChart } from "@/components/charts/manhattan-chart";
import { WormGraph } from "@/components/charts/worm-graph";
import { RunProgression } from "@/components/charts/run-progression";
import { BoundaryAnalysis } from "@/components/charts/boundary-analysis";
import { PartnershipAnalysis } from "@/components/charts/partnership-analysis";
import { VenueAnalysis } from "@/components/charts/venue-analysis";
import { OppositionAnalysis } from "@/components/charts/opposition-analysis";
import { PhaseAnalysis } from "@/components/charts/phase-analysis";
import { BattingOrderComparison } from "@/components/charts/batting-order-comparison";

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="mb-4 text-xs font-medium uppercase tracking-widest text-fg-faint">{children}</p>;
}

export default function BattingAnalyticsPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Analytics"
        title="Batting"
        description="Season totals, rate stats, shot-by-shot breakdowns, and rankings -- all scoped to the filters below."
      />

      <div className="mb-8">
        <FilterBar />
      </div>

      <div className="mb-8">
        <SectionLabel>Season Overview</SectionLabel>
        <SeasonOverviewCards />
      </div>

      <div className="mb-8">
        <SectionLabel>Advanced KPIs</SectionLabel>
        <BattingKpiCards />
      </div>

      <div className="mb-8">
        <SectionLabel>Visualizations</SectionLabel>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <WagonWheel path="/api/analytics/batting/wagon-wheel" title="Wagon Wheel" />
          <ManhattanChart path="/api/analytics/batting/manhattan" title="Manhattan Chart" />
          <WormGraph path="/api/analytics/batting/worm" title="Worm Graph" />
          <RunProgression path="/api/analytics/batting/run-progression" title="Run Progression" />
          <BoundaryAnalysis path="/api/analytics/batting/boundaries" title="Boundary Analysis" />
          <PartnershipAnalysis path="/api/analytics/batting/partnerships" title="Partnership Analysis" />
        </div>
      </div>

      <div className="mb-8">
        <SectionLabel>Match Conditions</SectionLabel>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <VenueAnalysis path="/api/analytics/batting/by-venue" title="Venue Analysis" />
          <OppositionAnalysis path="/api/analytics/batting/by-opposition" title="Opposition Analysis" />
          <PhaseAnalysis path="/api/analytics/batting/by-phase" title="Powerplay / Middle / Death" />
          <BattingOrderComparison path="/api/analytics/batting/by-batting-order" title="Chasing vs Batting First" />
        </div>
      </div>

      <div>
        <SectionLabel>Rankings</SectionLabel>
        <BattingStatsTable />
      </div>
    </div>
  );
}
