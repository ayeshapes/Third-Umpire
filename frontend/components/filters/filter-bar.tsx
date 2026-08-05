"use client";

/**
 * Connect Filter Bar to APIs + Ticket 6.7 (Cascading Filters).
 *
 * Season -> Team/Opponent -> Player -> Venue -> Match dropdowns are
 * all populated from backend/app/routers/filters.py and cascade off
 * each other via hooks/use-cascading-filters.ts (which also owns the
 * "reset invalid values" behavior). City stays independent/unscoped
 * (hooks/use-filter-options.ts). Toss/Result/Innings/Phase are static
 * enums rendered with <StaticFilterSelect>.
 *
 * Ticket 6.8 (Advanced Filter Categories) adds: Toss Winner (reuses
 * the season-scoped team list -- <TeamArraySelect>), Batting Order,
 * and Day/Night (static enums -- <StaticFilterSelect>).
 *
 * Weather condition + Temperature/Humidity/Wind Speed range sliders
 * are pulled from the bar for launch -- backend data isn't solid yet
 * (see backend/app/routers/filters.py get_weather_range_filters).
 * Coming soon.
 *
 * Every dropdown here shares loading/error/empty/retry rendering via
 * <ApiFilterSelect> -- React Query owns loading/error/empty/retry/
 * cache; this component just renders whichever state a given query is
 * in.
 *
 * `fields` + collapsible mode: originally every page that used this
 * bar got the exact same 14-filter grid whether or not most of those
 * filters were relevant there (e.g. Venue Intelligence showed Player/
 * Match/Toss Winner alongside Venue). Pass `fields` to render only
 * the filters that matter for that page; omit it for the full set
 * (unchanged default, so existing call sites keep working). The bar
 * is also collapsed by default behind a small toggle instead of
 * always taking up the full width at the top of the page -- expand it
 * when you actually want to filter.
 */

import { useState, type ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { SlidersHorizontal, ChevronDown } from "lucide-react";
import { useFilter, useFilters, FILTER_LABELS } from "@/store/filters";
import type { FilterKey } from "@/store/filters";
import { Button } from "@/components/ui/button";
import { StaticFilterSelect } from "./static-filter-select";
import { useCityOptions, useSeasonOptions } from "@/hooks/use-filter-options";
import { useCascadingFilterOptions } from "@/hooks/use-cascading-filters";
import type { TeamOption } from "@/lib/api/filters";

const TOSS_OPTIONS = ["bat", "bowl"] as const;
const RESULT_OPTIONS = ["won", "lost", "tied", "no_result"] as const;
const INNINGS_OPTIONS = [1, 2] as const;
const PHASE_OPTIONS = ["powerplay", "middle", "death"] as const;

// Ticket 6.8 -- Advanced Filter Categories
const DAY_NIGHT_OPTIONS = ["day", "day_night", "night"] as const;
const BATTING_ORDER_OPTIONS = ["batting_first", "chasing"] as const;

/* ------------------------------------------------------------------ */
/* API-backed select: loading / error / empty / retry                  */
/* ------------------------------------------------------------------ */

interface ApiFilterSelectProps<T> {
  filterKey: FilterKey;
  query: UseQueryResult<T[]>;
  getValue: (item: T) => string;
  getLabel: (item: T) => ReactNode;
  /** True once at least one filter above this one in the cascade is set but has produced no options -- lets us say *why* it's empty. */
  disabledHint?: string;
}

function ApiFilterSelect<T>({ filterKey, query, getValue, getLabel, disabledHint }: ApiFilterSelectProps<T>) {
  const [value, setValue] = useFilter(filterKey);
  const { data, isLoading, isError, error, refetch, isFetching } = query;
  const label = FILTER_LABELS[filterKey];

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-widest text-fg-faint">{label}</span>

      {isLoading ? (
        // Loading state
        <div
          role="status"
          aria-label={`Loading ${label.toLowerCase()} options`}
          className="h-10 w-full animate-pulse rounded-full border border-line-strong bg-surface-2"
        />
      ) : isError ? (
        // Error state + retry
        <div className="flex h-10 items-center justify-between gap-2 rounded-full border border-crimson-bright/40 bg-surface px-4 text-xs text-crimson-bright">
          <span className="truncate">{error instanceof Error ? error.message : "Failed to load"}</span>
          <button
            type="button"
            onClick={() => refetch()}
            className="shrink-0 font-medium underline underline-offset-2 hover:text-crimson-bright/80"
          >
            Retry
          </button>
        </div>
      ) : !data || data.length === 0 ? (
        // Empty state
        <div className="flex h-10 items-center rounded-full border border-line-strong bg-surface px-4 text-xs text-fg-faint">
          {disabledHint ?? `No ${label.toLowerCase()} available`}
        </div>
      ) : (
        <select
          value={value ?? ""}
          onChange={(e) => setValue((e.target.value || null) as never)}
          disabled={isFetching}
          className="h-10 rounded-full border border-line-strong bg-surface px-4 text-sm text-ivory focus:outline-none focus:ring-2 focus:ring-crimson-bright/50 disabled:opacity-60"
        >
          <option value="">Any</option>
          {data.map((item) => (
            <option key={getValue(item)} value={getValue(item)}>
              {getLabel(item)}
            </option>
          ))}
        </select>
      )}
    </label>
  );
}

