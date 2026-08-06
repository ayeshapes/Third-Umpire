/**
 * The DB's `raw_cricsheet.player_role` enum has 4 values: 'batter',
 * 'bowler', 'allrounder', 'wicketkeeper' (database/psl_schema.sql).
 * `roleLabel` just prettifies that raw value for display -- it doesn't
 * change what category a player falls into.
 */

const ROLE_LABELS: Record<string, string> = {
  batter: "Batter",
  bowler: "Bowler",
  wicketkeeper: "Wicketkeeper",
  allrounder: "All-Rounder",
};

/**
 * Maps a raw `primary_role` value from the API (lowercase enum string,
 * e.g. "bowler") to the label to show in the UI. Returns null for
 * null/unrecognized input so callers can keep their existing `??`
 * fallback chains (e.g. `roleLabel(p.primary_role) ?? p.nationality`).
 */
export function roleLabel(role: string | null | undefined): string | null {
  if (!role) return null;
  return ROLE_LABELS[role.toLowerCase()] ?? null;
}

/** Below this average overs bowled per match, a player isn't a "real" bowler for display purposes. */
const BOWLER_OVERS_PER_MATCH_THRESHOLD = 3;

/**
 * Product rule: anyone who's bowled a meaningful workload (~3+ overs a
 * match on average) should show as "Bowler" regardless of what the DB's
 * primary_role says -- including players tagged 'batter'. Everyone else
 * (including allrounders who don't clear the bar) falls back to the
 * plain roleLabel() mapping, so 'allrounder' still reads "All-Rounder"
 * unless their bowling workload earns them the "Bowler" override.
 *
 * Requires real bowling numbers, not just the role string -- only call
 * this where avgOversBowledPerMatch is actually available (currently
 * just the player detail page's /api/players/{id} response, which
 * computes it as total balls bowled / matches / 6). Search/list
 * surfaces that only have `primary_role` and no stats should use
 * roleLabel() directly instead.
 */
export function effectiveRoleLabel(
  primaryRole: string | null | undefined,
  avgOversBowledPerMatch: number | null | undefined
): string | null {
  if (avgOversBowledPerMatch != null && avgOversBowledPerMatch >= BOWLER_OVERS_PER_MATCH_THRESHOLD) {
    return "Bowler";
  }
  return roleLabel(primaryRole);
}
