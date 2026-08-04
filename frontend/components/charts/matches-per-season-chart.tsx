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
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(41,30,20,0.06)" vertical={false} />
        <XAxis
          dataKey="season"
          tick={{ fill: "#6b6156", fontSize: 12 }}
          axisLine={{ stroke: "rgba(41,30,20,0.16)" }}
          tickLine={false}
        />
        <YAxis tick={{ fill: "#6b6156", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip
          cursor={{ fill: "rgba(41,30,20,0.04)" }}
          contentStyle={{
            background: "#fffdf9",
            border: "1px solid rgba(41,30,20,0.10)",
            borderRadius: 12,
            fontSize: 12,
            color: "#241d17",
          }}
          labelStyle={{ color: "#6b6156" }}
        />
        <Bar dataKey="matches" fill="#3d6a7d" radius={[6, 6, 0, 0]} maxBarSize={44} />
      </BarChart>
    </ResponsiveContainer>
  );
}
