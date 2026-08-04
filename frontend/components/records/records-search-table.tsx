"use client";

/**
 * Ticket 11.1 -- Searchable Records Table.
 *
 * The flat, every-record counterpart to the curated top-5 boards
 * above it on the page (<RecordBoard>, one per category): every
 * record row the backend has, in one sortable/filterable table, so
 * "did Babar Azam ever hold a bowling record" or "show me every
 * record set at Gaddafi Stadium" has somewhere to actually search
 * instead of scanning five separate category sections by eye.
 *
 * Search + category filter run client-side over whatever rows the
 * endpoint returns, same "cheap because it's already capped
 * server-side" reasoning as <BattingStatsTable>'s client-side sort.
 *
 * Ticket 11.1 -- "Navigate to related players, teams, and matches":
 * the Holder cell is a link when the row carries the id its category
 * needs, same rule and destinations as <RecordBoard> -- see
 * lib/records-navigation.ts.
 */

import { useMemo, useState } from "react";
import { useChartData } from "@/hooks/use-chart-data";
import { useRecordNavigation } from "@/hooks/use-record-navigation";
import { resolveRecordNavigation } from "@/lib/records-navigation";
import type { RecordCategory } from "@/components/records/types";

export type { RecordCategory };

export interface SearchableRecordRow {
  id: string;
  category: RecordCategory;
  record_type: string; // e.g. "Most Runs (Career)", "Best Bowling Figures", "Highest Team Total"
  holder: string; // player name, team name, or match label
  team_code: string | null;
  value: string;
  context: string; // season / venue / opponent / date
  /** Set on batting/bowling rows (and season rows crowning a player). Enables the "go to this player" link. */
  player_id?: number | string | null;
  /** Set on team rows (and season rows crowning a team). Enables the "go to this team" link. */
  team_id?: number | string | null;
  /** Set on match rows. Enables the "go to this match" link. */
  match_id?: number | string | null;
}

export interface RecordsSearchTableProps {
  path: string;
}

const CATEGORY_LABELS: Record<RecordCategory, string> = {
  batting: "Batting",
  bowling: "Bowling",
  team: "Team",
  season: "Season",
  match: "Match",
};

const CATEGORY_FILTERS: Array<RecordCategory | "all"> = ["all", "batting", "bowling", "team", "season", "match"];

type SortKey = "record_type" | "holder" | "value" | "context";

export function RecordsSearchTable({ path }: RecordsSearchTableProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = useChartData<SearchableRecordRow[]>(path);
  const goToRecord = useRecordNavigation();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<RecordCategory | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("record_type");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const rows = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    const filtered = data.filter((r) => {
      if (category !== "all" && r.category !== category) return false;
      if (!q) return true;
      return (
        r.holder.toLowerCase().includes(q) ||
        r.record_type.toLowerCase().includes(q) ||
        r.context.toLowerCase().includes(q) ||
        (r.team_code?.toLowerCase().includes(q) ?? false)
      );
    });
    const sorted = [...filtered].sort((a, b) => {
      const av = a[sortKey].toLowerCase();
      const bv = b[sortKey].toLowerCase();
      return av.localeCompare(bv);
    });
    return sortDir === "desc" ? sorted.reverse() : sorted;
  }, [data, search, category, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  return (
    <div className="rounded-2xl border border-line-strong bg-surface p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-medium text-ivory">All Records</h3>
        {isFetching && !isLoading && <span className="text-xs text-fg-faint">Updating…</span>}
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search player, team, venue, record…"
          aria-label="Search records"
          className="w-full rounded-xl border border-line-strong bg-surface-2 px-3 py-2 text-sm text-ivory placeholder:text-fg-faint focus:outline-none focus:ring-2 focus:ring-crimson/30 sm:max-w-xs"
        />
        <div className="flex flex-wrap gap-1.5">
          {CATEGORY_FILTERS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              aria-pressed={category === c}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                category === c ? "border-crimson-bright bg-crimson-bright/15 text-ivory" : "border-line-strong text-fg-muted hover:text-ivory"
              }`}
            >
              {c === "all" ? "All" : CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div role="status" aria-label="Loading records" className="flex flex-col gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-9 w-full animate-pulse rounded-lg bg-surface-2" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex h-32 flex-col items-center justify-center gap-2 text-xs text-crimson-bright">
          <span className="text-center">{error instanceof Error ? error.message : "Failed to load records"}</span>
          <button type="button" onClick={() => refetch()} className="font-medium underline underline-offset-2">
            Retry
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-xs text-fg-faint">
          {search || category !== "all" ? "No records match your search." : "No records available for the current filters."}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line-strong bg-surface-2/50 text-left text-xs uppercase tracking-widest text-fg-faint">
                <th scope="col" className="py-2.5 pr-4 font-semibold">
                  Category
                </th>
                {(
                  [
                    ["record_type", "Record"],
                    ["holder", "Holder"],
                    ["value", "Value"],
                    ["context", "Context"],
                  ] as const
                ).map(([key, label]) => (
                  <th key={key} scope="col" className="py-2 pr-4 font-medium">
                    <button
                      type="button"
                      onClick={() => toggleSort(key)}
                      className="flex items-center gap-1 whitespace-nowrap hover:text-ivory"
                      aria-label={`Sort by ${label}`}
                    >
                      {label}
                      {sortKey === key && <span aria-hidden="true">{sortDir === "asc" ? "▴" : "▾"}</span>}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className={isFetching ? "opacity-50 transition-opacity duration-150" : "opacity-100"}>
              {rows.map((row) => {
                const navigable = Boolean(
                  resolveRecordNavigation({
                    category: row.category,
                    player_id: row.player_id,
                    team_id: row.team_id,
                    team_code: row.team_code,
                    match_id: row.match_id,
                  })
                );
                return (
                  <tr key={row.id} className="border-b border-line-strong/60 text-fg-muted transition-colors last:border-0 hover:bg-surface-2/40">
                    <td className="py-2 pr-4">
                      <span className="rounded-full border border-line-strong px-2 py-0.5 text-xs">{CATEGORY_LABELS[row.category]}</span>
                    </td>
                    <td className="py-2 pr-4">{row.record_type}</td>
                    <td className="py-2 pr-4 text-ivory">
                      {navigable ? (
                        <button
                          type="button"
                          onClick={() =>
                            goToRecord({
                              category: row.category,
                              player_id: row.player_id,
                              team_id: row.team_id,
                              team_code: row.team_code,
                              match_id: row.match_id,
                            })
                          }
                          className="text-left hover:text-crimson-bright hover:underline"
                        >
                          {row.holder}
                        </button>
                      ) : (
                        row.holder
                      )}
                      {row.team_code && <span className="ml-1.5 text-xs text-fg-faint">{row.team_code}</span>}
                    </td>
                    <td className="py-2 pr-4 font-medium tabular-nums text-ivory">{row.value}</td>
                    <td className="py-2 pr-4 text-xs text-fg-faint">{row.context}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-fg-faint">
            {rows.length} record{rows.length === 1 ? "" : "s"}
            {search || category !== "all" ? ` matching` : ""}
          </p>
        </div>
      )}
    </div>
  );
}
