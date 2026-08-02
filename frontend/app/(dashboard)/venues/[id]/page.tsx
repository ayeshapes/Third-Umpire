import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { safe } from "@/lib/safe";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatDate, formatNumber } from "@/lib/utils";
import { VenueMapDynamic } from "@/components/shared/venue-map-dynamic";

export const revalidate = 60;

export default async function VenueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const venueId = Number(id);
  if (Number.isNaN(venueId)) notFound();

  const detail = await safe(() => api.venue(venueId), null);
  if (!detail || !detail.venue || "error" in detail.venue) notFound();

  const venue = detail.venue;

  return (
    <div>
      <PageHeader
        eyebrow="Venue"
        title={venue.venue_name}
        description={[venue.city, venue.country].filter(Boolean).join(", ") || undefined}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card className="p-5">
          <p className="text-xs uppercase tracking-widest text-fg-faint">Matches</p>
          <p className="scoreboard-digits mt-1 text-3xl font-semibold text-ivory">{formatNumber(venue.match_count)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs uppercase tracking-widest text-fg-faint">Avg 1st Innings</p>
          <p className="scoreboard-digits mt-1 text-3xl font-semibold text-ivory">{venue.avg_first_innings_score ?? "—"}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs uppercase tracking-widest text-fg-faint">Chase Success %</p>
          <p className="scoreboard-digits mt-1 text-3xl font-semibold text-amber">{venue.chase_success_pct ?? "—"}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs uppercase tracking-widest text-fg-faint">Spin Wicket %</p>
          <p className="scoreboard-digits mt-1 text-3xl font-semibold text-ivory">{venue.spin_wicket_pct ?? "—"}</p>
        </Card>
      </div>

      {venue.latitude !== null && venue.longitude !== null && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Location</CardTitle>
          </CardHeader>
          <CardContent>
            <VenueMapDynamic lat={venue.latitude} lng={venue.longitude} name={venue.venue_name} />
          </CardContent>
        </Card>
      )}

      {detail.records && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Venue Records</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="Highest Chase" value={detail.records.highest_successful_chase} />
            <Stat label="Lowest Chase" value={detail.records.lowest_successful_chase} />
            <Stat label="Highest Defense" value={detail.records.highest_successful_defense} />
            <Stat label="Lowest Defense" value={detail.records.lowest_successful_defense} />
          </CardContent>
        </Card>
      )}

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Recent Matches Here</CardTitle>
        </CardHeader>
        <CardContent>
          {detail.recent_matches.length === 0 ? (
            <p className="py-6 text-center text-sm text-fg-faint">No recent match data.</p>
          ) : (
            <div className="space-y-2">
              {detail.recent_matches.map((m) => (
                <div
                  key={m.match_id}
                  className="flex items-center justify-between border-b border-line/60 py-2.5 text-sm last:border-0"
                >
                  <span className="text-fg-muted">
                    {formatDate(m.match_date)} · {m.team1_name} v {m.team2_name}
                  </span>
                  <span className="scoreboard-digits text-ivory">
                    {m.team1_runs}/{m.team1_wickets} · {m.team2_runs}/{m.team2_wickets}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-widest text-fg-faint">{label}</p>
      <p className="scoreboard-digits mt-1 text-xl font-semibold text-ivory">{value ?? "—"}</p>
    </div>
  );
}
