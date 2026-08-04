/**
 * Ticket 11.1 -- "Navigate to related players, teams, and matches".
 *
 * This codebase has no per-entity detail routes (no /players/[id],
 * /teams/[id], /matches/[id]) -- every entity page (Batting, Bowling,
 * Matches, Venues) is instead one template driven by the shared
 * filter store (see store/filters), same reasoning as Match Insights'
 * and Venue Intelligence's own docstrings ("one page template driven
 * by the filter, rather than a route per id"). So "navigating to a
 * player/team/match" here means the same thing it means everywhere
 * else in the app: set the relevant filter(s) and route to whichever
 * existing page reads that filter.
 *
 * Mapping, per record category:
 *   - batting record entry -> set `player` (+ `team`) -> /batting
 *   - bowling record entry -> set `player` (+ `team`) -> /bowling
 *   - team record entry    -> set `team`              -> /batting
 *       (no standalone Teams page exists in this slice; the Batting
 *       leaderboard scoped to one team is the closest "team page" --
 *       every player on that team, sortable/filterable, same table
 *       Ticket 7.1 already built)
 *   - match record entry   -> set `match`              -> /matches
 *   - season record entry  -> whichever of player/team the row
 *     actually identifies (season records can crown either), same
 *     targets as above
 *
 * Entries that don't carry an id for their category (older/partial
 * API responses) resolve to `null` -- callers render that entry as
 * plain (non-clickable) text instead of a broken link.
 */

import type { RecordCategory } from "@/components/records/types";
import type { FilterState } from "@/store/filters";

export interface RecordNavigationInput {
  category: RecordCategory;
  /** Present on batting/bowling/season-by-player entries. */
  player_id?: number | string | null;
  /** Present on team/season-by-team entries, and alongside player_id for team_code context. */
  team_id?: number | string | null;
  team_code?: string | null;
  /** Present on match entries. */
  match_id?: number | string | null;
}

export interface RecordNavigationTarget {
  href: "/batting" | "/bowling" | "/venues" | "/matches";
  filters: Partial<FilterState>;
}

export function resolveRecordNavigation(input: RecordNavigationInput): RecordNavigationTarget | null {
  const { category, player_id, team_id, team_code, match_id } = input;
  const teamValue = team_code ?? (team_id != null ? String(team_id) : null);

  if (category === "match") {
    return match_id != null ? { href: "/matches", filters: { match: String(match_id) } } : null;
  }

  if (category === "batting" || category === "bowling") {
    if (player_id == null) return null;
    return {
      href: category === "bowling" ? "/bowling" : "/batting",
      filters: { player: String(player_id), team: teamValue },
    };
  }

  if (category === "team") {
    return teamValue ? { href: "/batting", filters: { team: teamValue, player: null } } : null;
  }

  // "season" records can crown either a player or a team -- prefer
  // whichever id the row actually carries.
  if (category === "season") {
    if (player_id != null) return { href: "/batting", filters: { player: String(player_id), team: teamValue } };
    if (teamValue) return { href: "/batting", filters: { team: teamValue, player: null } };
    return null;
  }

  return null;
}
