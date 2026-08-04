"use client";

/**
 * Ticket 6.8 -- range control for the three weather filters that
 * aren't a fixed enum (Temperature/Humidity/Wind Speed): two number
 * inputs writing into a min/max pair of FilterState keys (see
 * RANGE_FILTER_GROUPS in store/filters/constants.ts).
 *
 * `bounds` (fetched via hooks/use-filter-options.ts -- useWeatherRanges)
 * sets the min/max/placeholder on the inputs so the control reflects
 * the actual observed data range instead of an arbitrary guess -- but
 * is optional, since the control still works (just without
 * placeholders) while that query is loading.
 */

import { useFilter } from "@/store/filters";
import type { RangeFilterGroupKey } from "@/store/filters";
import { RANGE_FILTER_GROUPS } from "@/store/filters/constants";

export interface RangeBounds {
  min: number | null;
  max: number | null;
}

function toNullableNumber(raw: string): number | null {
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
}

export function RangeFilterControl({
  group,
  label,
  bounds,
  isLoadingBounds,
  className,
}: {
  group: RangeFilterGroupKey;
  label: string;
  bounds?: RangeBounds;
  isLoadingBounds?: boolean;
  /** Extra classes for the outer wrapper -- lets a parent grid control
   *  how much width this control gets (e.g. a wider span on mobile,
   *  since it packs two inputs) without this component needing to know
   *  about that grid. */
  className?: string;
}) {
  const { min: minKey, max: maxKey, unit } = RANGE_FILTER_GROUPS[group];
  const [minValue, setMinValue] = useFilter(minKey);
  const [maxValue, setMaxValue] = useFilter(maxKey);

  // Keep min <= max: an inverted range is never intentional (it just
  // silently matches nothing once sent to the backend), so clamp the
  // *other* bound instead of letting the two cross. The field the person
  // is actively editing always keeps the value they typed.
  function handleMinChange(raw: string) {
    const next = toNullableNumber(raw);
    setMinValue(next as never);
    if (next !== null && maxValue !== null && next > maxValue) {
      setMaxValue(next as never);
    }
  }

  function handleMaxChange(raw: string) {
    const next = toNullableNumber(raw);
    setMaxValue(next as never);
    if (next !== null && minValue !== null && next < minValue) {
      setMinValue(next as never);
    }
  }

  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <span className="text-xs font-medium uppercase tracking-widest text-fg-faint">
        {label} {unit ? `(${unit})` : ""}
      </span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          aria-label={`Minimum ${label}`}
          value={minValue ?? ""}
          placeholder={isLoadingBounds ? "…" : bounds?.min != null ? String(bounds.min) : "Min"}
          min={bounds?.min ?? undefined}
          max={bounds?.max ?? undefined}
          onChange={(e) => handleMinChange(e.target.value)}
          className="h-10 w-full min-w-0 rounded-full border border-line-strong bg-surface px-4 text-sm text-ivory focus:outline-none focus:ring-2 focus:ring-crimson-bright/50"
        />
        <span className="text-xs text-fg-faint">to</span>
        <input
          type="number"
          inputMode="decimal"
          aria-label={`Maximum ${label}`}
          value={maxValue ?? ""}
          placeholder={isLoadingBounds ? "…" : bounds?.max != null ? String(bounds.max) : "Max"}
          min={bounds?.min ?? undefined}
          max={bounds?.max ?? undefined}
          onChange={(e) => handleMaxChange(e.target.value)}
          className="h-10 w-full min-w-0 rounded-full border border-line-strong bg-surface px-4 text-sm text-ivory focus:outline-none focus:ring-2 focus:ring-crimson-bright/50"
        />
      </div>
    </div>
  );
}
