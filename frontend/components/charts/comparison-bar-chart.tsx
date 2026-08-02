"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface Row {
  name: string;
  [seriesKey: string]: string | number;
}

export function ComparisonBarChart({
  data,
  series,
}: {
  data: Row[];
  series: { key: string; color: string; label: string }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(250,248,245,0.07)" vertical={false} />
        <XAxis dataKey="name" tick={{ fill: "#a6a4a1", fontSize: 12 }} axisLine={{ stroke: "rgba(250,248,245,0.15)" }} tickLine={false} />
        <YAxis tick={{ fill: "#a6a4a1", fontSize: 12 }} axisLine={false} tickLine={false} />
        <Tooltip
          cursor={{ fill: "rgba(250,248,245,0.04)" }}
          contentStyle={{ background: "#131316", border: "1px solid rgba(250,248,245,0.12)", borderRadius: 12, fontSize: 12, color: "#f7f5f1" }}
          labelStyle={{ color: "#a6a4a1" }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: "#a6a4a1" }} />
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[6, 6, 0, 0]} maxBarSize={44} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
