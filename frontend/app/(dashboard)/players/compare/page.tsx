"use client";

/**
 * Ticket 12.1 -- Player Comparison Studio.
 * Ticket 12.2 -- Player Insights.
 *
 * Lives at its own route (like app/(dashboard)/venues/compare/page.tsx,
 * Ticket 10.2) rather than as a mode of a single-player page, for the
 * same reason: comparing two players needs two independent selections,
 * a shape the shared filter store's single `player` field doesn't
 * represent (store/filters/types.ts). <PlayerSelect> owns that local
 * Player A/B state; everything below it is a plain function of those
 * two IDs plus whatever's in the *shared* filter bar above them.
 *
 * "Shared filters" requirement: <FilterBar> is the same component
 * every other analytics page renders (season/venue/opponent/toss/
 * weather/etc), so narrowing to e.g. a single season scopes every
 * section below identically to how it scopes Batting/Bowling/Records.
 * lib/api/players.ts strips the bar's own `player` field back out
 * before building comparison requests, since Player A/B here take
 * over that role.
 *
 * Layout, top to bottom:
 *   1. Filter bar (shared, scopes every section below)
 *   2. Player picker (Player A vs Player B)
 *   3. Career Statistics -- full side-by-side stat table
 *   4. Season Comparison -- trend over time
 *   5. Venue Comparison / Opposition Comparison -- side by side
 *   6. Radar Chart / Career Timeline -- side by side
 *   7. Player Insights (Ticket 12.2) -- derived prose summary
 *
 * Chart/table endpoint paths below are illustrative, same caveat as
 * every other page: the players/analytics routers referenced in
 * backend/app/main.py aren't part of this codebase slice.
 */

import { useState, type ReactNode } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { FilterBar } from "@/components/filters/filter-bar";
import { PlayerSelect } from "@/components/players/player-select";
import { CareerStatsComparison } from "@/components/players/career-stats-comparison";
import { SeasonComparison } from "@/components/players/season-comparison";
import { PlayerVenueComparison } from "@/components/players/player-venue-comparison";
import { PlayerOppositionComparison } from "@/components/players/player-opposition-comparison";
import { ComparisonRadarChart } from "@/components/players/comparison-radar-chart";
import { CareerTimeline } from "@/components/players/career-timeline";
import { ComparisonInsights } from "@/components/players/comparison-insights";

const CAREER_STATS_PATH = "/api/players/compare/career-stats";

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="mb-4 text-xs font-medium uppercase tracking-widest text-fg-faint">{children}</p>;
}

export default function PlayerComparisonPage() {
  const [playerAId, setPlayerAId] = useState<number | null>(null);
  const [playerBId, setPlayerBId] = useState<number | null>(null);

  return (
    <div>
      <PageHeader
        eyebrow="Analytics"
        title="Player Comparison Studio"
        description="Pick two players to compare career numbers, season trends, venues, opposition, and skill shape, side by side."
      />

      <div className="mb-8">
        <FilterBar />
      </div>

      <div className="mb-8">
        <PlayerSelect playerAId={playerAId} playerBId={playerBId} onChangeA={setPlayerAId} onChangeB={setPlayerBId} />
      </div>

      <div className="mb-8">
        <SectionLabel>Career Statistics</SectionLabel>
        <CareerStatsComparison path={CAREER_STATS_PATH} playerAId={playerAId} playerBId={playerBId} />
      </div>

      <div className="mb-8">
        <SectionLabel>Season Comparison</SectionLabel>
        <SeasonComparison path="/api/players/compare/seasons" playerAId={playerAId} playerBId={playerBId} />
      </div>

      <div className="mb-8">
        <SectionLabel>Venue &amp; Opposition</SectionLabel>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <PlayerVenueComparison path="/api/players/compare/venues" playerAId={playerAId} playerBId={playerBId} />
          <PlayerOppositionComparison path="/api/players/compare/opposition" playerAId={playerAId} playerBId={playerBId} />
        </div>
      </div>

      <div className="mb-8">
        <SectionLabel>Skill Shape &amp; Career Span</SectionLabel>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ComparisonRadarChart path="/api/players/compare/radar" playerAId={playerAId} playerBId={playerBId} />
          <CareerTimeline path="/api/players/compare/timeline" playerAId={playerAId} playerBId={playerBId} />
        </div>
      </div>

      <div>
        <SectionLabel>Player Insights</SectionLabel>
        <ComparisonInsights careerStatsPath={CAREER_STATS_PATH} playerAId={playerAId} playerBId={playerBId} />
      </div>
    </div>
  );
}
