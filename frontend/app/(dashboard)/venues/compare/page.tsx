"use client";

/**
 * Ticket 10.2 -- Venue Comparison.
 *
 * Scope note: the ticket lists Side-by-Side Comparison, Average
 * Scores, Win Percentages, Pitch Behaviour, and Team Performance --
 * this pass only builds Team Performance (the rest can slot in later
 * as their own sections/components the same way, reusing the venue
 * picker and useVenueComparison hook below).
 *
 * Lives at its own route rather than as a mode of the single-venue
 * Venue Intelligence page (app/(dashboard)/venues/page.tsx) since
 * the two pages need fundamentally different selection state --
 * one venue there (the shared filter store) vs several here (local
 * state, see components/venue/venue-multi-select.tsx).
 */

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { VenueMultiSelect } from "@/components/venue/venue-multi-select";
import { TeamPerformanceComparison } from "@/components/venue/team-performance-comparison";

export default function VenueComparisonPage() {
  const [selectedVenueIds, setSelectedVenueIds] = useState<number[]>([]);

  return (
    <div>
      <PageHeader
        eyebrow="Analytics"
        title="Venue Comparison"
        description="Pick 2-4 venues to see how teams have actually performed at each one, side by side."
      />

      <div className="mb-8">
        <VenueMultiSelect selected={selectedVenueIds} onChange={setSelectedVenueIds} />
      </div>

      <div>
        <p className="mb-4 text-xs font-medium uppercase tracking-widest text-fg-faint">Team Performance</p>
        <TeamPerformanceComparison path="/api/venues/compare/team-performance" venueIds={selectedVenueIds} />
      </div>
    </div>
  );
}
