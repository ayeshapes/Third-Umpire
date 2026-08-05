"use client";

/**
 * Default view for the Venues page before a single venue is picked.
 *
 * Previously this page required a venue selection before rendering
 * anything -- "No venue selected, pick one from the filter bar above"
 * was the entire page. That's a bad default: most people landing on
 * "Venues" want to browse/compare venues first, then drill into one,
 * not be forced to already know which venue they want.
 *
 * This uses the existing GET /api/venues endpoint (api.venues()),
 * which already returns every venue's headline pitch numbers -- no
 * new backend work needed. Renders a couple of general at-a-glance
 * charts plus a sortable table; clicking a row is how you drill into
 * a single venue's full report (same as picking it from the filter).
 */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MapPin, ArrowUpDown } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import type { Venue } from "@/types/api";

type SortKey = "match_count" | "avg_first_innings_score" | "boundary_pct_of_balls" | "chase_success_pct";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "match_count", label: "Matches Hosted" },
  { key: "avg_first_innings_score", label: "Avg 1st Innings Score" },
  { key: "boundary_pct_of_balls", label: "Boundary %" },
  { key: "chase_success_pct", label: "Chase Success %" },
];

function shortName(name: string, max = 18) {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

function TopVenuesChart({
  data,
  dataKey,
  label,
  color,
  suffix = "",
}: {
  data: Venue[];
  dataKey: keyof Venue;
  label: string;
  color: string;
  suffix?: string;
}) {
  const chartData = useMemo(
    () =>
      [...data]
        .filter((v) => v[dataKey] !== null && v[dataKey] !== undefined)
        .sort((a, b) => (b[dataKey] as number) - (a[dataKey] as number))
        .slice(0, 8)
        .map((v) => ({ name: shortName(v.venue_name), value: v[dataKey] as number })),
    [data, dataKey]
  );

  if (chartData.length === 0) {
    return <p className="py-10 text-center text-sm text-fg-faint">No data available yet.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 24, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(41,30,20,0.06)" horizontal={false} />
        <XAxis type="number" tick={{ fill: "#6b6156", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fill: "#6b6156", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={110}
        />
        <Tooltip
          formatter={(value) => [`${value}${suffix}`, label]}
          cursor={{ fill: "rgba(41,30,20,0.04)" }}
          contentStyle={{
            background: "#fffdf9",
            border: "1px solid rgba(41,30,20,0.10)",
            borderRadius: 12,
            fontSize: 12,
            color: "#241d17",
          }}
        />
        <Bar dataKey="value" fill={color} radius={[0, 6, 6, 0]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function AllVenuesOverview({ onSelectVenue }: { onSelectVenue: (venueId: number) => void }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["venues", "all"],
    queryFn: () => api.venues(),
    staleTime: 30 * 60 * 1000,
  });

  const [sortKey, setSortKey] = useState<SortKey>("match_count");

  const sorted = useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => {
      const av = a[sortKey] ?? -Infinity;
      const bv = b[sortKey] ?? -Infinity;
      return (bv as number) - (av as number);
    });
  }, [data, sortKey]);

  if (isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-64" />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line-strong px-8 py-14 text-center">
        <p className="text-sm font-medium text-fg-muted">Couldn&apos;t load venues</p>
        <p className="max-w-xs text-xs text-fg-faint">Something went wrong fetching venue data.</p>
        <button
          onClick={() => refetch()}
          className="mt-1 text-xs font-medium text-crimson-bright underline underline-offset-2"
        >
          Retry
        </button>
      </div>
    );
  }

  if (data.length === 0) {
    return <EmptyState title="No venues recorded yet" />;
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Most Matches Hosted</CardTitle>
          </CardHeader>
          <CardContent>
            <TopVenuesChart data={data} dataKey="match_count" label="Matches" color="#3d6a7d" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Highest Avg 1st Innings Score</CardTitle>
          </CardHeader>
          <CardContent>
            <TopVenuesChart
              data={data}
              dataKey="avg_first_innings_score"
              label="Avg score"
              color="#b5502e"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Highest Boundary %</CardTitle>
          </CardHeader>
          <CardContent>
            <TopVenuesChart data={data} dataKey="boundary_pct_of_balls" label="Boundary %" color="#8a6d3b" suffix="%" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Highest Chase Success %</CardTitle>
          </CardHeader>
          <CardContent>
            <TopVenuesChart data={data} dataKey="chase_success_pct" label="Chase success" color="#4a7a4e" suffix="%" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="items-center">
          <CardTitle>Every Venue</CardTitle>
          <div className="flex items-center gap-2 text-xs text-fg-faint">
            <ArrowUpDown className="h-3.5 w-3.5" />
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="rounded-full border border-line-strong bg-surface px-3 py-1 text-xs text-ivory focus:outline-none"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  Sort: {o.label}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-fg-faint">
                  <th className="py-2 pr-3 font-medium">Venue</th>
                  <th className="py-2 pr-3 font-medium">City</th>
                  <th className="py-2 pr-3 text-right font-medium">Matches</th>
                  <th className="py-2 pr-3 text-right font-medium">Avg 1st Inns</th>
                  <th className="py-2 pr-3 text-right font-medium">Boundary %</th>
                  <th className="py-2 pr-3 text-right font-medium">Chase %</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((v) => (
                  <tr
                    key={v.venue_id}
                    onClick={() => onSelectVenue(v.venue_id)}
                    className="cursor-pointer border-b border-line/60 transition-colors hover:bg-surface-2"
                  >
                    <td className="py-2.5 pr-3">
                      <span className="inline-flex items-center gap-1.5 font-medium text-ivory">
                        <MapPin className="h-3.5 w-3.5 text-fg-faint" />
                        {v.venue_name}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-fg-muted">{v.city ?? "—"}</td>
                    <td className="py-2.5 pr-3 text-right text-fg-muted">{v.match_count}</td>
                    <td className="py-2.5 pr-3 text-right text-fg-muted">
                      {v.avg_first_innings_score ?? "—"}
                    </td>
                    <td className="py-2.5 pr-3 text-right text-fg-muted">
                      {v.boundary_pct_of_balls != null ? `${v.boundary_pct_of_balls}%` : "—"}
                    </td>
                    <td className="py-2.5 pr-3 text-right text-fg-muted">
                      {v.chase_success_pct != null ? `${v.chase_success_pct}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-fg-faint">Click a venue for its full conditions, par-score, and toss-impact report.</p>
        </CardContent>
      </Card>
    </div>
  );
}
