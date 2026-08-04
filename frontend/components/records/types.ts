/**
 * Ticket 11.1 -- shared record-category type.
 *
 * Both <RecordBoard> (curated top-5 boards) and <RecordsSearchTable>
 * (flat searchable view) key off the same five categories -- pulled
 * out here so neither component owns the canonical definition and
 * `records/page.tsx` / `lib/records-navigation.ts` have one place to
 * import it from instead of reaching into a sibling component's
 * internals.
 */
export type RecordCategory = "batting" | "bowling" | "team" | "season" | "match";

export const RECORD_CATEGORIES: RecordCategory[] = ["batting", "bowling", "team", "season", "match"];

export const RECORD_CATEGORY_LABELS: Record<RecordCategory, string> = {
  batting: "Batting",
  bowling: "Bowling",
  team: "Team",
  season: "Season",
  match: "Match",
};
