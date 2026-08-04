"use client";

/**
 * Ticket 6.5 -- URL Synchronization.
 *
 * Mounted automatically by <FilterProvider> (see filter-context.tsx).
 * Renders nothing -- it's pure side-effect glue between the reducer
 * and the URL:
 *
 *   URL -> state   on mount (refresh/shareable-link persistence) and
 *                  whenever `searchParams` changes from a browser
 *                  Back/Forward navigation.
 *   state -> URL   whenever a filter changes via the store (dropdown
 *                  selection etc), via router.push so each change is
 *                  its own history entry -- that's what makes
 *                  Back/Forward actually step through filter changes
 *                  instead of just re-rendering the same state.
 *
 * `lastSyncedQuery` is the loop-breaker: both effects write to it, and
 * each bails out if the URL already matches what it was about to set,
 * so a state->URL push doesn't immediately bounce back into a
 * URL->state dispatch (and vice versa).
 */

import { useContext, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FilterDispatchContext, FilterStateContext } from "./filter-context";
import { DEFAULT_FILTERS } from "./constants";
import { filtersToSearchParams, searchParamsToFilters } from "./url";

export function FilterUrlSync() {
  const filters = useContext(FilterStateContext);
  const dispatch = useContext(FilterDispatchContext);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const lastSyncedQuery = useRef<string | null>(null);
  const isFirstStateEffect = useRef(true);
  const isFirstUrlEffect = useRef(true);

  // URL -> state (initial hydration on mount + Back/Forward)
  useEffect(() => {
    const urlQuery = searchParams.toString();
    if (urlQuery === lastSyncedQuery.current) return; // this URL change came from us -- ignore

    const patch = searchParamsToFilters(searchParams);
    // Base to merge the URL patch onto. On every run *after* the first
    // (i.e. actual Back/Forward navigation) this is DEFAULT_FILTERS, so a
    // param that's no longer in the URL actually clears back to "not set"
    // -- that's what makes Back/Forward step through filter changes.
    // On the very *first* run (mount) we instead base it on the current
    // state, which may already contain a page's `initialFilters` (e.g. a
    // preselected season). Basing on DEFAULT_FILTERS here would silently
    // wipe any initialFilters key the URL doesn't happen to mention.
    const base = isFirstUrlEffect.current ? filters ?? DEFAULT_FILTERS : DEFAULT_FILTERS;
    isFirstUrlEffect.current = false;
    dispatch?.({ type: "SET_MANY", patch: { ...base, ...patch } });
    lastSyncedQuery.current = urlQuery;
    // Only `searchParams` should re-trigger this -- `dispatch` is stable,
    // and `filters` is intentionally read from the closure only on the
    // first run (see `base` above), not tracked as a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // state -> URL (user changes a filter). Skipped on mount so it never
  // races the hydration effect above.
  useEffect(() => {
    if (isFirstStateEffect.current) {
      isFirstStateEffect.current = false;
      return;
    }
    if (!filters) return;

    const query = filtersToSearchParams(filters).toString();
    if (query === lastSyncedQuery.current) return;

    lastSyncedQuery.current = query;
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  return null;
}
