"use client";

/**
 * Ticket 10.2 -- Venue Comparison data hook.
 *
 * Same shape as hooks/use-chart-data.ts (query key includes every
 * input that should trigger a refetch, keepPreviousData so the
 * comparison doesn't flash empty while a newly-added venue's data
 * loads) but keyed on the explicit venue-id list this page manages
 * locally instead of the shared filter store -- see
 * components/venue/venue-multi-select.tsx for why.
 */

import { useQuery, keepPreviousData, type UseQueryResult } from "@tanstack/react-query";
import { fetchVenueComparison } from "@/lib/api/venues";

export function useVenueComparison<T>(path: string, venueIds: number[]): UseQueryResult<T> {
  return useQuery({
    queryKey: ["venue-compare", path, venueIds],
    queryFn: ({ signal }) => fetchVenueComparison<T>(path, venueIds, signal),
    enabled: venueIds.length >= 2,
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });
}
