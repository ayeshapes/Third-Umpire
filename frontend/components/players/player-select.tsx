"use client";

/**
 * Ticket 12.1 -- Player Comparison Studio: player picker.
 *
 * Two single-player search boxes (Player A / Player B) rather than
 * the venue picker's chip list (components/venue/venue-multi-select.tsx)
 * -- that pattern fits 2-4 venues from a list short enough to scan at
 * a glance, but the player universe is a full squad list across every
 * team/season, too long to render as chips. A type-to-filter search
 * over lib/api/filters.ts's existing `fetchPlayerOptions` (already
 * built for the cascading filter bar, Ticket 6.7 -- no new endpoint
 * needed) scales to that list the same way the command palette
 * presumably searches matches/players elsewhere in the app.
 *
 * Local state (like the venue picker), not the shared filter store:
 * the store's `player` field is a single value for scoping every
 * *other* page (store/filters/types.ts) -- correct there, wrong here,
 * which needs exactly two independent selections. lib/api/players.ts
 * layers these two IDs on top of the store's remaining fields for the
 * "Shared filters" requirement instead.
 */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchPlayerOptions, type PlayerOption } from "@/lib/api/filters";
import { FILTER_OPTIONS_GC_TIME_MS, FILTER_OPTIONS_STALE_TIME_MS } from "@/hooks/use-filter-options";

function playerLabel(p: PlayerOption): string {
  return p.display_name ?? p.full_name;
}

interface SinglePlayerSearchProps {
  label: string;
  accentClassName: string;
  selectedId: number | null;
  onSelect: (player: PlayerOption | null) => void;
  /** Excluded so the same player can't land on both sides of the comparison. */
  excludeId: number | null;
}

function SinglePlayerSearch({ label, accentClassName, selectedId, onSelect, excludeId }: SinglePlayerSearchProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["filter-options", "players", {}],
    queryFn: ({ signal }) => fetchPlayerOptions({}, signal),
    staleTime: FILTER_OPTIONS_STALE_TIME_MS,
    gcTime: FILTER_OPTIONS_GC_TIME_MS,
    retry: 2,
  });

  const selected = useMemo(() => data?.find((p) => p.player_id === selectedId) ?? null, [data, selectedId]);

  const results = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data
      .filter((p) => p.player_id !== excludeId)
      .filter((p) => q === "" || playerLabel(p).toLowerCase().includes(q))
      .slice(0, 8);
  }, [data, query, excludeId]);

  return (
    <div className="relative flex-1">
      <div className="mb-2 flex items-center gap-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${accentClassName}`} />
        <span className="text-xs font-medium uppercase tracking-widest text-fg-faint">{label}</span>
      </div>

      {isError ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-line-strong bg-surface px-3 py-2.5 text-xs text-crimson-bright">
          <span>{error instanceof Error ? error.message : "Failed to load players"}</span>
          <button type="button" onClick={() => refetch()} className="shrink-0 font-medium underline underline-offset-2">
            Retry
          </button>
        </div>
      ) : (
        <>
          <input
            type="text"
            value={selected && !open ? playerLabel(selected) : query}
            placeholder={isLoading ? "Loading players…" : "Search for a player…"}
            disabled={isLoading}
            onFocus={() => {
              setOpen(true);
              setQuery("");
            }}
            onChange={(e) => {
              setQuery(e.target.value);
              if (selectedId !== null) onSelect(null);
            }}
            onBlur={() => {
              // Let a click on a result register before the list unmounts.
              setTimeout(() => setOpen(false), 120);
            }}
            className="w-full rounded-xl border border-line-strong bg-surface px-3 py-2.5 text-sm text-ivory placeholder:text-fg-faint focus:border-crimson-bright/60 focus:outline-none disabled:opacity-60"
          />

          {open && (
            <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-line-strong bg-surface p-1 shadow-lg">
              {results.length === 0 ? (
                <p className="px-3 py-2 text-xs text-fg-faint">No players match "{query}"</p>
              ) : (
                results.map((p) => (
                  <button
                    key={p.player_id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()} // keep focus so onBlur doesn't beat the click
                    onClick={() => {
                      onSelect(p);
                      setQuery("");
                      setOpen(false);
                    }}
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm text-fg-muted hover:bg-surface-2 hover:text-ivory"
                  >
                    <span className="truncate">{playerLabel(p)}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export interface PlayerSelectProps {
  playerAId: number | null;
  playerBId: number | null;
  onChangeA: (id: number | null) => void;
  onChangeB: (id: number | null) => void;
}

export function PlayerSelect({ playerAId, playerBId, onChangeA, onChangeB }: PlayerSelectProps) {
  return (
    <div className="rounded-2xl border border-line-strong bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-ivory">Players to Compare</h3>
        {playerAId !== null && playerBId !== null && playerAId === playerBId && (
          <span className="text-xs text-crimson-bright">Pick two different players</span>
        )}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <SinglePlayerSearch
          label="Player A"
          accentClassName="bg-crimson-bright"
          selectedId={playerAId}
          excludeId={playerBId}
          onSelect={(p) => onChangeA(p ? p.player_id : null)}
        />
        <span className="hidden pt-8 text-xs font-medium text-fg-faint sm:block">vs</span>
        <SinglePlayerSearch
          label="Player B"
          accentClassName="bg-fg-muted"
          selectedId={playerBId}
          excludeId={playerAId}
          onSelect={(p) => onChangeB(p ? p.player_id : null)}
        />
      </div>
    </div>
  );
}
