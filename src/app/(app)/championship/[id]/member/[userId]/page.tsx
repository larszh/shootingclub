import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, PageHeader, SectionTitle, StatCard } from "@/components/ui";
import { formatDate, getRequestLocale, getT, type Locale, type TFunction } from "@/lib/i18n";
import { canViewChampionship, requireChampionship } from "@/modules/championship/guard";
import { getChampionship, loadRanking, type ResultInfo } from "@/modules/championship/queries";
import { findEntry, type ScoredResult } from "@/modules/championship/ranking";
import { NO_CATEGORY, formatPoints, formatWeight } from "@/modules/championship/types";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("shooting.champ.memberTitle") };
}

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
  const locale = await getRequestLocale();
  const t = getT(locale);

  return (
    <div>
      <PageHeader title={me ? t("shooting.champ.myStanding") : entry.name} subtitle={c.name} back={{ href: `/championship/${c.id}`, label: t("shooting.champ.ranking") }} />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={t("shooting.champ.stat.rank")} value={entry.rank ?? "–"} hint={entry.rank ? t("shooting.champ.stat.ofN", { n: ranking.ranked.length }) : t("shooting.champ.unclassified")} tone="accent" />
        <StatCard label={t("shooting.champ.stat.total")} value={formatPoints(entry.total)} hint={entry.bonus ? t("shooting.champ.stat.inclBonus", { n: formatPoints(entry.bonus) }) : undefined} />
        <StatCard label={t("shooting.champ.stat.category")} value={<span className="text-base">{entry.category === NO_CATEGORY ? t("shooting.champ.noCategory") : entry.category}</span>} hint={categoryRank && entry.category !== NO_CATEGORY ? t("shooting.champ.rankN", { n: categoryRank }) : undefined} />
        <StatCard label={t("shooting.champ.stat.best")} value={formatPoints(entry.bestSingle)} hint={t("shooting.champ.stat.counted", { n: entry.countedResults })} />
      </div>
      {entry.missingRequired.length ? <p className="mb-4 rounded-control bg-warn/10 px-3 py-2 text-sm text-warn">{t("shooting.champ.missingRequired", { list: entry.missingRequired.join(", ") })}</p> : null}

      {entry.programs.map((p) => (
        <section key={p.programId}>
          <SectionTitle action={<span className="text-xs text-ink-3">{p.limit === null ? t("shooting.champ.allCountShort") : t("shooting.champ.bestN", { n: p.limit })}{p.weight !== 1 ? ` · ${formatWeight(p.weight)}` : ""}</span>}>
            {p.name}
          </SectionTitle>
          <Card className="divide-y divide-line overflow-hidden">
            {p.counted.length === 0 ? (
              <div className="flex items-center gap-2 px-4 py-3 text-sm text-ink-3">{t("shooting.champ.noResultYet")}{p.required ? <Badge tone="warn">{t("shooting.champ.required")}</Badge> : null}</div>
            ) : (
              p.counted.map((r) => <ResultRow key={r.participantId} r={r} info={info} canOpenMatch={canOpenMatch} locale={locale} t={t} />)
            )}
            {p.struck.length ? (
              <>
                <div className="bg-surface-2 px-4 py-1.5 text-xs font-medium text-ink-3">{t("shooting.champ.struck")}</div>
                {p.struck.map((r) => <ResultRow key={r.participantId} r={r} info={info} canOpenMatch={canOpenMatch} locale={locale} t={t} struck />)}
              </>
            ) : null}
            {p.counted.length ? (
              <div className="flex justify-between gap-3 bg-surface-2 px-4 py-2 text-sm">
                <span>{t("shooting.champ.sum")}{p.weight !== 1 ? ` ${formatPoints(p.sum)} ${formatWeight(p.weight)}` : ""}</span>
                <span className="font-semibold tabular-nums">{formatPoints(p.weighted)}</span>
              </div>
            ) : null}
          </Card>
        </section>
      ))}
    </div>
  );
}

function ResultRow({ r, struck, info, canOpenMatch, locale, t }: { r: ScoredResult; struck?: boolean; info: Map<string, ResultInfo>; canOpenMatch: boolean; locale: Locale; t: TFunction }) {
  const i = info.get(r.participantId);
  const body = (
    <>
      <div className="min-w-0">
        <div className={struck ? "text-ink-3 line-through decoration-ink-3/60" : "font-medium"}>{i ? formatDate(i.date, locale, { weekday: "short" }) : r.day}</div>
        <div className="truncate text-xs text-ink-3">{[i?.title, r.isOfficial ? t("shooting.champ.confirmed") : null].filter(Boolean).join(" · ") || t("shooting.champ.match")}</div>
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
