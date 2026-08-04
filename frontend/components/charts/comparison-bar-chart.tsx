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
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(41,30,20,0.06)" vertical={false} />
        <XAxis dataKey="name" tick={{ fill: "#6b6156", fontSize: 12 }} axisLine={{ stroke: "rgba(41,30,20,0.16)" }} tickLine={false} />
        <YAxis tick={{ fill: "#6b6156", fontSize: 12 }} axisLine={false} tickLine={false} />
        <Tooltip
          cursor={{ fill: "rgba(41,30,20,0.04)" }}
          contentStyle={{ background: "#fffdf9", border: "1px solid rgba(41,30,20,0.10)", borderRadius: 12, fontSize: 12, color: "#241d17" }}
          labelStyle={{ color: "#6b6156" }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: "#6b6156" }} />
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[6, 6, 0, 0]} maxBarSize={44} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
