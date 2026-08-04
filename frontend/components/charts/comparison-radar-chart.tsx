"use client";

import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

interface RadarPoint {
  metric: string;
  // 0-100 normalized values, plus the raw display value per player
  player1: number;
  player2: number;
  player1Raw: string | number;
  player2Raw: string | number;
}

export function ComparisonRadarChart({
  data,
  player1Name,
  player2Name,
}: {
  data: RadarPoint[];
  player1Name: string;
  player2Name: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke="rgba(41,30,20,0.10)" />
        <PolarAngleAxis dataKey="metric" tick={{ fill: "#6b6156", fontSize: 11 }} />
        <PolarRadiusAxis tick={false} axisLine={false} domain={[0, 100]} />
        <Radar
          name={player1Name}
          dataKey="player1"
          stroke="#3d6a7d"
          fill="#3d6a7d"
          fillOpacity={0.35}
          strokeWidth={2}
        />
        <Radar
          name={player2Name}
          dataKey="player2"
          stroke="#b9862f"
          fill="#b9862f"
          fillOpacity={0.28}
          strokeWidth={2}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: "#6b6156" }} />
        <Tooltip
          contentStyle={{
            background: "#fffdf9",
            border: "1px solid rgba(41,30,20,0.10)",
            borderRadius: 12,
            fontSize: 12,
            color: "#241d17",
          }}
          labelStyle={{ color: "#6b6156" }}
          formatter={(_value, name, item) => {
            const raw = item?.payload
              ? name === player1Name
                ? item.payload.player1Raw
                : item.payload.player2Raw
              : "";
            return [raw, name];
          }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
