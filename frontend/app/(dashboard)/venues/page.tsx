import Link from "next/link";
import { api } from "@/lib/api";
import { safe } from "@/lib/safe";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { MapPin } from "lucide-react";

export const revalidate = 60;

export default async function VenuesPage() {
  const venues = await safe(() => api.venues(), []);

  return (
    <div>
      <PageHeader
        eyebrow="Venues"
        title="Grounds"
        description="Pitch conditions and match history for every recorded venue."
      />
      {venues.length === 0 ? (
        <p className="py-16 text-center text-sm text-fg-faint">No venue data available yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {venues.map((v) => (
            <Link key={v.venue_id} href={`/venues/${v.venue_id}`}>
              <Card className="p-5 transition-colors hover:border-crimson-bright/40">
                <div className="flex items-center gap-2 text-fg-muted">
                  <MapPin className="h-4 w-4" />
                  <span className="text-xs uppercase tracking-widest">{v.city ?? v.country ?? "—"}</span>
                </div>
                <h3 className="mt-2 font-display text-lg font-semibold text-ivory">{v.venue_name}</h3>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-fg-faint">Matches</p>
                    <p className="scoreboard-digits text-ivory">{v.match_count}</p>
                  </div>
                  <div>
                    <p className="text-xs text-fg-faint">Avg 1st Innings</p>
                    <p className="scoreboard-digits text-ivory">{v.avg_first_innings_score ?? "—"}</p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
