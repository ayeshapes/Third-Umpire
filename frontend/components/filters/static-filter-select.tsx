"use client";

/**
 * Dropdown for filters whose options are fixed enums (toss/result/
 * innings/phase) -- nothing to fetch, so no loading/error/empty
 * states needed. See ApiFilterSelect (filter-bar.tsx) for the
 * API-backed counterpart.
 */

import { useFilter, FILTER_LABELS } from "@/store/filters";
import type { FilterKey } from "@/store/filters";

export function StaticFilterSelect<T extends string | number>({
  filterKey,
  options,
  format,
}: {
  filterKey: FilterKey;
  options: readonly T[];
  format?: (v: T) => string;
}) {
  const [value, setValue] = useFilter(filterKey);

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-widest text-fg-faint">
        {FILTER_LABELS[filterKey]}
      </span>
      <select
        value={value ?? ""}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") {
            setValue(null as never);
            return;
          }
          const isNumeric = typeof options[0] === "number";
          setValue((isNumeric ? Number(raw) : raw) as never);
        }}
        className="h-10 rounded-full border border-line-strong bg-surface px-4 text-sm text-ivory focus:outline-none focus:ring-2 focus:ring-crimson-bright/50"
      >
        <option value="">Any</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {format ? format(opt) : opt}
          </option>
        ))}
      </select>
    </label>
  );
}
