import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus, Trophy } from "lucide-react";
import { Alert, Badge, Card, EmptyState, LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { todayZurich } from "@/lib/time";
import { canManageChampionship, requireChampionship } from "@/modules/championship/guard";
import { chDay, getChampionship, listChampionships, loadRanking, type ChampionshipListItem } from "@/modules/championship/queries";
import { findEntry } from "@/modules/championship/ranking";
import { MyStanding } from "@/modules/championship/ui/my-standing";
import { getRequestLocale, getT } from "@/lib/i18n";
import { tCount } from "@/modules/scores/ui/labels";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("shooting.champ.title") };
}

export default async function ChampionshipPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const ctx = await requireChampionship();
  const sp = await searchParams;
  const manage = canManageChampionship(ctx);
  const locale = await getRequestLocale();
  const t = getT(locale);
  const tenantId = ctx.tenant.id;
  const today = todayZurich();
  const thisYear = Number(today.slice(0, 4));
  const list = await listChampionships(tenantId, { includeUnpublished: manage });

  // «Mein Stand» für laufende bzw. aktuelle Meisterschaften (höchstens drei)
  const current = list.filter((c) => c.isPublished && (c.year === thisYear || (c.startsOn <= today && c.endsOn >= today))).slice(0, 3);
  const standings = await Promise.all(
    current.map(async (c) => {
      const view = await getChampionship(tenantId, c.id);
      if (!view) return null;
      const { ranking } = await loadRanking(tenantId, view);
      return { c, ...findEntry(ranking, ctx.user.id), totalRanked: ranking.ranked.length };
    }),
  );

  const byYear = new Map<number, ChampionshipListItem[]>();
  for (const c of list) byYear.set(c.year, [...(byYear.get(c.year) ?? []), c]);
  const years = [...byYear.keys()].sort((a, b) => b - a);

  return (
    <div>
      <PageHeader
        title={t("shooting.champ.title")}
        subtitle={t("shooting.champ.subtitle")}
        action={manage ? <LinkButton href="/championship/new"><Plus className="h-4 w-4" /> {t("shooting.champ.new")}</LinkButton> : undefined}
      />
      {sp.denied ? <Alert className="mb-4">{t("shooting.champ.denied")}</Alert> : null}

      {standings.some(Boolean) ? (
        <div className="mb-6 space-y-3">
          {standings.map((s) => (s ? <MyStanding key={s.c.id} championshipId={s.c.id} name={s.c.name} entry={s.entry} categoryRank={s.categoryRank} totalRanked={s.totalRanked} compact locale={locale} /> : null))}
        </div>
      ) : null}

      {list.length === 0 ? (
        <EmptyState
          icon={<Trophy className="h-5 w-5" />}
          title={manage ? t("shooting.champ.emptyManage") : t("shooting.champ.emptyMember")}
          text={manage ? t("shooting.champ.emptyManageText") : t("shooting.champ.emptyMemberText")}
          action={manage ? <LinkButton href="/championship/new"><Plus className="h-4 w-4" /> {t("shooting.champ.create")}</LinkButton> : undefined}
        />
      ) : (
        years.map((y) => (
          <section key={y}>
            <SectionTitle>{y === thisYear ? t("shooting.champ.yearCurrent", { year: y }) : String(y)}</SectionTitle>
            <Card className="animate-rise mb-4 divide-y divide-line overflow-hidden">
              {byYear.get(y)!.map((c) => (
                <Link key={c.id} href={`/championship/${c.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-surface-2">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-2"><Trophy className="h-5 w-5" aria-hidden /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{c.name}</span>
                      {manage && !c.isPublished ? <Badge tone="warn">{t("shooting.champ.unpublished")}</Badge> : null}
                    </div>
                    <div className="text-xs text-ink-3">{chDay(c.startsOn)} – {chDay(c.endsOn)} · {tCount(t, "shooting.champ.programs", c.programCount)}</div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
                </Link>
              ))}
            </Card>
          </section>
        ))
      )}
    </div>
  );
}
