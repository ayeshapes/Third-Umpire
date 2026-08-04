"use client";

/**
 * Preview page for the centralized filter store (store/filters).
 * <FilterProvider> is already mounted once in app/(dashboard)/layout.tsx,
 * so any page/component under the dashboard can just call the hooks --
 * no local provider needed here.
 *
 * Wired up end-to-end:
 *   - <FilterBar> dropdowns are populated from the live /api/filters/*
 *     endpoints and cascade (season -> team -> player -> venue ->
 *     match) via hooks/use-cascading-filters.ts (Ticket 6.7).
 *   - Every change updates the URL, survives a refresh, and responds
 *     to browser Back/Forward (Ticket 6.5).
 *   - The two <SyncedChart>s below both react to the same filter
 *     changes with no manual refresh -- change a filter and watch
 *     both update. They also both point at the same illustrative path
 *     in this demo on purpose: open the Network tab and change a
 *     filter -- you'll see ONE request, not two, because React Query
 *     dedupes identical (path + filters) query keys across components
 *     (Global Chart Synchronization).
 */

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { FilterBar } from "@/components/filters/filter-bar";
import { FilterPresets } from "@/components/filters/filter-presets";
import { SyncedChart } from "@/components/charts/synced-chart";
import { useFilters } from "@/store/filters";

export default function FilterStateDemoPage() {
  const { filters } = useFilters();

  return (
    <div>
      <PageHeader
        eyebrow="Component Preview"
        title="Filter State"
        description="Centralized, type-safe filter state -- backed by live API data, cascading, and synced with the URL."
      />

      <div className="mb-8">
        <FilterBar />
      </div>

      {/* Ticket 6.9 -- Saved Filter Presets (localStorage, no backend). */}
      <Card className="mb-8">
        <CardContent className="pt-5">
          <p className="mb-4 text-xs font-medium uppercase tracking-widest text-fg-faint">Filter Presets</p>
          <FilterPresets />
        </CardContent>
      </Card>

      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Same path+filters as the chart below -- proves request dedupe. */}
        <SyncedChart title="Runs by Season" path="/api/analytics/runs-by-season" />
        <SyncedChart title="Runs by Season (2nd instance)" path="/api/analytics/runs-by-season" />
      </div>

      <Card>
        <CardContent className="pt-5">
          <p className="mb-2 text-xs font-medium uppercase tracking-widest text-fg-faint">
            Current filter state (FilterState)
          </p>
          <pre className="scoreboard-digits overflow-x-auto rounded-xl bg-surface-2 p-4 text-xs text-fg-muted">
            {JSON.stringify(filters, null, 2)}
          </pre>
          <p className="mt-3 text-xs text-fg-faint">
            Matches the current URL query string -- copy the address bar to share this exact view.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