/** Team/Opponent variant that renders from a plain array (opponent excludes the selected team client-side) instead of a query result directly. */
function TeamArraySelect({
  filterKey,
  teams,
  isLoading,
}: {
  filterKey: FilterKey;
  teams: TeamOption[];
  isLoading: boolean;
}) {
  const [value, setValue] = useFilter(filterKey);
  const label = FILTER_LABELS[filterKey];

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-widest text-fg-faint">{label}</span>
      {isLoading ? (
        <div className="h-10 w-full animate-pulse rounded-full border border-line-strong bg-surface-2" />
      ) : teams.length === 0 ? (
        <div className="flex h-10 items-center rounded-full border border-line-strong bg-surface px-4 text-xs text-fg-faint">
          No {label.toLowerCase()} available
        </div>
      ) : (
        <select
          value={value ?? ""}
          onChange={(e) => setValue((e.target.value || null) as never)}
          className="h-10 rounded-full border border-line-strong bg-surface px-4 text-sm text-ivory focus:outline-none focus:ring-2 focus:ring-crimson-bright/50"
        >
          <option value="">Any</option>
          {teams.map((t) => (
            <option key={t.team_code} value={t.team_code}>
              {t.team_name}
            </option>
          ))}
        </select>
      )}
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Filter bar                                                          */
/* ------------------------------------------------------------------ */

/** Every filter this bar knows how to render -- the default when `fields` is omitted. */
const ALL_FIELDS: FilterKey[] = [
  "season", "team", "opponent", "player", "venue", "match", "city",
  "toss", "result", "innings", "phase", "tossWinner", "battingOrder", "dayNight",
];

interface FilterBarProps {
  /** Which filters to show, in order. Omit for the full 14-filter set (previous behavior). */
  fields?: FilterKey[];
  /** Render collapsed behind a toggle instead of always expanded. Default true. */
  collapsible?: boolean;
  /** Only relevant when collapsible -- start expanded. Default false. */
  defaultOpen?: boolean;
}

export function FilterBar({ fields, collapsible = true, defaultOpen = false }: FilterBarProps) {
  const [open, setOpen] = useState(defaultOpen);
  const seasons = useSeasonOptions();
  const cities = useCityOptions();
  const { teams, opponentOptions, players, venues, matches } = useCascadingFilterOptions();
  const { filters, resetFilters, activeCount, isDefault } = useFilters();

  const active = new Set(fields ?? ALL_FIELDS);
  const show = (key: FilterKey) => active.has(key);
  const expanded = !collapsible || open;

  return (
    <div>
      {collapsible && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface px-4 py-2 text-sm font-medium text-ivory transition-colors hover:border-crimson-bright/50"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {activeCount > 0 && (
            <span className="rounded-full bg-crimson-bright/20 px-2 py-0.5 text-xs font-semibold text-crimson-bright">
              {activeCount}
            </span>
          )}
          <ChevronDown className={`h-4 w-4 text-fg-faint transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      )}

      {expanded && (
        <div className={collapsible ? "mt-4" : undefined}>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {/* Cascade level 1: independent */}
            {show("season") && (
              <ApiFilterSelect
                filterKey="season"
                query={seasons}
                getValue={(s) => String(s.season_year)}
                getLabel={(s) => s.season_year}
              />
            )}

            {/* Cascade level 2: scoped to season */}
            {show("team") && <TeamArraySelect filterKey="team" teams={teams.data ?? []} isLoading={teams.isLoading} />}
            {show("opponent") && (
              <TeamArraySelect filterKey="opponent" teams={opponentOptions} isLoading={teams.isLoading} />
            )}

            {/* Cascade level 3: scoped to season + team */}
            {show("player") && (
              <ApiFilterSelect
                filterKey="player"
                query={players}
                getValue={(p) => String(p.player_id)}
                getLabel={(p) => p.display_name ?? p.full_name}
                disabledHint={filters.team ? "No players for this team/season" : "No players available"}
              />
            )}

            {/* Cascade level 4: scoped to season + team + player */}
            {show("venue") && (
              <ApiFilterSelect
                filterKey="venue"
                query={venues}
                getValue={(v) => String(v.venue_id)}
                getLabel={(v) => v.venue_name}
                disabledHint="No venues match the current filters"
              />
            )}

            {/* Cascade level 5 (bottom): scoped to everything above */}
            {show("match") && (
              <ApiFilterSelect
                filterKey="match"
                query={matches}
                getValue={(m) => String(m.match_id)}
                getLabel={(m) => `${m.team1_name} vs ${m.team2_name} -- ${m.match_date}`}
                disabledHint="No matches match the current filters"
              />
            )}

            {/* Independent of the cascade */}
            {show("city") && (
              <ApiFilterSelect filterKey="city" query={cities} getValue={(c) => c} getLabel={(c) => c} />
            )}

            {show("toss") && (
              <StaticFilterSelect
                filterKey="toss"
                options={TOSS_OPTIONS}
                format={(v) => (v === "bat" ? "Bat first" : "Bowl first")}
              />
            )}
            {show("result") && (
              <StaticFilterSelect
                filterKey="result"
                options={RESULT_OPTIONS}
                format={(v) => (v === "no_result" ? "No result" : v[0].toUpperCase() + v.slice(1))}
              />
            )}
            {show("innings") && (
              <StaticFilterSelect
                filterKey="innings"
                options={INNINGS_OPTIONS}
                format={(v) => `${v === 1 ? "1st" : "2nd"} innings`}
              />
            )}
            {show("phase") && (
              <StaticFilterSelect
                filterKey="phase"
                options={PHASE_OPTIONS}
                format={(v) => (v === "powerplay" ? "Powerplay" : v === "middle" ? "Middle overs" : "Death overs")}
              />
            )}

            {/* Ticket 6.8: Advanced Filter Categories ------------------- */}

            {/* Same season-scoped team list as Team/Opponent above -- a toss winner is just a team. */}
            {show("tossWinner") && (
              <TeamArraySelect filterKey="tossWinner" teams={teams.data ?? []} isLoading={teams.isLoading} />
            )}

            {show("battingOrder") && (
              <StaticFilterSelect
                filterKey="battingOrder"
                options={BATTING_ORDER_OPTIONS}
                format={(v) => (v === "batting_first" ? "Batting first" : "Chasing")}
              />
            )}

            {show("dayNight") && (
              <StaticFilterSelect
                filterKey="dayNight"
                options={DAY_NIGHT_OPTIONS}
                format={(v) => (v === "day" ? "Day" : v === "night" ? "Night" : "Day/Night")}
              />
            )}

            {/* Weather condition + Temperature/Humidity/Wind Speed sliders --
                pulled for launch (backend data isn't solid yet, see
                backend/app/routers/filters.py get_weather_range_filters).
                Coming soon. */}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button variant="outline" size="sm" disabled={isDefault} onClick={resetFilters}>
              Reset all
            </Button>
            <span className="text-xs text-fg-faint">
              {activeCount} filter{activeCount === 1 ? "" : "s"} active
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
