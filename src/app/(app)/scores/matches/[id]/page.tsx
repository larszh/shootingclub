import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireModule } from "@/lib/tenant";
import { Badge, PageHeader } from "@/components/ui";
import { getMatch } from "@/modules/scores/queries";
import { ScoreEntry } from "@/modules/scores/ui/score-entry";
import { formatDate } from "@/lib/utils";
import { disciplineLabel } from "@/modules/scores/types";

export const metadata: Metadata = { title: "Durchgang" };

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireModule("scores");
  const { id } = await params;
  const match = await getMatch(ctx, id);
  if (!match) notFound();
  return (
    <div>
      <PageHeader title={match.title ?? match.program.name} subtitle={`${formatDate(match.date)}${match.locationNote ? ` · ${match.locationNote}` : ""}${match.createdBy ? ` · erstellt von ${match.createdBy.name}` : ""}`} back={{ href: "/scores", label: "Schiessen" }}
        action={match.status === "FINISHED" ? <Badge tone="ok">Abgeschlossen</Badge> : <Badge tone="accent">Offen</Badge>} />
      <div className="animate-fade flex flex-wrap gap-1.5 mb-4 -mt-2">
        {match.title ? <Badge>{match.program.name}</Badge> : null}
        <Badge tone="outline">{disciplineLabel(match.program.discipline)}</Badge>
        <Badge tone="outline">{match.program.totals.shots} Schuss · max. {match.program.totals.max}</Badge>
      </div>
      <ScoreEntry key={match.status} match={match} />
    </div>
  );
}
