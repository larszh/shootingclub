import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireModule } from "@/lib/tenant";
import { Trophy, Repeat, ListOrdered } from "lucide-react";
import { Alert, Badge, LinkButton, PageHeader } from "@/components/ui";
import { getMatch, isPersonalBest } from "@/modules/scores/queries";
import { toScoreMatch } from "@/modules/scores/sync";
import { ScoreEntry } from "@/modules/scores/ui/score-entry";
import { formatDate } from "@/lib/utils";
import { disciplineLabel, scoringModeLabel } from "@/modules/scores/types";

export const metadata: Metadata = { title: "Durchgang" };

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireModule("scores");
  const { id } = await params;
  const match = await getMatch(ctx, id);
  if (!match) notFound();
  const finished = match.status === "FINISHED";
  const iParticipated = match.participants.some((p) => p.isMe);
  const pb = finished && iParticipated ? await isPersonalBest(match.id, ctx.user.id) : null;
  const decimal = match.program.scoringMode === "RINGS_DECIMAL";
  const fmt = (n: number) => (decimal ? n.toFixed(1) : String(Math.round(n)));
  const others = match.participants.filter((p) => p.userId && !p.isMe).map((p) => p.userId!);
  const againQs = new URLSearchParams({ programId: match.program.id });
  if (others.length) againQs.set("with", others.join(","));
  return (
    <div>
      <PageHeader title={match.title ?? match.program.name} subtitle={`${formatDate(match.date)}${match.locationNote ? ` · ${match.locationNote}` : ""}${match.createdBy ? ` · erstellt von ${match.createdBy.name}` : ""}`} back={{ href: "/scores", label: "Schiessen" }}
        action={match.status === "FINISHED" ? <Badge tone="ok">Abgeschlossen</Badge> : <Badge tone="accent">Offen</Badge>} />
      <div className="animate-fade flex flex-wrap gap-1.5 mb-4 -mt-2">
        {match.title ? <Badge>{match.program.name}</Badge> : null}
        <Badge tone="outline">{disciplineLabel(match.program.discipline)}</Badge>
        <Badge tone="outline">{match.program.totals.shots} Schuss · max. {match.program.totals.max}</Badge>
        <Badge tone="outline">{scoringModeLabel(match.program.scoringMode, true)}</Badge>
      </div>
      {pb?.isBest ? (
        <div className="mb-4">
          <Alert tone="ok"><span className="inline-flex items-center gap-2 font-medium"><Trophy className="h-4 w-4" aria-hidden /> Neue Bestleistung! {fmt(pb.total)} statt bisher {fmt(pb.previousBest ?? 0)}.</span></Alert>
        </div>
      ) : null}
      <ScoreEntry key={match.status} match={toScoreMatch(match)} storageKey={`s:${match.id}`} tenantId={ctx.tenant.id} userId={ctx.user.id} />
      {finished ? (
        <div className="animate-fade mt-4 flex flex-wrap gap-2">
          <LinkButton href={`/scores/matches/new?${againQs.toString()}`} variant="secondary" size="sm"><Repeat className="h-4 w-4" aria-hidden /> Nochmals schiessen</LinkButton>
          <LinkButton href={`/scores/leaderboard?programId=${match.program.id}`} variant="ghost" size="sm"><ListOrdered className="h-4 w-4" aria-hidden /> Rangliste</LinkButton>
        </div>
      ) : null}
    </div>
  );
}
