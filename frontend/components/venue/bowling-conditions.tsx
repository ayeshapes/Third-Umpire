"use client";

/**
 * Ticket 10.1 -- Bowling Conditions.
 *
 * "What's it like to bowl here" -- the bowling-side mirror of
 * <BattingConditions>: wickets/economy headline numbers plus a
 * dismissal-type breakdown (bowled/caught/lbw/etc), which is what
 * actually signals *why* a venue helps bowlers -- e.g. a high lbw/
 * bowled share points at seam movement or low bounce, which a bare
 * economy-rate number can't distinguish from "batters just went hard
 * and got out swinging."
 */

import { useChartData } from "@/hooks/use-chart-data";
import { StatCard, StatCardGrid } from "@/components/batting/stat-card";

export interface DismissalShare {
  type: string; // "Bowled" | "Caught" | "LBW" | "Run Out" | "Stumped" | ...
  pct: number;
}

export interface BowlingConditionsData {
  avg_wickets_per_match: number;
  avg_economy: number;
  avg_bowling_strike_rate: number; // balls per wicket
  pace_wickets_pct: number;
  spin_wickets_pct: number;
  dismissal_breakdown: DismissalShare[];
}

export interface BowlingConditionsProps {
  path: string;
}

export function BowlingConditions({ path }: BowlingConditionsProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = useChartData<BowlingConditionsData>(path);

  const maxPct = data && data.dismissal_breakdown.length > 0 ? Math.max(...data.dismissal_breakdown.map((d) => d.pct), 1) : 1;

  return (
    <div className="rounded-2xl border border-line-strong bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-ivory">Bowling Conditions</h3>
        {isFetching && !isLoading && <span className="text-xs text-fg-faint">Updating…</span>}
      </div>

      {isError ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 text-xs text-crimson-bright">
          <span className="text-center">{error instanceof Error ? error.message : "Failed to load bowling conditions"}</span>
          <button type="button" onClick={() => refetch()} className="font-medium underline underline-offset-2">
            Retry
          </button>
        </div>
      ) : (
        <div className={`transition-opacity duration-150 ${isFetching ? "opacity-50" : "opacity-100"}`}>
          <StatCardGrid>
            <StatCard label="Wickets / Match" value={data ? data.avg_wickets_per_match.toFixed(1) : undefined} isLoading={isLoading} />
            <StatCard label="Economy" value={data ? data.avg_economy.toFixed(2) : undefined} isLoading={isLoading} />
            <StatCard label="Strike Rate" value={data ? data.avg_bowling_strike_rate.toFixed(1) : undefined} isLoading={isLoading} />
            <StatCard
              label="Pace / Spin Split"
              value={data ? `${data.pace_wickets_pct.toFixed(0)}% / ${data.spin_wickets_pct.toFixed(0)}%` : undefined}
              isLoading={isLoading}
            />
          </StatCardGrid>

          <div className="mt-5">
            <p className="mb-3 text-xs font-medium uppercase tracking-widest text-fg-faint">Dismissal Breakdown</p>
            {isLoading ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-7 w-full animate-pulse rounded bg-surface-2" />
                ))}
              </div>
            ) : !data || data.dismissal_breakdown.length === 0 ? (
              <p className="text-xs text-fg-faint">No dismissal breakdown available.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {data.dismissal_breakdown.map((d) => (
                  <div key={d.type} className="flex items-center gap-3">
                    <span className="w-20 shrink-0 text-xs text-fg-faint">{d.type}</span>
                    <div className="relative h-5 flex-1 overflow-hidden rounded bg-surface-2">
                      <div className="h-full rounded bg-crimson-bright/60" style={{ width: `${Math.max((d.pct / maxPct) * 100, 4)}%` }} />
                    </div>
                    <span className="w-12 shrink-0 text-right text-xs tabular-nums text-fg-muted">{d.pct.toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
