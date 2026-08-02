import Link from "next/link";
import { api } from "@/lib/api";
import { safe } from "@/lib/safe";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";

export const revalidate = 60;

export default async function SeasonsPage() {
  const seasons = await safe(() => api.seasons(), []);

  return (
    <div>
      <PageHeader
        eyebrow="Seasons"
        title="Season Archive"
        description="Every recorded PSL season. Open a season to filter matches and leaderboards."
      />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
        {seasons.map((s) => (
          <Link key={s.season_id} href={`/matches?season_id=${s.season_id}`}>
            <Card className="flex h-28 flex-col items-center justify-center gap-1 transition-colors hover:border-crimson-bright/40">
              <span className="scoreboard-digits text-3xl font-semibold text-ivory">{s.season_year}</span>
              <span className="text-xs uppercase tracking-widest text-fg-faint">Season</span>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
