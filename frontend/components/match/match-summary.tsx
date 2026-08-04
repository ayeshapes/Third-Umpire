"use client";

/**
 * Ticket 9.2 -- Match Summary.
 *
 * The header block for a single match's detail page: both teams'
 * final score line, the result sentence, and the surrounding meta
 * (venue, date, toss, Player of the Match). Everything below it on
 * the page (Timeline, Worm Graph, Manhattan, etc) explains *how* the
 * match got here -- this is the "what happened" a scorecard leads
 * with, so it sits first.
 *
 * Wired to the real backend: useMatchSummary (hooks/use-match-summary.ts)
 * reads the shared filter store, which is where the match picker (the
 * last level of the Ticket 6.7 cascade: season -> team -> player ->
 * venue -> match) writes the selected `match` id, and fetches/maps
 * `/api/matches/{match_id}/detail` -- see lib/api/match-detail.ts for
 * the response-shape mapping.
 */

import { useMatchSummary } from "@/hooks/use-match-summary";

export interface MatchSummaryTeam {
  name: string;
  short_name: string;
  runs: number;
  wickets: number; // 10 = all out
  overs: number; // e.g. 19.4
}

export interface MatchSummaryData {
  season: string;
  venue: string;
  city: string;
  date: string; // ISO date
  team1: MatchSummaryTeam;
  team2: MatchSummaryTeam;
  /** e.g. "Islamabad United won by 5 wickets" */
  result_text: string;
  toss_winner: string;
  toss_decision: "bat" | "bowl";
  player_of_match: string | null;
}

function scoreLine(team: MatchSummaryTeam): string {
  const wkts = team.wickets >= 10 ? "" : `/${team.wickets}`;
  return `${team.runs}${wkts}`;
}

function TeamRow({ team, emphasize }: { team: MatchSummaryTeam; emphasize: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={`text-sm font-medium ${emphasize ? "text-ivory" : "text-fg-muted"}`}>{team.name}</span>
      <span className={`scoreboard-digits text-xl font-semibold tabular-nums ${emphasize ? "text-ivory" : "text-fg-muted"}`}>
        {scoreLine(team)}
        <span className="ml-1.5 text-xs font-normal text-fg-faint">({team.overs} ov)</span>
      </span>
    </div>
  );
}

export function MatchSummary() {
  const { data, isLoading, isError, error, refetch, isFetching } = useMatchSummary();

  return (
    <div className="rounded-2xl border border-line-strong bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-ivory">Match Summary</h3>
        {isFetching && !isLoading && <span className="text-xs text-fg-faint">Updating…</span>}
      </div>

      {isLoading ? (
        <div role="status" aria-label="Loading match summary" className="flex flex-col gap-4">
          <div className="h-6 w-full animate-pulse rounded bg-surface-2" />
          <div className="h-6 w-full animate-pulse rounded bg-surface-2" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-surface-2" />
        </div>
      ) : isError ? (
        <div className="flex h-32 flex-col items-center justify-center gap-2 text-xs text-crimson-bright">
          <span className="text-center">{error instanceof Error ? error.message : "Failed to load match summary"}</span>
          <button type="button" onClick={() => refetch()} className="font-medium underline underline-offset-2">
            Retry
          </button>
        </div>
      ) : !data ? (
        <div className="flex h-32 items-center justify-center text-xs text-fg-faint">No match selected</div>
      ) : (
        <div className={`transition-opacity duration-150 ${isFetching ? "opacity-50" : "opacity-100"}`}>
          <div className="flex flex-col gap-3 border-b border-line-strong pb-4">
            <TeamRow team={data.team1} emphasize={data.team1.runs >= data.team2.runs} />
            <TeamRow team={data.team2} emphasize={data.team2.runs > data.team1.runs} />
          </div>

          <p className="mt-4 text-sm font-medium text-crimson-bright">{data.result_text}</p>

          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
            <div>
              <dt className="text-fg-faint">Venue</dt>
              <dd className="text-fg-muted">
                {data.venue}, {data.city}
              </dd>
            </div>
            <div>
              <dt className="text-fg-faint">Date</dt>
              <dd className="text-fg-muted">{data.date}</dd>
            </div>
            <div>
              <dt className="text-fg-faint">Season</dt>
              <dd className="text-fg-muted">{data.season}</dd>
            </div>
            <div>
              <dt className="text-fg-faint">Toss</dt>
              <dd className="text-fg-muted">
                {data.toss_winner}, chose to {data.toss_decision}
              </dd>
            </div>
            {data.player_of_match && (
              <div>
                <dt className="text-fg-faint">Player of the Match</dt>
                <dd className="text-fg-muted">{data.player_of_match}</dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </div>
  );
}
