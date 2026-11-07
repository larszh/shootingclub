import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Award, BadgeCheck, Download, Printer, Trophy } from "lucide-react";
import { Alert, Badge, Card, EmptyState, LinkButton, LinkTabs, PageHeader, SectionTitle } from "@/components/ui";
import { formatScore } from "@/lib/utils";
import { canEditYear, canSeeAll, currentSwissYear, nowDate, requireFederal } from "@/modules/federal/queries";
import { awardSuggestions, fsAwardsOverview } from "@/modules/federal/awards-queries";
import { awardLimitsToText, isExampleLimits, type AwardResult } from "@/modules/federal/awards";
import { getRequestLocale, getT, type TFunction } from "@/lib/i18n";
import { formatSwissDate, parseYear, yearOptions } from "@/modules/federal/types";
import { fsAwardExample } from "@/modules/scores/presets";
import { AwardLimitsForm } from "@/modules/federal/ui/award-limits-form";
import { WeaponCategoryPanel } from "@/modules/federal/ui/award-weapon";
import { awardCategoryLabel } from "@/modules/federal/awards";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("adm2.federal.aw.meta") };
}

function AwardBadge({ r, t }: { r: AwardResult; t: TFunction }) {
  if (r.status === "award") return <Badge tone="ok" className="max-w-full truncate">{r.award}</Badge>;
  if (r.status === "none") return <Badge tone="outline">{t("adm2.federal.aw.none")}</Badge>;
  if (r.status === "no-category") return <Badge tone="warn">{t("adm2.federal.aw.noCategory")}</Badge>;
  return null;
}

/**
 * Feldschiessen-Auszeichnungen: Limitentabelle pro Programm und Jahr (Schützenmeister/Admin) und die
 * berechnete Auszeichnung pro Schütze. Druckliste und CSV für die Abgabe der Auszeichnungen.
 */
