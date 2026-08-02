"use client";

import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer } from "recharts";

interface Metric {
  metric: string;
  value: number; // 0-100 normalized
}

export function PlayerRadarChart({ data }: { data: Metric[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <RadarChart data={data} outerRadius="75%">
        <PolarGrid stroke="rgba(250,248,245,0.12)" />
        <PolarAngleAxis dataKey="metric" tick={{ fill: "#a6a4a1", fontSize: 11 }} />
        <Radar dataKey="value" stroke="#e01b3e" fill="#a8112c" fillOpacity={0.35} strokeWidth={2} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
