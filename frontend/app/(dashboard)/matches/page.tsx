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
 * illustrative placeholder path (`/api/matches/timeline`, `/worm`,
 * `/manhattan`, `/run-rate-comparison`, `/partnership-timeline`,
 * `/highlights`) that doesn't exist. None of them needed a new
 * endpoint -- `/api/matches/{match_id}/detail` already returns
 * everything (see lib/api/match-charts.ts for the six mappings), so
 * this page fetches it once via useMatchDetail and hands each section
 * its slice directly instead of each section fetching its own path.
 * Timeline/Run Rate/Partnership Timeline/Highlights fetch that same
 * payload internally now (same queryKey, so still one network call
 * total); Worm/Manhattan take pre-mapped `data` because they're also
 * reused on Batting/Bowling as aggregate, filter-scoped charts.
 *
 * Manhattan shows one innings per call -- the component renders a
 * single series -- so this page renders it twice (once per team)
 * instead of the original single illustrative call, which could only
 * ever have shown one side of a two-innings match anyway.
 *
 * Estimated Win Probability is a genuine model output (resources,
 * required rate, wickets in hand -> win%) -- out of scope for this
 * pass, still on its placeholder path.
 */

import type { ReactNode } from "react";
import { useMemo } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { FilterBar } from "@/components/filters/filter-bar";
import { useFilters } from "@/store/filters";
import { useMatchDetail } from "@/hooks/use-match-detail";
import { toWormGraph, toManhattan } from "@/lib/api/match-charts";
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
  const { data: raw } = useMatchDetail(filters.match);

  const wormData = useMemo(() => (raw ? toWormGraph(raw) : null), [raw]);
  const inn1 = useMemo(() => raw?.innings.find((i) => i.batting_team_id === raw.match?.team1_id), [raw]);
  const inn2 = useMemo(() => raw?.innings.find((i) => i.batting_team_id === raw.match?.team2_id), [raw]);
  const manhattan1 = useMemo(() => toManhattan(inn1), [inn1]);
  const manhattan2 = useMemo(() => toManhattan(inn2), [inn2]);

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
              <ManhattanChart data={manhattan1} title={`Manhattan -- ${raw?.match?.team1_name ?? "Team 1"} innings`} />
              <ManhattanChart data={manhattan2} title={`Manhattan -- ${raw?.match?.team2_name ?? "Team 2"} innings`} />
              <PartnershipTimeline title="Partnership Timeline" />
            </div>
          </div>

          <div className="mb-8">
            <SectionLabel>Estimated Win Probability</SectionLabel>
            <WinProbability path="/api/matches/win-probability" title="Estimated Win Probability" />
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
