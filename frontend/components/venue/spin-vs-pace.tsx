"use client";

/**
 * Ticket 10.1 -- Spin vs Pace.
 *
 * Head-to-head comparison of how spin and pace bowlers have actually
 * performed at this venue -- economy, average, and strike rate side
 * by side as diverging bars from a shared center line, so "which type
 * of bowling this venue rewards" reads at a glance from bar length +
 * direction rather than needing to compare two separate charts.
 * <BowlingConditions> already surfaces a pace/spin wicket-share
 * number; this is the fuller quality breakdown behind that split.
 */

import { useChartData } from "@/hooks/use-chart-data";

export interface SpinVsPaceMetric {
  metric: "economy" | "average" | "strike_rate";
  spin_value: number;
  pace_value: number;
}

export interface SpinVsPaceData {
  spin_wickets: number;
  pace_wickets: number;
  metrics: SpinVsPaceMetric[];
}

export interface SpinVsPaceProps {
  path: string;
  title?: string;
}

const METRIC_LABELS: Record<SpinVsPaceMetric["metric"], string> = {
  economy: "Economy",
  average: "Average",
  strike_rate: "Strike Rate",
};

export function SpinVsPace({ path, title = "Spin vs Pace" }: SpinVsPaceProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = useChartData<SpinVsPaceData>(path);

  const maxValue =
    data && data.metrics.length > 0 ? Math.max(...data.metrics.map((m) => Math.max(m.spin_value, m.pace_value)), 1) : 1;

  return (
    <div className="rounded-2xl border border-line-strong bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-ivory">{title}</h3>
        {isFetching && !isLoading && <span className="text-xs text-fg-faint">Updating…</span>}
      </div>

      {isLoading ? (
        <div role="status" aria-label={`Loading ${title}`} className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-8 w-full animate-pulse rounded bg-surface-2" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 text-xs text-crimson-bright">
          <span className="text-center">{error instanceof Error ? error.message : "Failed to load spin vs pace data"}</span>
          <button type="button" onClick={() => refetch()} className="font-medium underline underline-offset-2">
            Retry
          </button>
        </div>
      ) : !data || data.metrics.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-xs text-fg-faint">No bowling-type breakdown for this venue</div>
      ) : (
        <div className={`transition-opacity duration-150 ${isFetching ? "opacity-50" : "opacity-100"}`}>
          <div className="mb-4 flex items-center justify-center gap-6 text-xs text-fg-faint">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-fg-muted" /> Spin ({data.spin_wickets} wkts)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-crimson-bright" /> Pace ({data.pace_wickets} wkts)
            </span>
          </div>

          <div className="flex flex-col gap-4">
            {data.metrics.map((m) => (
              <div key={m.metric} className="flex flex-col gap-1">
                <span className="text-center text-xs text-fg-faint">{METRIC_LABELS[m.metric]}</span>
                <div className="grid grid-cols-2 items-center gap-1">
                  <div className="flex items-center justify-end gap-2">
                    <span className="w-10 shrink-0 text-right text-xs tabular-nums text-fg-muted">{m.spin_value.toFixed(1)}</span>
                    <div className="relative h-5 flex-1 overflow-hidden rounded bg-surface-2">
                      <div
                        className="absolute inset-y-0 right-0 rounded bg-fg-muted/60"
                        style={{ width: `${Math.max((m.spin_value / maxValue) * 100, 4)}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative h-5 flex-1 overflow-hidden rounded bg-surface-2">
                      <div
                        className="absolute inset-y-0 left-0 rounded bg-crimson-bright/60"
                        style={{ width: `${Math.max((m.pace_value / maxValue) * 100, 4)}%` }}
                      />
                    </div>
                    <span className="w-10 shrink-0 text-xs tabular-nums text-fg-muted">{m.pace_value.toFixed(1)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
