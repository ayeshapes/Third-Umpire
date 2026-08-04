"use client";

/**
 * Team Comparison Studio: Shared Visualizations -- Recent Form Guide.
 *
 * Each team's last several results (any opponent, not just the other
 * side selected -- that's <HeadToHeadMeetings>'s job) as a compact
 * W/L/N strip, oldest to newest. Pairs with the radar chart as the
 * second "shared" visualization: together they answer "what do these
 * teams look like right now" independent of the specific matchup,
 * which none of the per-section comparisons above are built to show.
 */

import { useTeamComparison } from "@/hooks/use-team-comparison";

export type FormResult = "W" | "L" | "N";

export interface TeamFormGuide {
  team_code: string;
  results: { match_id: number; result: FormResult; opponent_code: string; match_date: string }[];
}

export interface FormGuideData {
  team_a: TeamFormGuide;
  team_b: TeamFormGuide;
}

export interface FormGuideProps {
  path: string;
  teamAId: number | null;
  teamBId: number | null;
}

const RESULT_CLASSES: Record<FormResult, string> = {
  W: "bg-crimson-bright text-charcoal",
  L: "bg-surface-2 text-fg-faint",
  N: "border border-line-strong text-fg-faint",
};

function FormRow({ guide, accentClass }: { guide: TeamFormGuide; accentClass: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className={`text-xs font-medium ${accentClass}`}>{guide.team_code}</span>
      <div className="flex flex-wrap gap-1.5">
        {guide.results.length === 0 ? (
          <span className="text-xs text-fg-faint">No recent matches</span>
        ) : (
          guide.results.map((r) => (
            <span
              key={r.match_id}
              title={`vs ${r.opponent_code}, ${r.match_date}`}
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded text-[11px] font-semibold ${RESULT_CLASSES[r.result]}`}
            >
              {r.result}
            </span>
          ))
        )}
      </div>
    </div>
  );
}

export function FormGuide({ path, teamAId, teamBId }: FormGuideProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = useTeamComparison<FormGuideData>(path, teamAId, teamBId);

  if (teamAId === null || teamBId === null) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-line-strong bg-surface px-6 py-12 text-center text-xs text-fg-faint">
        Pick two teams above to see their recent form.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line-strong bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-ivory">Recent Form Guide</h3>
        {isFetching && !isLoading && <span className="text-xs text-fg-faint">Updating…</span>}
      </div>

      {isLoading ? (
        <div role="status" aria-label="Loading recent form guide" className="flex flex-col gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-6 w-full animate-pulse rounded bg-surface-2" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex h-24 flex-col items-center justify-center gap-2 text-xs text-crimson-bright">
          <span className="text-center">{error instanceof Error ? error.message : "Failed to load recent form guide"}</span>
          <button type="button" onClick={() => refetch()} className="font-medium underline underline-offset-2">
            Retry
          </button>
        </div>
      ) : !data ? (
        <div className="flex h-24 items-center justify-center text-xs text-fg-faint">No recent form data for these teams</div>
      ) : (
        <div className={`flex flex-col gap-4 transition-opacity duration-150 ${isFetching ? "opacity-50" : "opacity-100"}`}>
          <FormRow guide={data.team_a} accentClass="text-crimson-bright" />
          <FormRow guide={data.team_b} accentClass="text-ivory" />
          <p className="text-[10px] text-fg-faint">Oldest → newest, left to right. W win · L loss · N no result</p>
        </div>
      )}
    </div>
  );
}
