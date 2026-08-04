"use client";

/**
 * Centralized filter state -- React Context + reducer.
 *
 * Split into two contexts (state vs dispatch) on purpose: components
 * that only need to *write* filters (buttons, dropdown options) can
 * subscribe to FilterDispatchContext alone, whose value never changes
 * identity, so they never re-render just because the filter values
 * changed elsewhere on the page. Components that *read* filters
 * subscribe to FilterStateContext and re-render only when the state
 * itself changes.
 *
 * No backend/API calls happen here -- this is pure client state. Pages
 * decide what to do with `filters` (e.g. pass them into an API client
 * call) once that wiring exists.
 *
 * URL sync (Ticket 6.5): <FilterUrlSync> is mounted below as a child
 * of both providers so it can read/write state via context like any
 * other consumer, keeping this file the single place that knows about
 * the reducer while the URL glue itself lives in use-url-sync.tsx.
 */

import {
  createContext,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";
import { DEFAULT_FILTERS } from "./constants";
import { FilterUrlSync } from "./use-url-sync";
import type { FilterKey, FilterState } from "./types";

/* ------------------------------------------------------------------ */
/* Reducer                                                             */
/* ------------------------------------------------------------------ */

export type FilterAction =
  | { type: "SET_FILTER"; key: FilterKey; value: FilterState[FilterKey] }
  | { type: "SET_MANY"; patch: Partial<FilterState> }
  | { type: "RESET_FILTER"; key: FilterKey }
  | { type: "RESET_ALL" };

function filterReducer(state: FilterState, action: FilterAction): FilterState {
  switch (action.type) {
    case "SET_FILTER":
      if (state[action.key] === action.value) return state; // no-op, keep reference stable
      return { ...state, [action.key]: action.value };
    case "SET_MANY": {
      // Same "no-op keeps reference stable" contract as SET_FILTER above --
      // callers (URL hydration, cascading-filter resets, preset load) all
      // dispatch SET_MANY with patches that often turn out to be identical
      // to current state, and downstream consumers (React Query keys in
      // useChartData, memoized selectors) rely on `filters` only changing
      // identity when something actually changed.
      const keys = Object.keys(action.patch) as FilterKey[];
      const hasChange = keys.some((key) => state[key] !== action.patch[key]);
      if (!hasChange) return state;
      return { ...state, ...action.patch };
    }
    case "RESET_FILTER":
      if (state[action.key] === DEFAULT_FILTERS[action.key]) return state;
      return { ...state, [action.key]: DEFAULT_FILTERS[action.key] };
    case "RESET_ALL":
      return DEFAULT_FILTERS;
    default:
      return state;
  }
}

/* ------------------------------------------------------------------ */
/* Contexts                                                            */
/* ------------------------------------------------------------------ */

export const FilterStateContext = createContext<FilterState | undefined>(undefined);
export const FilterDispatchContext = createContext<Dispatch<FilterAction> | undefined>(undefined);

/* ------------------------------------------------------------------ */
/* Provider                                                             */
/* ------------------------------------------------------------------ */

export interface FilterProviderProps {
  children: ReactNode;
  /** Override defaults, e.g. to preselect a season on a season-scoped page. */
  initialFilters?: Partial<FilterState>;
  /**
   * Set false to opt a page out of URL sync (e.g. a modal/preview
   * context with no meaningful route of its own). Defaults to true.
   */
  syncWithUrl?: boolean;
}

export function FilterProvider({ children, initialFilters, syncWithUrl = true }: FilterProviderProps) {
  const [state, dispatch] = useReducer(
    filterReducer,
    initialFilters ? { ...DEFAULT_FILTERS, ...initialFilters } : DEFAULT_FILTERS
  );

  // `state` already has a stable reference across no-op dispatches (see
  // reducer above), so this memo only recomputes when something
  // actually changed.
  const memoState = useMemo(() => state, [state]);

  return (
    <FilterStateContext.Provider value={memoState}>
      <FilterDispatchContext.Provider value={dispatch}>
        {syncWithUrl && <FilterUrlSync />}
        {children}
      </FilterDispatchContext.Provider>
    </FilterStateContext.Provider>
  );
}
