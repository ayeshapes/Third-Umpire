"use client";

/**
 * Team Comparison Studio: Head-to-Head -- Recent Meetings.
 *
 * The record in <HeadToHeadSummary> answers "who wins overall"; this
 * answers "show me" -- the actual scorelines, most recent first, so a
 * pattern (e.g. a lopsided recent run despite an even all-time record)
 * is visible without leaving the page.
 */

import { useMemo } from "react";
import { useTeamHeadToHead } from "@/hooks/use-team-head-to-head";
import { toHeadToHeadMeetings } from "@/lib/api/team-head-to-head";

export interface HeadToHeadMeeting {
  match_id: number;
  match_date: string;
  season_year: number;
  venue_name: string;
  team_a_score: string; // pre-formatted, e.g. "187/6"
  team_b_score: string;
  winner_team_code: string | null; // null for no-result/tied
  margin: string | null; // pre-formatted, e.g. "24 runs" / "5 wickets"
}

export interface HeadToHeadMeetingsData {
  team_a_code: string;
  team_b_code: string;
  meetings: HeadToHeadMeeting[];
}

export interface HeadToHeadMeetingsProps {
  teamAId: number | null;
  teamBId: number | null;
}

export function HeadToHeadMeetings({ teamAId, teamBId }: HeadToHeadMeetingsProps) {
  const { data: raw, isLoading, isError, error, refetch, isFetching } = useTeamHeadToHead(teamAId, teamBId);
  const data = useMemo(() => (raw ? toHeadToHeadMeetings(raw.raw, raw.teamA, raw.teamB) : null), [raw]);

  if (teamAId === null || teamBId === null) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-line-strong bg-surface px-6 py-12 text-center text-xs text-fg-faint">
        Pick two teams above to see their recent meetings.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line-strong bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-ivory">Recent Meetings</h3>
        {isFetching && !isLoading && <span className="text-xs text-fg-faint">Updating…</span>}
      </div>

      {isLoading ? (
        <div role="status" aria-label="Loading recent meetings" className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 w-full animate-pulse rounded bg-surface-2" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 text-xs text-crimson-bright">
          <span className="text-center">{error instanceof Error ? error.message : "Failed to load recent meetings"}</span>
          <button type="button" onClick={() => refetch()} className="font-medium underline underline-offset-2">
            Retry
          </button>
        </div>
      ) : !data || data.meetings.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-xs text-fg-faint">No recorded meetings between these teams</div>
      ) : (
        <div className={`overflow-x-auto transition-opacity duration-150 ${isFetching ? "opacity-50" : "opacity-100"}`}>
          <table className="w-full min-w-[420px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line-strong text-left text-xs uppercase tracking-widest text-fg-faint">
                <th scope="col" className="py-2 pr-4 font-medium">
                  Match
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Venue
                </th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">
                  Score
                </th>
                <th scope="col" className="py-2 pl-4 text-right font-medium">
                  Result
                </th>
              </tr>
            </thead>
            <tbody>
              {data.meetings.map((m) => (
                <tr key={m.match_id} className="border-b border-line-strong/60 last:border-0">
                  <td className="whitespace-nowrap py-2 pr-4 text-fg-muted">
                    {m.match_date} <span className="text-fg-faint">· S{m.season_year}</span>
                  </td>
                  <td className="max-w-[160px] truncate py-2 pr-4 text-fg-faint" title={m.venue_name}>
                    {m.venue_name}
                  </td>
                  <td className="whitespace-nowrap py-2 pr-4 text-right tabular-nums text-fg-muted">
                    {m.team_a_score} <span className="text-fg-faint">·</span> {m.team_b_score}
                  </td>
                  <td className="whitespace-nowrap py-2 pl-4 text-right">
                    {m.winner_team_code ? (
                      <span
                        className={`font-medium ${
                          m.winner_team_code === data.team_a_code ? "text-crimson-bright" : "text-ivory"
                        }`}
                      >
                        {m.winner_team_code} won{m.margin ? ` · ${m.margin}` : ""}
                      </span>
                    ) : (
                      <span className="text-fg-faint">No result</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
