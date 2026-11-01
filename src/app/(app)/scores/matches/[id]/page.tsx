import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireModule } from "@/lib/tenant";
import { Trophy, Repeat, ListOrdered } from "lucide-react";
import { Alert, Badge, LinkButton, PageHeader } from "@/components/ui";
import { getMatch, isPersonalBest } from "@/modules/scores/queries";
import { toScoreMatch } from "@/modules/scores/sync";
import { ScoreEntry } from "@/modules/scores/ui/score-entry";
import { officialInfoForMatch } from "@/modules/scores/official-service";
import { OfficialPanel, type OfficialRow } from "@/modules/scores/ui/official-panel";
import { formatDate, formatDateTime, getRequestLocale, getT } from "@/lib/i18n";
import { disciplineText, officialKindText, scoringModeText, tCount } from "@/modules/scores/ui/labels";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("shooting.match.title") };
}

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireModule("scores");
  const locale = await getRequestLocale();
  const t = getT(locale);
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
          verifiedAtLabel: p.verifiedAt ? formatDateTime(p.verifiedAt, locale) : null,
          verifiedByName: officialInfo[p.id]?.verifiedByName ?? null,
          suggestedAttempt: officialInfo[p.id]?.suggestedAttempt ?? 1,
          complete: officialInfo[p.id]?.complete ?? false,
        }))
    : [];
  const ruleParts: string[] = [];
  if (match.program.passMinScore !== null) ruleParts.push(t("shooting.rule.minScore", { n: match.program.passMinScore }));
  if (match.program.passMaxZeros !== null) ruleParts.push(t("shooting.rule.maxZeros", { n: match.program.passMaxZeros }));
  const ruleText = `${ruleParts.length ? t("shooting.rule.passedAtProgram", { rules: ruleParts.join(t("shooting.rule.and")) }) : t("shooting.rule.noneProgram")} ${t("shooting.officialRulesHint")}`;
  // Amtlich bestätigte Resultate sind für Schützen schreibgeschützt
  const lockedIds = canVerify ? [] : match.participants.filter((p) => p.isOfficial).map((p) => p.id);
  const againQs = new URLSearchParams({ programId: match.program.id });
  if (others.length) againQs.set("with", others.join(","));
  return (
    <div>
      <PageHeader title={match.title ?? match.program.name} subtitle={`${formatDate(match.date, locale)}${match.locationNote ? ` · ${match.locationNote}` : ""}${match.createdBy ? ` · ${t("shooting.match.createdBy", { name: match.createdBy.name })}` : ""}`} back={{ href: "/scores", label: t("shooting.common.shooting") }}
        action={match.status === "FINISHED" ? <Badge tone="ok">{t("shooting.common.finished")}</Badge> : <Badge tone="accent">{t("shooting.common.open")}</Badge>} />
      <div className="animate-fade flex flex-wrap gap-1.5 mb-4 -mt-2">
        {match.title ? <Badge>{match.program.name}</Badge> : null}
        <Badge tone="outline">{disciplineText(t, match.program.discipline)}</Badge>
        <Badge tone="outline">{tCount(t, "shooting.common.shots", match.program.totals.shots)} · {t("shooting.match.maxN", { max: match.program.totals.max })}</Badge>
        <Badge tone="outline">{scoringModeText(t, match.program.scoringMode, true)}</Badge>
        {officialKind ? <Badge tone="accent">{officialKindText(t, officialKind)}</Badge> : null}
        {match.event ? <Badge tone="outline">{t("shooting.match.event", { title: match.event.title })}</Badge> : null}
      </div>
      {pb?.isBest ? (
        <div className="mb-4">
          <Alert tone="ok"><span className="inline-flex items-center gap-2 font-medium"><Trophy className="h-4 w-4" aria-hidden /> {t("shooting.match.personalBest", { total: fmt(pb.total), previous: fmt(pb.previousBest ?? 0) })}</span></Alert>
        </div>
      ) : null}
      <ScoreEntry key={match.status} match={toScoreMatch(match)} storageKey={`s:${match.id}`} tenantId={ctx.tenant.id} userId={ctx.user.id} lockedParticipantIds={lockedIds} refreshOnSave={!!officialKind} locale={locale} />
      {officialKind && officialRows.length ? (
        <div className="mt-5">
          <OfficialPanel rows={officialRows} canVerify={canVerify} kindLabel={officialKindText(t, officialKind)} ruleText={ruleText} decimal={decimal} locale={locale} />
        </div>
      ) : null}
      {finished ? (
        <div className="animate-fade mt-4 flex flex-wrap gap-2">
          <LinkButton href={`/scores/matches/new?${againQs.toString()}`} variant="secondary" size="sm"><Repeat className="h-4 w-4" aria-hidden /> {t("shooting.match.shootAgain")}</LinkButton>
          <LinkButton href={`/scores/leaderboard?programId=${match.program.id}`} variant="ghost" size="sm"><ListOrdered className="h-4 w-4" aria-hidden /> {t("shooting.common.leaderboard")}</LinkButton>
        </div>
      ) : null}
    </div>
  );
}
