"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface TimelinePoint {
  season_year: number;
  [seriesKey: string]: number;
}

export function ComparisonTimelineChart({
  data,
  player1Name,
  player2Name,
  metric = "runs",
}: {
  data: TimelinePoint[];
  player1Name: string;
  player2Name: string;
  metric?: "runs" | "wickets";
}) {
  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-fg-faint">No season-by-season data available yet.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(41,30,20,0.06)" vertical={false} />
        <XAxis
          dataKey="season_year"
          tick={{ fill: "#6b6156", fontSize: 12 }}
          axisLine={{ stroke: "rgba(41,30,20,0.16)" }}
          tickLine={false}
        />
        <YAxis tick={{ fill: "#6b6156", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip
          cursor={{ stroke: "rgba(41,30,20,0.16)" }}
          contentStyle={{
            background: "#fffdf9",
            border: "1px solid rgba(41,30,20,0.10)",
            borderRadius: 12,
            fontSize: 12,
            color: "#241d17",
          }}
          labelStyle={{ color: "#6b6156" }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: "#6b6156" }} />
        <Line
          type="monotone"
          dataKey={`p1_${metric}`}
          name={player1Name}
          stroke="#3d6a7d"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
        <Line
          type="monotone"
          dataKey={`p2_${metric}`}
          name={player2Name}
          stroke="#b9862f"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