export default async function FederalAwardsPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const ctx = await requireFederal();
  if (!canSeeAll(ctx)) redirect("/federal?denied=1");
  const sp = await searchParams;
  const t = getT(await getRequestLocale());
  const thisYear = currentSwissYear(nowDate());
  const year = parseYear(sp.year, thisYear);
  const canEdit = canEditYear(ctx);
  const [overview, suggestions] = await Promise.all([fsAwardsOverview(ctx.tenant.id, year), canEdit ? awardSuggestions(ctx.tenant.id, year) : Promise.resolve(new Map<string, { year: number; text: string }>())]);
  const yearTabs = yearOptions(thisYear).map((y) => ({ value: String(y), href: `/federal/awards?year=${y}`, label: String(y) }));
  const total = overview.sections.reduce((s, x) => s + x.rows.length, 0);

  return (
    <div>
      <PageHeader
        title={t("adm2.federal.aw.title")}
        subtitle={`${ctx.tenant.name} · ${year}`}
        back={{ href: `/federal?year=${year}`, label: t("shooting.federal.title") }}
        action={total ? (
          <span className="flex gap-2">
            <LinkButton href={`/api/export/federal/awards?year=${year}`} variant="secondary" size="sm" className="h-11" prefetch={false}><Download className="h-4 w-4" aria-hidden /> CSV</LinkButton>
            <LinkButton href={`/federal/awards/print?year=${year}`} target="_blank" variant="secondary" size="sm" className="h-11"><Printer className="h-4 w-4" aria-hidden /> {t("adm2.federal.p.print")}</LinkButton>
          </span>
        ) : undefined}
      />
      <LinkTabs items={yearTabs} active={String(year)} label={t("shooting.federal.yearAria")} className="mb-4" />
      <Alert tone="info" className="mb-4">
        {t("adm2.federal.aw.intro")}
      </Alert>

      {overview.sections.length === 0 ? (
        <EmptyState icon={<Trophy className="h-5 w-5" />} title={t("adm2.federal.aw.noProgram")} text={t("adm2.federal.aw.noProgramText")} />
      ) : null}

      {overview.sections.map(({ program, limits, rows, counts, weaponCategories }) => {
        const text = awardLimitsToText(limits);
        const prev = suggestions.get(program.id);
        const suggestion = prev
          ? { text: prev.text, label: t("adm2.federal.aw.takeOver", { year: prev.year }) }
          : { text: fsAwardExample(program.max), label: t("adm2.federal.aw.insertExample") };
        return (
          <section key={program.id} className="mb-6">
            <SectionTitle>{program.name}</SectionTitle>
            <Card className="animate-rise space-y-3 p-4">
              {isExampleLimits(limits) ? <Alert tone="warn">{t("adm2.federal.aw.exampleNotice")}</Alert> : null}
              {limits.length ? (
                <ul className="divide-y divide-line text-sm">
                  {limits.map((l) => (
                    <li key={l.id} className="flex min-h-11 items-center justify-between gap-3 py-1.5">
                      <span className="min-w-0 truncate text-ink-2">{l.category}{l.weaponCategory ? ` · ${l.weaponCategory}` : ""}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="tabular-nums font-medium">{t("adm2.federal.aw.from", { score: formatScore(l.minScore, !Number.isInteger(l.minScore)) })}</span>
                        <Badge tone="outline">{l.award}</Badge>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-3">{t("adm2.federal.aw.noLimits", { year })} {t(canEdit ? "adm2.federal.aw.noLimitsEdit" : "adm2.federal.aw.noLimitsView")}</p>
              )}
              {canEdit ? (
                <details className="border-t border-line pt-3" open={!limits.length && rows.length > 0}>
                  <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">{t(limits.length ? "adm2.federal.aw.editLimits" : "adm2.federal.aw.enterLimits")}</summary>
                  <div className="mt-3">
                    <AwardLimitsForm programId={program.id} year={year} text={text} suggestion={text ? null : suggestion} max={program.max} />
                  </div>
                </details>
              ) : null}
            </Card>

            {rows.length ? (
              <>
                {counts.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {counts.map((c) => <Badge key={c.award} tone="ok"><Award className="mr-1 h-3 w-3" aria-hidden />{c.count} × {c.award}</Badge>)}
                  </div>
                ) : null}
                <Card className="animate-rise mt-3 divide-y divide-line overflow-hidden">
                  {rows.map((r) => (
                    <Link key={r.id} href={`/scores/matches/${r.matchId}`} className="press flex items-center gap-3 px-4 py-3 hover:bg-surface-2/60">
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium truncate">{r.name}{r.isGuest ? <span className="ml-1 text-xs text-ink-3">{t("adm2.federal.p.guest")}</span> : null}</span>
                        <span className="block text-xs text-ink-3 truncate">
                          {formatSwissDate(r.date)}{r.birthYear ? ` · ${t("adm2.federal.aw.born", { year: r.birthYear })}` : ` · ${t("adm2.federal.aw.noBirthYear")}`}{r.result.category ? ` · ${awardCategoryLabel(r.result)}` : ""}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block font-semibold tabular-nums">{formatScore(r.total, r.decimal)}</span>
                        <span className="block text-[11px] text-ink-3 tabular-nums">{t("adm2.federal.aw.zeros", { n: r.zeros ?? 0 })}</span>
                      </span>
                      <span className="flex w-24 shrink-0 justify-end sm:w-32"><AwardBadge r={r.result} t={t} /></span>
                      {r.isOfficial ? <BadgeCheck className="h-4 w-4 shrink-0 text-accent" aria-label={t("adm2.federal.p.officialAria")} /> : <span className="w-4 shrink-0" />}
                    </Link>
                  ))}
                </Card>
                {canEdit ? (
                  <WeaponCategoryPanel
                    options={weaponCategories}
                    rows={overview.participants.filter((x) => x.programId === program.id).map((x) => ({ id: x.id, name: x.name, detail: formatSwissDate(x.date), weaponCategory: x.weaponCategory }))}
                  />
                ) : null}
                {rows.some((r) => r.result.status === "no-category") ? (
                  <p className="mt-2 text-xs text-ink-3">{t("adm2.federal.aw.noCategoryHint")}</p>
                ) : null}
              </>
            ) : (
              <p className="mt-3 text-sm text-ink-3">{t("adm2.federal.aw.noResults", { year })}</p>
            )}
          </section>
        );
      })}

      {overview.orphanCount ? <p className="text-xs text-ink-3">{t("adm2.federal.aw.orphans", { n: overview.orphanCount })}</p> : null}
      <p className="mt-4 text-xs text-ink-3">{t("adm2.federal.aw.rules")}</p>
    </div>
  );
}
