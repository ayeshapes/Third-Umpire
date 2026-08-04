"use client";

/**
 * Ticket 10.2 -- Venue Comparison: venue picker.
 *
 * The shared filter store's `venue` field (store/filters/types.ts)
 * holds exactly one venue -- correct for scoping every other page,
 * wrong for this one, which needs *several* venues selected at once.
 * So this page keeps its own local `selectedVenueIds` state instead
 * of reading/writing the global filter store; this picker is the
 * only piece of UI that state needs.
 *
 * Reuses the same unscoped venue list the cascading filters' Venue
 * dropdown uses (lib/api/filters.ts `fetchVenueOptions`) -- no new
 * backend endpoint needed just to list venues.
 */

import { useQuery } from "@tanstack/react-query";
import { fetchVenueOptions, type VenueOption } from "@/lib/api/filters";
import { FILTER_OPTIONS_GC_TIME_MS, FILTER_OPTIONS_STALE_TIME_MS } from "@/hooks/use-filter-options";

export const MAX_COMPARE_VENUES = 4;

export interface VenueMultiSelectProps {
  selected: number[];
  onChange: (ids: number[]) => void;
}

export function VenueMultiSelect({ selected, onChange }: VenueMultiSelectProps) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["filter-options", "venues", {}],
    queryFn: ({ signal }) => fetchVenueOptions({}, signal),
    staleTime: FILTER_OPTIONS_STALE_TIME_MS,
    gcTime: FILTER_OPTIONS_GC_TIME_MS,
    retry: 2,
  });

  function toggle(venue: VenueOption) {
    const isSelected = selected.includes(venue.venue_id);
    if (isSelected) {
      onChange(selected.filter((id) => id !== venue.venue_id));
    } else if (selected.length < MAX_COMPARE_VENUES) {
      onChange([...selected, venue.venue_id]);
    }
  }

  return (
    <div className="rounded-2xl border border-line-strong bg-surface p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-ivory">Venues to Compare</h3>
        <span className="text-xs text-fg-faint">
          {selected.length} / {MAX_COMPARE_VENUES} selected
        </span>
      </div>

      {isLoading ? (
        <div role="status" aria-label="Loading venues" className="flex flex-wrap gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 w-28 animate-pulse rounded-full bg-surface-2" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex items-center justify-between gap-3 text-xs text-crimson-bright">
          <span>{error instanceof Error ? error.message : "Failed to load venues"}</span>
          <button type="button" onClick={() => refetch()} className="shrink-0 font-medium underline underline-offset-2">
            Retry
          </button>
        </div>
      ) : !data || data.length === 0 ? (
        <p className="text-xs text-fg-faint">No venues available.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {data.map((venue) => {
            const isSelected = selected.includes(venue.venue_id);
            const isDisabled = !isSelected && selected.length >= MAX_COMPARE_VENUES;
            return (
              <button
                key={venue.venue_id}
                type="button"
                disabled={isDisabled}
                onClick={() => toggle(venue)}
                aria-pressed={isSelected}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  isSelected
                    ? "border-crimson-bright bg-crimson-bright/15 text-ivory"
                    : isDisabled
                      ? "cursor-not-allowed border-line-strong text-fg-faint/50"
                      : "border-line-strong text-fg-muted hover:text-ivory"
                }`}
                title={venue.city ? `${venue.venue_name}, ${venue.city}` : venue.venue_name}
              >
                {venue.venue_name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
