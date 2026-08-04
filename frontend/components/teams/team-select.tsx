"use client";

/**
 * Team Comparison Studio: team picker.
 *
 * Chips rather than the player picker's type-to-filter search
 * (components/players/player-select.tsx) -- the team universe is a
 * short, fixed list (one league's franchises), the same reasoning
 * components/venue/venue-multi-select.tsx uses for venues. Two single-
 * select chip rows (Team A / Team B) rather than that component's
 * multi-select list, though: a comparison always has exactly two
 * sides, not 2-4.
 *
 * Local state, not the shared filter store: the store's `team` field
 * (plus `opponent`) is a single pair used to scope every *other* page
 * (store/filters/types.ts) -- correct there, wrong here, which needs
 * two independent selections that persist as you flip the shared
 * filter bar above. lib/api/teams.ts layers these two IDs on top of
 * the store's remaining fields for the "Shared filters" requirement.
 */

import { useQuery } from "@tanstack/react-query";
import { fetchTeamOptions, type TeamOption } from "@/lib/api/filters";
import { FILTER_OPTIONS_GC_TIME_MS, FILTER_OPTIONS_STALE_TIME_MS } from "@/hooks/use-filter-options";

interface TeamChipRowProps {
  label: string;
  accentClassName: string;
  teams: TeamOption[];
  selectedId: number | null;
  excludeId: number | null;
  onSelect: (team: TeamOption) => void;
}

function TeamChipRow({ label, accentClassName, teams, selectedId, excludeId, onSelect }: TeamChipRowProps) {
  return (
    <div className="flex-1">
      <div className="mb-2 flex items-center gap-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${accentClassName}`} />
        <span className="text-xs font-medium uppercase tracking-widest text-fg-faint">{label}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {teams.map((team) => {
          const isSelected = selectedId === team.team_id;
          const isDisabled = excludeId === team.team_id;
          return (
            <button
              key={team.team_id}
              type="button"
              disabled={isDisabled}
              onClick={() => onSelect(team)}
              aria-pressed={isSelected}
              title={team.team_name}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                isSelected
                  ? "border-crimson-bright bg-crimson-bright/15 text-ivory"
                  : isDisabled
                    ? "cursor-not-allowed border-line-strong text-fg-faint/50"
                    : "border-line-strong text-fg-muted hover:text-ivory"
              }`}
            >
              {team.team_code}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export interface TeamSelectProps {
  teamAId: number | null;
  teamBId: number | null;
  onChangeA: (id: number | null) => void;
  onChangeB: (id: number | null) => void;
}

export function TeamSelect({ teamAId, teamBId, onChangeA, onChangeB }: TeamSelectProps) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["filter-options", "teams", {}],
    queryFn: ({ signal }) => fetchTeamOptions({}, signal),
    staleTime: FILTER_OPTIONS_STALE_TIME_MS,
    gcTime: FILTER_OPTIONS_GC_TIME_MS,
    retry: 2,
  });

  return (
    <div className="rounded-2xl border border-line-strong bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-ivory">Teams to Compare</h3>
        {teamAId !== null && teamBId !== null && teamAId === teamBId && (
          <span className="text-xs text-crimson-bright">Pick two different teams</span>
        )}
      </div>

      {isLoading ? (
        <div role="status" aria-label="Loading teams" className="flex flex-col gap-4">
          {Array.from({ length: 2 }).map((_, row) => (
            <div key={row} className="flex flex-wrap gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-7 w-16 animate-pulse rounded-full bg-surface-2" />
              ))}
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="flex items-center justify-between gap-3 text-xs text-crimson-bright">
          <span>{error instanceof Error ? error.message : "Failed to load teams"}</span>
          <button type="button" onClick={() => refetch()} className="shrink-0 font-medium underline underline-offset-2">
            Retry
          </button>
        </div>
      ) : !data || data.length === 0 ? (
        <p className="text-xs text-fg-faint">No teams available.</p>
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <TeamChipRow
            label="Team A"
            accentClassName="bg-crimson-bright"
            teams={data}
            selectedId={teamAId}
            excludeId={teamBId}
            onSelect={(t) => onChangeA(t.team_id)}
          />
          <span className="hidden pt-8 text-xs font-medium text-fg-faint sm:block">vs</span>
          <TeamChipRow
            label="Team B"
            accentClassName="bg-fg-muted"
            teams={data}
            selectedId={teamBId}
            excludeId={teamAId}
            onSelect={(t) => onChangeB(t.team_id)}
          />
        </div>
      )}
    </div>
  );
}
