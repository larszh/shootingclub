import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, PageHeader, SectionTitle, StatCard } from "@/components/ui";
import { formatDateZurich } from "@/lib/time";
import { canViewChampionship, requireChampionship } from "@/modules/championship/guard";
import { getChampionship, loadRanking, type ResultInfo } from "@/modules/championship/queries";
import { findEntry, type ScoredResult } from "@/modules/championship/ranking";
import { NO_CATEGORY, formatPoints, formatWeight } from "@/modules/championship/types";

export const metadata: Metadata = { title: "Resultate Meisterschaft" };

export default async function ChampionshipMemberPage({ params }: { params: Promise<{ id: string; userId: string }> }) {
  const ctx = await requireChampionship();
  const { id, userId } = await params;
  const c = await getChampionship(ctx.tenant.id, id);
  if (!c || !canViewChampionship(ctx, c)) notFound();
  const { ranking, info } = await loadRanking(ctx.tenant.id, c);
  const { entry, categoryRank } = findEntry(ranking, userId);
  if (!entry) notFound();
  const me = entry.userId === ctx.user.id;
  // Links zum Durchgang nur, wenn man ihn sehen darf (eigene Teilnahme oder alle Resultate).
  const canOpenMatch = me || ctx.can("match.viewAll");

  return (
    <div>
      <PageHeader title={me ? "Mein Stand" : entry.name} subtitle={c.name} back={{ href: `/championship/${c.id}`, label: "Rangliste" }} />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Rang" value={entry.rank ?? "–"} hint={entry.rank ? `von ${ranking.ranked.length}` : "nicht klassiert"} tone="accent" />
        <StatCard label="Total" value={formatPoints(entry.total)} hint={entry.bonus ? `inkl. Bonus +${formatPoints(entry.bonus)}` : undefined} />
        <StatCard label="Kategorie" value={<span className="text-base">{entry.category}</span>} hint={categoryRank && entry.category !== NO_CATEGORY ? `${categoryRank}. Rang` : undefined} />
        <StatCard label="Bestes Resultat" value={formatPoints(entry.bestSingle)} hint={`${entry.countedResults} gezählt`} />
      </div>
      {entry.missingRequired.length ? <p className="mb-4 rounded-control bg-warn/10 px-3 py-2 text-sm text-warn">Fehlende Pflichtprogramme: {entry.missingRequired.join(", ")}.</p> : null}

      {entry.programs.map((p) => (
        <section key={p.programId}>
          <SectionTitle action={<span className="text-xs text-ink-3">{p.limit === null ? "alle zählen" : `beste ${p.limit}`}{p.weight !== 1 ? ` · ${formatWeight(p.weight)}` : ""}</span>}>
            {p.name}
          </SectionTitle>
          <Card className="divide-y divide-line overflow-hidden">
            {p.counted.length === 0 ? (
              <div className="flex items-center gap-2 px-4 py-3 text-sm text-ink-3">Noch kein Resultat{p.required ? <Badge tone="warn">Pflicht</Badge> : null}</div>
            ) : (
              p.counted.map((r) => <ResultRow key={r.participantId} r={r} info={info} canOpenMatch={canOpenMatch} />)
            )}
            {p.struck.length ? (
              <>
                <div className="bg-surface-2 px-4 py-1.5 text-xs font-medium text-ink-3">Gestrichen</div>
                {p.struck.map((r) => <ResultRow key={r.participantId} r={r} info={info} canOpenMatch={canOpenMatch} struck />)}
              </>
            ) : null}
            {p.counted.length ? (
              <div className="flex justify-between gap-3 bg-surface-2 px-4 py-2 text-sm">
                <span>Summe{p.weight !== 1 ? ` ${formatPoints(p.sum)} ${formatWeight(p.weight)}` : ""}</span>
                <span className="font-semibold tabular-nums">{formatPoints(p.weighted)}</span>
              </div>
            ) : null}
          </Card>
        </section>
      ))}
    </div>
  );
}

function ResultRow({ r, struck, info, canOpenMatch }: { r: ScoredResult; struck?: boolean; info: Map<string, ResultInfo>; canOpenMatch: boolean }) {
  const i = info.get(r.participantId);
  const body = (
    <>
      <div className="min-w-0">
        <div className={struck ? "text-ink-3 line-through decoration-ink-3/60" : "font-medium"}>{i ? formatDateZurich(i.date) : r.day}</div>
        <div className="truncate text-xs text-ink-3">{[i?.title, r.isOfficial ? "bestätigt" : null].filter(Boolean).join(" · ") || "Durchgang"}</div>
      </div>
      <div className={`shrink-0 text-right text-lg tabular-nums ${struck ? "text-ink-3 line-through" : "font-semibold"}`}>{formatPoints(r.score)}</div>
    </>
  );
  return canOpenMatch ? (
    <Link href={`/scores/matches/${r.matchId}`} className="flex min-h-12 items-center justify-between gap-3 px-4 py-2 hover:bg-surface-2">{body}</Link>
  ) : (
    <div className="flex min-h-12 items-center justify-between gap-3 px-4 py-2">{body}</div>
  );
}
