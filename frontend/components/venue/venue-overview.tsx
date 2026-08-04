"use client";

/**
 * Ticket 10.1 -- Venue Overview.
 *
 * The header block for a single venue's page: identity (name, city,
 * country, ends) plus the top-line "how much cricket has happened
 * here" numbers -- matches hosted, date range, and a one-word pitch
 * character read (batting/bowling-friendly/balanced) that the more
 * detailed Batting/Bowling Conditions sections below justify with
 * numbers. Same role <MatchSummary> plays on the Match Insights page:
 * the "what am I looking at" frame everything else sits under.
 */

import { useChartData } from "@/hooks/use-chart-data";
import { StatCard, StatCardGrid } from "@/components/batting/stat-card";

export type PitchCharacter = "batting_friendly" | "bowling_friendly" | "balanced";

export interface VenueOverviewData {
  name: string;
  city: string;
  country: string;
  ends: [string, string] | null;
  established: number | null;
  capacity: number | null;
  matches_hosted: number;
  first_match_date: string | null;
  last_match_date: string | null;
  pitch_character: PitchCharacter;
}

export interface VenueOverviewProps {
  path: string;
}

const numberFmt = new Intl.NumberFormat("en-US");

const PITCH_LABELS: Record<PitchCharacter, string> = {
  batting_friendly: "Batting-friendly",
  bowling_friendly: "Bowling-friendly",
  balanced: "Balanced",
};

export function VenueOverview({ path }: VenueOverviewProps) {
  const { data, isLoading, isError, error, refetch } = useChartData<VenueOverviewData>(path);

  if (isError) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-crimson-bright/40 bg-surface px-4 py-3 text-xs text-crimson-bright">
        <span>{error instanceof Error ? error.message : "Failed to load venue overview"}</span>
        <button type="button" onClick={() => refetch()} className="shrink-0 font-medium underline underline-offset-2">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line-strong bg-surface p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          {isLoading ? (
            <div className="h-6 w-48 animate-pulse rounded bg-surface-2" />
          ) : (
            <>
              <h3 className="text-lg font-semibold text-ivory">{data?.name}</h3>
              <p className="text-xs text-fg-faint">
                {data?.city}
                {data?.country ? `, ${data.country}` : ""}
                {data?.ends ? ` · ${data.ends[0]} End / ${data.ends[1]} End` : ""}
              </p>
            </>
          )}
        </div>
        {!isLoading && data && (
          <span className="rounded-full border border-line-strong px-3 py-1 text-xs font-medium text-fg-muted">
            {PITCH_LABELS[data.pitch_character]}
          </span>
        )}
      </div>

      <StatCardGrid>
        <StatCard label="Matches Hosted" value={data ? numberFmt.format(data.matches_hosted) : undefined} isLoading={isLoading} />
        <StatCard label="Capacity" value={data?.capacity ? numberFmt.format(data.capacity) : "--"} isLoading={isLoading} />
        <StatCard label="Established" value={data?.established ?? "--"} isLoading={isLoading} />
        <StatCard
          label="Active Since"
          value={data?.first_match_date ?? "--"}
          sublabel={data?.last_match_date ? `Last hosted ${data.last_match_date}` : undefined}
          isLoading={isLoading}
        />
      </StatCardGrid>
    </div>
  );
}
