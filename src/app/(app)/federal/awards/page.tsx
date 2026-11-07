import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Award, BadgeCheck, Download, Printer, Trophy } from "lucide-react";
import { Alert, Badge, Card, EmptyState, LinkButton, LinkTabs, PageHeader, SectionTitle } from "@/components/ui";
import { formatScore } from "@/lib/utils";
import { canEditYear, canSeeAll, currentSwissYear, nowDate, requireFederal } from "@/modules/federal/queries";
import { awardSuggestions, fsAwardsOverview } from "@/modules/federal/awards-queries";
import { AWARD_EXAMPLE_HINT, AWARD_LIMITS_HINT, awardLimitsToText, type AwardResult } from "@/modules/federal/awards";
import { formatSwissDate, parseYear, yearOptions } from "@/modules/federal/types";
import { fsAwardExample } from "@/modules/scores/presets";
import { AwardLimitsForm } from "@/modules/federal/ui/award-limits-form";

export const metadata: Metadata = { title: "Feldschiessen: Auszeichnungen" };

function AwardBadge({ r }: { r: AwardResult }) {
  if (r.status === "award") return <Badge tone="ok" className="max-w-full truncate">{r.award}</Badge>;
  if (r.status === "none") return <Badge tone="outline">keine</Badge>;
  if (r.status === "no-category") return <Badge tone="warn">keine Kategorie</Badge>;
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
  const thisYear = currentSwissYear(nowDate());
  const year = parseYear(sp.year, thisYear);
  const canEdit = canEditYear(ctx);
  const [overview, suggestions] = await Promise.all([fsAwardsOverview(ctx.tenant.id, year), canEdit ? awardSuggestions(ctx.tenant.id, year) : Promise.resolve(new Map<string, { year: number; text: string }>())]);
  const yearTabs = yearOptions(thisYear).map((y) => ({ value: String(y), href: `/federal/awards?year=${y}`, label: String(y) }));
  const total = overview.sections.reduce((s, x) => s + x.rows.length, 0);

  return (
    <div>
      <PageHeader
        title="Auszeichnungen Feldschiessen"
        subtitle={`${ctx.tenant.name} · ${year}`}
        back={{ href: `/federal?year=${year}`, label: "Bundesübungen" }}
        action={total ? (
          <span className="flex gap-2">
            <LinkButton href={`/api/export/federal/awards?year=${year}`} variant="secondary" size="sm" className="h-11" prefetch={false}><Download className="h-4 w-4" aria-hidden /> CSV</LinkButton>
            <LinkButton href={`/federal/awards/print?year=${year}`} target="_blank" variant="secondary" size="sm" className="h-11"><Printer className="h-4 w-4" aria-hidden /> Drucken</LinkButton>
          </span>
        ) : undefined}
      />
      <LinkTabs items={yearTabs} active={String(year)} label="Jahr wählen" className="mb-4" />
      <Alert tone="info" className="mb-4">
        {AWARD_LIMITS_HINT} Die Limiten (z.B. Kranz, Anerkennungskarte) legt die Ausschreibung des jeweiligen Jahres fest. Die App rechnet nur mit den hier erfassten Werten; bitte vor der Abgabe prüfen.
      </Alert>

      {overview.sections.length === 0 ? (
        <EmptyState icon={<Trophy className="h-5 w-5" />} title="Kein Feldschiessen-Programm" text="Programme der Art «Feldschiessen» erscheinen hier, sobald sie im Verein sichtbar sind (Punkteerfassung → Programme)." />
      ) : null}

      {overview.sections.map(({ program, limits, rows, counts }) => {
        const text = awardLimitsToText(limits);
        const prev = suggestions.get(program.id);
        const suggestion = prev
          ? { text: prev.text, label: `Limiten ${prev.year} übernehmen` }
          : { text: fsAwardExample(program.max), label: `${AWARD_EXAMPLE_HINT}: einfügen` };
        return (
          <section key={program.id} className="mb-6">
            <SectionTitle>{program.name}</SectionTitle>
            <Card className="animate-rise space-y-3 p-4">
              {limits.length ? (
                <ul className="divide-y divide-line text-sm">
                  {limits.map((l) => (
                    <li key={l.id} className="flex min-h-11 items-center justify-between gap-3 py-1.5">
                      <span className="min-w-0 truncate text-ink-2">{l.category}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="tabular-nums font-medium">ab {formatScore(l.minScore, !Number.isInteger(l.minScore))}</span>
                        <Badge tone="outline">{l.award}</Badge>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-3">Für {year} sind noch keine Limiten erfasst. {canEdit ? "Limiten gemäss Ausschreibung unten eintragen." : "Der Schützenmeister trägt sie ein."}</p>
              )}
              {canEdit ? (
                <details className="border-t border-line pt-3" open={!limits.length && rows.length > 0}>
                  <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">{limits.length ? "Limiten bearbeiten" : "Limiten eintragen"}</summary>
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
                        <span className="block font-medium truncate">{r.name}{r.isGuest ? <span className="ml-1 text-xs text-ink-3">(Gast)</span> : null}</span>
                        <span className="block text-xs text-ink-3 truncate">
                          {formatSwissDate(r.date)}{r.birthYear ? ` · Jg. ${r.birthYear}` : " · ohne Jahrgang"}{r.result.category ? ` · ${r.result.category}` : ""}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block font-semibold tabular-nums">{formatScore(r.total, r.decimal)}</span>
                        <span className="block text-[11px] text-ink-3 tabular-nums">{r.zeros ?? 0} Nuller</span>
                      </span>
                      <span className="flex w-24 shrink-0 justify-end sm:w-32"><AwardBadge r={r.result} /></span>
                      {r.isOfficial ? <BadgeCheck className="h-4 w-4 shrink-0 text-accent" aria-label="amtlich bestätigt" /> : <span className="w-4 shrink-0" />}
                    </Link>
                  ))}
                </Card>
                {rows.some((r) => r.result.status === "no-category") ? (
                  <p className="mt-2 text-xs text-ink-3">«keine Kategorie»: Geburtsdatum fehlt (z.B. Gäste) oder kein Alter passt. Eine Kategorie ohne Alter (z.B. «Alle») gilt für alle.</p>
                ) : null}
              </>
            ) : (
              <p className="mt-3 text-sm text-ink-3">Noch keine Resultate in diesem Programm für {year}.</p>
            )}
          </section>
        );
      })}

      {overview.orphanCount ? <p className="text-xs text-ink-3">{overview.orphanCount} Resultate in Programmen, die im Verein nicht mehr sichtbar sind, werden hier nicht berücksichtigt.</p> : null}
      <p className="mt-4 text-xs text-ink-3">Pro Schütze zählt das amtlich bestätigte Resultat, sonst das beste des Jahres. Kategorie nach Jahrgang (Jahr minus Geburtsjahr). Massgebend ist die höchste erreichte Limite in der Kategorie.</p>
    </div>
  );
}
