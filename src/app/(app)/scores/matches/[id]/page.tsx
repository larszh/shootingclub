import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireModule } from "@/lib/tenant";
import { Trophy, Repeat, ListOrdered } from "lucide-react";
import { Alert, Badge, LinkButton, PageHeader } from "@/components/ui";
import { getMatch, isPersonalBest } from "@/modules/scores/queries";
import { toScoreMatch } from "@/modules/scores/sync";
import { ScoreEntry } from "@/modules/scores/ui/score-entry";
import { formatDate } from "@/lib/utils";
import { disciplineLabel, officialKindLabel, OFFICIAL_RULES_HINT, scoringModeLabel } from "@/modules/scores/types";
import { officialInfoForMatch } from "@/modules/scores/official-service";
import { OfficialPanel, type OfficialRow } from "@/modules/scores/ui/official-panel";
import { formatDateTimeZurich } from "@/lib/time";

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
  const officialKind = match.program.officialKind;
  const canVerify = ctx.can("results.verify");
  const officialInfo = officialKind ? await officialInfoForMatch(ctx.tenant.id, match.id) : {};
  const officialRows: OfficialRow[] = officialKind
    ? match.participants
        // Schützen sehen nur ihren eigenen Status, Schützenmeister alle
        .filter((p) => canVerify || p.isMe || ctx.can("match.viewAll"))
        .map((p) => ({
          id: p.id,
          name: p.name,
          isGuest: p.isGuest,
          total: p.total,
          zeros: p.zeros,
          isOfficial: p.isOfficial,
          attempt: p.attempt,
          passed: p.passed,
          verifiedAtLabel: p.verifiedAt ? formatDateTimeZurich(p.verifiedAt) : null,
          verifiedByName: officialInfo[p.id]?.verifiedByName ?? null,
          suggestedAttempt: officialInfo[p.id]?.suggestedAttempt ?? 1,
          complete: officialInfo[p.id]?.complete ?? false,
        }))
    : [];
  const ruleParts: string[] = [];
  if (match.program.passMinScore !== null) ruleParts.push(`mind. ${match.program.passMinScore} Punkten`);
  if (match.program.passMaxZeros !== null) ruleParts.push(`höchstens ${match.program.passMaxZeros} Nullern`);
  const ruleText = `${ruleParts.length ? `Bestanden bei ${ruleParts.join(" und ")} (Einstellung im Programm).` : "Keine Bestehensregel im Programm hinterlegt."} ${OFFICIAL_RULES_HINT}`;
  // Amtlich bestätigte Resultate sind für Schützen schreibgeschützt
  const lockedIds = canVerify ? [] : match.participants.filter((p) => p.isOfficial).map((p) => p.id);
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
        {officialKind ? <Badge tone="accent">{officialKindLabel(officialKind)}</Badge> : null}
        {match.event ? <Badge tone="outline">Anlass: {match.event.title}</Badge> : null}
      </div>
      {pb?.isBest ? (
        <div className="mb-4">
          <Alert tone="ok"><span className="inline-flex items-center gap-2 font-medium"><Trophy className="h-4 w-4" aria-hidden /> Neue Bestleistung! {fmt(pb.total)} statt bisher {fmt(pb.previousBest ?? 0)}.</span></Alert>
        </div>
      ) : null}
      <ScoreEntry key={match.status} match={toScoreMatch(match)} storageKey={`s:${match.id}`} tenantId={ctx.tenant.id} userId={ctx.user.id} lockedParticipantIds={lockedIds} refreshOnSave={!!officialKind} />
      {officialKind && officialRows.length ? (
        <div className="mt-5">
          <OfficialPanel rows={officialRows} canVerify={canVerify} kindLabel={officialKindLabel(officialKind)} ruleText={ruleText} decimal={decimal} />
        </div>
      ) : null}
      {finished ? (
        <div className="animate-fade mt-4 flex flex-wrap gap-2">
          <LinkButton href={`/scores/matches/new?${againQs.toString()}`} variant="secondary" size="sm"><Repeat className="h-4 w-4" aria-hidden /> Nochmals schiessen</LinkButton>
          <LinkButton href={`/scores/leaderboard?programId=${match.program.id}`} variant="ghost" size="sm"><ListOrdered className="h-4 w-4" aria-hidden /> Rangliste</LinkButton>
        </div>
      ) : null}
    </div>
  );
}
