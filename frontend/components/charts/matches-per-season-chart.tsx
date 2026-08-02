"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface Point {
  season: string;
  matches: number;
}

export function MatchesPerSeasonChart({ data }: { data: Point[] }) {
  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-fg-faint">No match data available yet.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(250,248,245,0.07)" vertical={false} />
        <XAxis
          dataKey="season"
          tick={{ fill: "#a6a4a1", fontSize: 12 }}
          axisLine={{ stroke: "rgba(250,248,245,0.15)" }}
          tickLine={false}
        />
        <YAxis tick={{ fill: "#a6a4a1", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip
          cursor={{ fill: "rgba(250,248,245,0.04)" }}
          contentStyle={{
            background: "#131316",
            border: "1px solid rgba(250,248,245,0.12)",
            borderRadius: 12,
            fontSize: 12,
            color: "#f7f5f1",
          }}
          labelStyle={{ color: "#a6a4a1" }}
        />
        <Bar dataKey="matches" fill="#a8112c" radius={[6, 6, 0, 0]} maxBarSize={44} />
      </BarChart>
    </ResponsiveContainer>
  );
}
