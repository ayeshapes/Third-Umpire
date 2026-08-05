"use client";

/**
 * Ticket 11.1 -- Records.
 *
 * "A comprehensive records section" -- five curated categories
 * (Batting/Bowling/Team/Season/Match), each rendered by the same
 * <RecordBoard> pointed at its own endpoint (see that component's
 * docstring for why one component covers all five), plus the
 * <RecordsSearchTable> flat/searchable view underneath for finding
 * a specific record instead of browsing.
 *
 * FilterBar included like every other analytics page -- records are
 * scoped by season/team/venue/etc the same way a leaderboard is
 * (e.g. "records" can mean "records this season" as easily as
 * "records all-time"), so this reuses the existing filter store
 * rather than inventing a separate scoping mechanism.
 *
 * Chart endpoint paths are illustrative, same caveat as
 * lib/api/charts.ts: the records/analytics routers aren't part of
 * this codebase slice.
 */

import type { ReactNode } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { FilterBar } from "@/components/filters/filter-bar";
import { RecordBoard } from "@/components/records/record-board";
import { RecordsSearchTable } from "@/components/records/records-search-table";

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="mb-4 text-xs font-medium uppercase tracking-widest text-fg-faint">{children}</p>;
}

export default function RecordsPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Analytics"
        title="Records"
        description="Batting, bowling, team, season, and match records -- filter to a scope above, or search every record directly below."
      />

      <div className="mb-8">
        {/* Records are browsed by season/team/venue, not by a single
            player/match/toss/phase -- narrower field set than the full
            14-filter bar so this doesn't show filters that don't scope
            a "records" question. */}
        <FilterBar fields={["season", "team", "opponent", "venue"]} />
      </div>

      <div className="mb-8">
        <SectionLabel>Batting Records</SectionLabel>
        <RecordBoard path="/api/records/batting" category="batting" />
      </div>

      <div className="mb-8">
        <SectionLabel>Bowling Records</SectionLabel>
        <RecordBoard path="/api/records/bowling" category="bowling" />
      </div>

      <div className="mb-8">
        <SectionLabel>Team Records</SectionLabel>
        <RecordBoard path="/api/records/team" category="team" />
      </div>

      <div className="mb-8">
        <SectionLabel>Season Records</SectionLabel>
        <RecordBoard path="/api/records/season" category="season" />
      </div>

      <div className="mb-8">
        <SectionLabel>Match Records</SectionLabel>
        <RecordBoard path="/api/records/match" category="match" />
      </div>

      <div>
        <SectionLabel>Search All Records</SectionLabel>
        <RecordsSearchTable path="/api/records/search" />
      </div>
    </div>
  );
}
