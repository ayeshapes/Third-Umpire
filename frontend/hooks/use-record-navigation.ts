"use client";

/**
 * Ticket 11.1 -- see lib/records-navigation.ts for the "why" behind
 * routing through the shared filter store instead of per-id routes.
 * This hook is the "do it" half: resolve the target, write the
 * filters, then push the route -- same order the FilterBar's own
 * controls follow (state changes first, FilterUrlSync's effect syncs
 * the URL on the next tick), so a click here behaves exactly like
 * picking that player/team/match from the filter bar and clicking
 * over to that page.
 */

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useFilters } from "@/store/filters";
import { resolveRecordNavigation, type RecordNavigationInput } from "@/lib/records-navigation";

export function useRecordNavigation() {
  const router = useRouter();
  const { setFilters } = useFilters();

  return useCallback(
    (input: RecordNavigationInput) => {
      const target = resolveRecordNavigation(input);
      if (!target) return false;
      setFilters(target.filters);
      router.push(target.href);
      return true;
    },
    [router, setFilters]
  );
}
