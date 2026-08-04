"use client";

import { useCallback, useContext, useMemo } from "react";
import { DEFAULT_FILTERS } from "./constants";
import { FilterDispatchContext, FilterStateContext } from "./filter-context";
import type { FilterKey, FilterState } from "./types";

function useFilterDispatch() {
  const dispatch = useContext(FilterDispatchContext);
  if (!dispatch) {
    throw new Error("Filter hooks must be used within a <FilterProvider>.");
  }
  return dispatch;
}

function useFilterState(): FilterState {
  const state = useContext(FilterStateContext);
  if (!state) {
    throw new Error("Filter hooks must be used within a <FilterProvider>.");
  }
  return state;
}

/**
 * Full read/write access to the filter store. Use this in the
 * top-level filter bar / toolbar. Components that only need one field
 * should prefer `useFilter(key)` so they don't re-render on unrelated
 * filter changes.
 */
export function useFilters() {
  const filters = useFilterState();
  const dispatch = useFilterDispatch();

  const setFilter = useCallback(
    <K extends FilterKey>(key: K, value: FilterState[K]) => {
      dispatch({ type: "SET_FILTER", key, value });
    },
    [dispatch]
  );

  const setFilters = useCallback(
    (patch: Partial<FilterState>) => {
      dispatch({ type: "SET_MANY", patch });
    },
    [dispatch]
  );

  const resetFilter = useCallback(
    (key: FilterKey) => {
      dispatch({ type: "RESET_FILTER", key });
    },
    [dispatch]
  );

  const resetFilters = useCallback(() => {
    dispatch({ type: "RESET_ALL" });
  }, [dispatch]);

  const activeCount = useMemo(
    () => Object.keys(filters).filter((k) => filters[k as FilterKey] !== DEFAULT_FILTERS[k as FilterKey]).length,
    [filters]
  );

  const isDefault = activeCount === 0;

  return useMemo(
    () => ({ filters, setFilter, setFilters, resetFilter, resetFilters, activeCount, isDefault }),
    [filters, setFilter, setFilters, resetFilter, resetFilters, activeCount, isDefault]
  );
}

/**
 * Scoped read/write access to a single filter, e.g.:
 *
 *   const [season, setSeason] = useFilter("season");
 *
 * Only re-renders when `filters[key]` itself changes, not on unrelated
 * filter updates -- cheap to sprinkle into individual dropdowns/inputs.
 */
export function useFilter<K extends FilterKey>(key: K): [FilterState[K], (value: FilterState[K]) => void] {
  const filters = useFilterState();
  const dispatch = useFilterDispatch();

  const setValue = useCallback(
    (value: FilterState[K]) => {
      dispatch({ type: "SET_FILTER", key, value });
    },
    [dispatch, key]
  );

  return [filters[key], setValue];
}

/** True if `key` currently differs from its default ("not set") value. */
export function useIsFilterActive(key: FilterKey): boolean {
  const filters = useFilterState();
  return filters[key] !== DEFAULT_FILTERS[key];
}

/** Count of filters currently set away from their defaults. */
export function useActiveFilterCount(): number {
  const filters = useFilterState();
  return useMemo(
    () => Object.keys(filters).filter((k) => filters[k as FilterKey] !== DEFAULT_FILTERS[k as FilterKey]).length,
    [filters]
  );
}
