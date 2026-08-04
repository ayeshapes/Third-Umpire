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
        <PolarGrid stroke="rgba(41,30,20,0.10)" />
        <PolarAngleAxis dataKey="metric" tick={{ fill: "#6b6156", fontSize: 11 }} />
        <Radar dataKey="value" stroke="#3d6a7d" fill="#3d6a7d" fillOpacity={0.35} strokeWidth={2} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
