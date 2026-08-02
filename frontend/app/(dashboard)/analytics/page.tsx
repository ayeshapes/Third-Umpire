import { api } from "@/lib/api";
import { safe } from "@/lib/safe";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ComparisonBarChart } from "@/components/charts/comparison-bar-chart";
import { ComingSoon } from "@/components/shared/page-header";
import { LineChart } from "lucide-react";
import type { TossImpact, DayNightSplit } from "@/types/api";

export const revalidate = 60;

export default async function AnalyticsPage() {
  const [toss, dayNight] = await Promise.all([
    safe<TossImpact | null>(() => api.tossImpact(), null),
    safe<DayNightSplit | null>(() => api.dayNightSplit(), null),
  ]);

  const tossData = toss
    ? Object.entries(toss.by_decision).map(([decision, v]) => ({
        name: decision === "bat" ? "Chose to Bat" : "Chose to Field",
        "Win % after toss": v.toss_winner_win_pct ?? 0,
      }))
    : [];

  const dayNightData = dayNight
    ? [
        {
          name: "Day",
          "Strike Rate": dayNight.day.batting.strike_rate ?? 0,
          Economy: dayNight.day.bowling.economy ?? 0,
        },
        {
          name: "Night",
          "Strike Rate": dayNight.night.batting.strike_rate ?? 0,
          Economy: dayNight.night.bowling.economy ?? 0,
        },
      ]
    : [];

  return (
    <div>
      <PageHeader
        eyebrow="Analytics"
        title="League Analytics"
        description="Toss decisions, day vs. night conditions, and batting/bowling trends across every recorded match."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Toss Decision Impact</CardTitle>
          </CardHeader>
          <CardContent>
            {toss ? (
              <>
                <p className="mb-4 text-sm text-fg-muted">
                  Across {toss.overall.total_matches} matches, the toss winner also won the match{" "}
                  <span className="scoreboard-digits text-amber">{toss.overall.toss_winner_win_pct ?? "—"}%</span> of
                  the time.
                </p>
                <ComparisonBarChart
                  data={tossData}
                  series={[{ key: "Win % after toss", color: "#a8112c", label: "Win % after toss" }]}
                />
              </>
            ) : (
              <p className="py-10 text-center text-sm text-fg-faint">No toss data available yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Day vs. Night Conditions</CardTitle>
          </CardHeader>
          <CardContent>
            {dayNight ? (
              <ComparisonBarChart
                data={dayNightData}
                series={[
                  { key: "Strike Rate", color: "#e01b3e", label: "Batting Strike Rate" },
                  { key: "Economy", color: "#e8a33d", label: "Bowling Economy" },
                ]}
              />
            ) : (
              <p className="py-10 text-center text-sm text-fg-faint">No day/night split data available yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4">
        <ComingSoon
          icon={LineChart}
          title="Season & Player Comparison Tools"
          description="Side-by-side season comparison, team comparison, and player comparison dashboards are next up — the API endpoints (/api/seasons/compare, /api/matchup, /api/batter-vs-bowling-type) are already live."
        />
      </div>
    </div>
  );
}
