"use client";

/**
 * Global Chart Synchronization.
 *
 * One hook every chart on Dashboard/Players/Teams/Records/Analytics
 * calls with just its endpoint path:
 *
 *   const { data, isLoading, isError, error, refetch, isFetching } =
 *     useChartData<RunsBySeasonPoint[]>("/api/analytics/runs-by-season");
 *
 * How each requirement is met:
 *   - Shared filter context: params come from the same useFilters()
 *     the FilterBar writes to (store/filters, one FilterProvider per
 *     dashboard layout) -- no chart-local filter state to drift out
 *     of sync with the bar.
 *   - No manual refresh: `filters` is part of the React Query key, so
 *     any filter change automatically refetches every mounted chart
 *     that depends on it. Nothing to wire up per chart.
 *   - Avoid duplicate API requests: two charts (or two instances of
 *     the same chart, e.g. rendered on both Dashboard and Analytics)
 *     calling useChartData with the same path+filters produce the
 *     *same* query key -- React Query serves them from one shared
 *     in-flight request/cache entry, not two network calls. This is
 *     why AppProviders (app/providers.tsx) creates exactly one
 *     QueryClient for the whole dashboard layout.
 *   - Efficient rerendering: `placeholderData: keepPreviousData` keeps
 *     the previous chart on screen (component reads `isFetching` to
 *     dim it) while new data loads, instead of unmounting into a
 *     loading state on every filter change.
 */

import { useQuery, keepPreviousData, type UseQueryResult } from "@tanstack/react-query";
import { useFilters } from "@/store/filters";
import { fetchChartData } from "@/lib/api/charts";

export function useChartData<T>(path: string, options?: { enabled?: boolean }): UseQueryResult<T> {
  const { filters } = useFilters();

  return useQuery({
    queryKey: ["chart", path, filters],
    queryFn: ({ signal }) => fetchChartData<T>(path, filters, signal),
    enabled: options?.enabled ?? true,
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000, // chart data moves more than the filter-option lists
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });
}
