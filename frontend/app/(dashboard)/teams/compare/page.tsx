"use client";

/**
 * Team Comparison Studio.
 *
 * Lives at its own route (like app/(dashboard)/players/compare/page.tsx
 * and app/(dashboard)/venues/compare/page.tsx) rather than as a mode
 * of a single-team page, for the same reason both of those routes
 * exist separately: comparing two teams needs two independent
 * selections, a shape the shared filter store's single `team` (+
 * `opponent`) field doesn't represent (store/filters/types.ts).
 * <TeamSelect> owns that local Team A/B state; everything below it is
 * a plain function of those two IDs plus whatever's in the *shared*
 * filter bar above them.
 *
 * "Shared filters" requirement: <FilterBar> is the same component
 * every other analytics page renders (season/venue/toss/weather/
 * etc), so narrowing to e.g. a single season scopes every section
 * below identically to how it scopes Batting/Bowling/Players.
 * lib/api/teams.ts strips the bar's own `team`/`opponent` fields back
 * out before building comparison requests, since Team A/B here take
 * over that role.
 *
 * Layout, top to bottom -- one section per requirement:
 *   1. Filter bar (shared, scopes every section below)
 *   2. Team picker (Team A vs Team B)
 *   3. Head-to-Head -- overall record + recent meetings
 *   4. Batting Comparison -- full side-by-side batting table
 *   5. Bowling Comparison -- full side-by-side bowling table
 *   6. Venue Comparison -- win% at venues both teams have played
 *   7. Historical Performance -- season-by-season trend
 *   8. Shared Visualizations -- skill radar + recent form guide,
 *      the two charts that synthesize every section above into one
 *      picture rather than reading one metric at a time
 *   9. Team Insights -- derived prose summary (strengths, weaknesses,
 *      historical trends, interesting observations), reusing the
 *      batting/bowling/history queries above instead of a new fetch
 *
 * Chart/table endpoint paths below are illustrative, same caveat as
 * every other comparison page: the teams/analytics routers
 * referenced in backend/app/main.py aren't part of this codebase
 * slice.
 */

import { useState, type ReactNode } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { FilterBar } from "@/components/filters/filter-bar";
import { TeamSelect } from "@/components/teams/team-select";
import { HeadToHeadSummary } from "@/components/teams/head-to-head-summary";
import { HeadToHeadMeetings } from "@/components/teams/head-to-head-meetings";
import { BattingComparison } from "@/components/teams/batting-comparison";
import { BowlingComparison } from "@/components/teams/bowling-comparison";
import { VenueComparison } from "@/components/teams/venue-comparison";
import { HistoricalPerformance } from "@/components/teams/historical-performance";
import { TeamComparisonRadarChart } from "@/components/teams/comparison-radar-chart";
import { FormGuide } from "@/components/teams/form-guide";
import { TeamComparisonInsights } from "@/components/teams/comparison-insights";

const BATTING_PATH = "/api/teams/compare/batting";
const BOWLING_PATH = "/api/teams/compare/bowling";
const HISTORY_PATH = "/api/teams/compare/history";

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="mb-4 text-xs font-medium uppercase tracking-widest text-fg-faint">{children}</p>;
}

export default function TeamComparisonPage() {
  const [teamAId, setTeamAId] = useState<number | null>(null);
  const [teamBId, setTeamBId] = useState<number | null>(null);

  return (
    <div>
      <PageHeader
        eyebrow="Analytics"
        title="Team Comparison Studio"
        description="Pick two teams to compare head-to-head record, batting, bowling, venues, and historical form, side by side."
      />

      <div className="mb-8">
        <FilterBar />
      </div>

      <div className="mb-8">
        <TeamSelect teamAId={teamAId} teamBId={teamBId} onChangeA={setTeamAId} onChangeB={setTeamBId} />
      </div>

      <div className="mb-8">
        <SectionLabel>Head-to-Head</SectionLabel>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <HeadToHeadSummary teamAId={teamAId} teamBId={teamBId} />
          <HeadToHeadMeetings teamAId={teamAId} teamBId={teamBId} />
        </div>
      </div>

      <div className="mb-8">
        <SectionLabel>Batting Comparison</SectionLabel>
        <BattingComparison path={BATTING_PATH} teamAId={teamAId} teamBId={teamBId} />
      </div>

      <div className="mb-8">
        <SectionLabel>Bowling Comparison</SectionLabel>
        <BowlingComparison path={BOWLING_PATH} teamAId={teamAId} teamBId={teamBId} />
      </div>

      <div className="mb-8">
        <SectionLabel>Venue Comparison</SectionLabel>
        <VenueComparison path="/api/teams/compare/venues" teamAId={teamAId} teamBId={teamBId} />
      </div>

      <div className="mb-8">
        <SectionLabel>Historical Performance</SectionLabel>
        <HistoricalPerformance path={HISTORY_PATH} teamAId={teamAId} teamBId={teamBId} />
      </div>

      <div className="mb-8">
        <SectionLabel>Shared Visualizations</SectionLabel>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <TeamComparisonRadarChart path="/api/teams/compare/radar" teamAId={teamAId} teamBId={teamBId} />
          <FormGuide path="/api/teams/compare/form" teamAId={teamAId} teamBId={teamBId} />
        </div>
      </div>

      <div>
        <SectionLabel>Team Insights</SectionLabel>
        <TeamComparisonInsights
          battingPath={BATTING_PATH}
          bowlingPath={BOWLING_PATH}
          historyPath={HISTORY_PATH}
          teamAId={teamAId}
          teamBId={teamBId}
        />
      </div>
    </div>
  );
}
