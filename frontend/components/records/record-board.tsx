"use client";

/**
 * Ticket 11.1 -- Records: Record Board.
 *
 * One generic component powers Batting, Bowling, Team, Season, and
 * Match Records -- all five requirements are "a set of ranked
 * top-N lists" (Most Runs, Highest Score, Biggest Win Margin, Most
 * Wickets in a Season, ...), just different endpoints returning the
 * same shape. Building five near-identical bespoke components would
 * only duplicate this rendering; the category-specific part is
 * entirely server-side (which record types exist, how they're
 * computed) -- see each RecordBoard usage in
 * app/(dashboard)/records/page.tsx for the endpoint per category.
 *
 * Deliberately distinct from <RecordsSearchTable>: this is curated
 * top-5-per-record-type browsing; the search table is the flat,
 * filterable, every-record view (Ticket 11.1's "Searchable records
 * table" requirement).
 *
 * Ticket 11.1 -- "Navigate to related players, teams, and matches":
 * each entry's name is a link when the row carries the id its
 * category needs (player_id for batting/bowling, team_id/team_code
 * for team, match_id for match -- season rows may carry either). See
 * lib/records-navigation.ts for how that id maps to a destination
 * page + filter. Rows without the relevant id (older/partial API
 * responses) just render as plain text instead of a dead link.
 */

import { useChartData } from "@/hooks/use-chart-data";
import { useRecordNavigation } from "@/hooks/use-record-navigation";
import { resolveRecordNavigation } from "@/lib/records-navigation";
import type { RecordCategory } from "@/components/records/types";

export interface RecordEntry {
  rank: number;
  /** Player name, team name, or match label ("Karachi Kings vs Lahore Qalandars") depending on record type. */
  name: string;
  team_code: string | null;
  /** Pre-formatted value, e.g. "163*", "7/12", "263/3", "Season 2023". */
  value: string;
  /** Extra context: opponent, venue, date, season -- whatever disambiguates the record. */
  context: string;
  /** Set on batting/bowling entries (and season entries crowning a player). Enables the "go to this player" link. */
  player_id?: number | string | null;
  /** Set on team entries (and season entries crowning a team). Enables the "go to this team" link. */
  team_id?: number | string | null;
  /** Set on match entries. Enables the "go to this match" link. */
  match_id?: number | string | null;
}

export interface RecordList {
  record_key: string;
  title: string;
  entries: RecordEntry[];
}

export interface RecordBoardProps {
  path: string;
  /** Which of the five record categories this board renders -- determines what an entry's name links to. */
  category: RecordCategory;
}

function RecordListCard({ list, category }: { list: RecordList; category: RecordCategory }) {
  const goToRecord = useRecordNavigation();

  return (
    <div className="rounded-2xl border border-line-strong bg-surface p-5">
      <h4 className="mb-3 text-sm font-medium text-ivory">{list.title}</h4>
      {list.entries.length === 0 ? (
        <p className="text-xs text-fg-faint">No qualifying records yet.</p>
      ) : (
        <ol className="flex flex-col gap-2.5">
          {list.entries.map((e) => {
            const navigable = Boolean(
              resolveRecordNavigation({ category, player_id: e.player_id, team_id: e.team_id, team_code: e.team_code, match_id: e.match_id })
            );
            return (
              <li key={`${list.record_key}-${e.rank}`} className="flex items-center gap-3">
                <span className={`w-5 shrink-0 text-xs font-medium tabular-nums ${e.rank === 1 ? "text-crimson-bright" : "text-fg-faint"}`}>
                  {e.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-fg-muted">
                    {navigable ? (
                      <button
                        type="button"
                        onClick={() =>
                          goToRecord({ category, player_id: e.player_id, team_id: e.team_id, team_code: e.team_code, match_id: e.match_id })
                        }
                        className={`truncate text-left hover:text-crimson-bright hover:underline ${
                          e.rank === 1 ? "font-medium text-ivory" : ""
                        }`}
                      >
                        {e.name}
                      </button>
                    ) : (
                      <span className={e.rank === 1 ? "font-medium text-ivory" : ""}>{e.name}</span>
                    )}
                    {e.team_code && <span className="ml-1.5 text-xs text-fg-faint">{e.team_code}</span>}
                  </p>
                  <p className="truncate text-xs text-fg-faint">{e.context}</p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-ivory">{e.value}</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

export function RecordBoard({ path, category }: RecordBoardProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = useChartData<RecordList[]>(path);

  if (isLoading) {
    return (
      <div role="status" aria-label="Loading records" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-48 animate-pulse rounded-2xl bg-surface-2" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-line-strong bg-surface p-8 text-xs text-crimson-bright">
        <span>{error instanceof Error ? error.message : "Failed to load records"}</span>
        <button type="button" onClick={() => refetch()} className="font-medium underline underline-offset-2">
          Retry
        </button>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-line-strong bg-surface p-8 text-xs text-fg-faint">
        No records available for the current filters
      </div>
    );
  }

  return (
    <div
      className={`grid grid-cols-1 gap-4 transition-opacity duration-150 md:grid-cols-2 xl:grid-cols-3 ${
        isFetching ? "opacity-50" : "opacity-100"
      }`}
    >
      {data.map((list) => (
        <RecordListCard key={list.record_key} list={list} category={category} />
      ))}
    </div>
  );
}
