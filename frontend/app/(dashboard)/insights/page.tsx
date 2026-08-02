import { ComingSoon, PageHeader } from "@/components/shared/page-header";
import { Lightbulb } from "lucide-react";

export default function InsightsPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Insights"
        title="Automated Insights"
        description="Narrative, AI-generated takeaways from the data — form trends, breakout players, and matchup edges."
      />
      <ComingSoon
        icon={Lightbulb}
        title="Insights Engine"
        description="This is the planned home for player-similarity models, form/trend detection, and natural-language match previews built on top of the existing analytics API."
      />
    </div>
  );
}
