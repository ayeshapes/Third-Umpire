"use client";

/**
 * Ticket 6.7 -- Cascading Filters.
 *
 *   Season -> Team/Opponent -> Player -> Venue -> Match
 *
 * Each level's options are scoped to everything selected above it:
 * changing `season` refetches teams (and, transitively, players/
 * venues/matches); changing `team` refetches players/venues/matches;
 * etc. That's "automatic updates" -- it falls out of putting the
 * upstream filter values in the query key, no extra plumbing needed.
 *
 * "Preserve valid selections / reset invalid values": after each
 * level's options load, we check whether the *current* selection at
 * that level is still in the new list. If it is, we leave it alone
 * (a season change that happens to still include the selected team
 * keeps that team selected). If it isn't, we clear it -- and
 * everything that cascades from it, since a player tied to a team
 * that just disappeared can't be valid either.
 *
 * Mount this once per page that renders cascading dropdowns (the
 * FilterBar does). It reads/writes the shared filter store, so
 * multiple mounts would just do redundant (React Query de-duplicated)
 * work rather than conflict -- but one is all you need.
 */

import { useEffect, useRef } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useFilters } from "@/store/filters";
import {
  fetchMatchOptions,
  fetchPlayerOptions,
  fetchTeamOptions,
  fetchVenueOptions,
  type MatchOption,
  type PlayerOption,
  type TeamOption,
  type VenueOption,
} from "@/lib/api/filters";
import { FILTER_OPTIONS_GC_TIME_MS, FILTER_OPTIONS_STALE_TIME_MS } from "./use-filter-options";

export interface CascadingFilterOptions {
  teams: UseQueryResult<TeamOption[]>;
  /** Same query as `teams` (season-scoped) -- opponent just excludes whichever team is already selected. */
  opponentOptions: TeamOption[];
  players: UseQueryResult<PlayerOption[]>;
  venues: UseQueryResult<VenueOption[]>;
  matches: UseQueryResult<MatchOption[]>;
}

export function useCascadingFilterOptions(): CascadingFilterOptions {
  const { filters, setFilters } = useFilters();
  const { season, team, opponent, player, venue } = filters;

  const teams = useQuery({
    queryKey: ["filter-options", "teams", { season }],
    queryFn: ({ signal }) => fetchTeamOptions({ season }, signal),
    staleTime: FILTER_OPTIONS_STALE_TIME_MS,
    gcTime: FILTER_OPTIONS_GC_TIME_MS,
    retry: 2,
  });

  const players = useQuery({
    queryKey: ["filter-options", "players", { season, team }],
    queryFn: ({ signal }) => fetchPlayerOptions({ season, team }, signal),
    staleTime: FILTER_OPTIONS_STALE_TIME_MS,
    gcTime: FILTER_OPTIONS_GC_TIME_MS,
    retry: 2,
  });

  const venues = useQuery({
    queryKey: ["filter-options", "venues", { season, team, player }],
    queryFn: ({ signal }) => fetchVenueOptions({ season, team, player }, signal),
    staleTime: FILTER_OPTIONS_STALE_TIME_MS,
    gcTime: FILTER_OPTIONS_GC_TIME_MS,
    retry: 2,
  });

  const matches = useQuery({
    queryKey: ["filter-options", "matches", { season, team, player, venue }],
    queryFn: ({ signal }) => fetchMatchOptions({ season, team, player, venue }, signal),
    staleTime: FILTER_OPTIONS_STALE_TIME_MS,
    gcTime: FILTER_OPTIONS_GC_TIME_MS,
    retry: 2,
  });

  /* ---------------------------------------------------------------- *
   * Reset invalid values. One effect per level, each only firing when
   * *that* level's data changes -- keeps the "did the current value
   * survive?" check scoped and easy to follow, rather than one big
   * effect re-running on every option list's every change.
   * ---------------------------------------------------------------- */

  useEffect(() => {
    if (!teams.data) return;
    const patch: { team?: null; opponent?: null; player?: null; venue?: null; match?: null } = {};
    if (team && !teams.data.some((t) => t.team_code === team)) patch.team = null;
    if (opponent && !teams.data.some((t) => t.team_code === opponent)) patch.opponent = null;
    if (Object.keys(patch).length > 0) {
      // Team disappearing invalidates everything that cascades from it too.
      setFilters({ ...patch, ...(patch.team !== undefined ? { player: null, venue: null, match: null } : {}) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams.data]);

  useEffect(() => {
    if (!players.data) return;
    if (player && !players.data.some((p) => String(p.player_id) === player)) {
      setFilters({ player: null, venue: null, match: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players.data]);

  useEffect(() => {
    if (!venues.data) return;
    if (venue && !venues.data.some((v) => String(v.venue_id) === venue)) {
      setFilters({ venue: null, match: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venues.data]);

  const matchRef = useRef(filters.match);
  matchRef.current = filters.match;
  useEffect(() => {
    if (!matches.data) return;
    if (matchRef.current && !matches.data.some((m) => String(m.match_id) === matchRef.current)) {
      setFilters({ match: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches.data]);

  // `opponent`'s own dropdown already excludes whichever team is picked
  // for `team` (see `opponentOptions` below), but that only stops a NEW
  // opponent selection from colliding -- it doesn't catch the reverse: the
  // `team` dropdown lists every team, so picking a team that matches the
  // *already-selected* opponent (or vice versa, e.g. after loading a
  // preset/URL that has both set to the same code) leaves the pair in an
  // invalid "team vs itself" state. Whichever field changed most recently
  // wins; the other is the one that becomes stale, so clear `opponent`.
  useEffect(() => {
    if (team && opponent && team === opponent) {
      setFilters({ opponent: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team, opponent]);

  const opponentOptions = (teams.data ?? []).filter((t) => t.team_code !== team);

  return { teams, opponentOptions, players, venues, matches };
}
