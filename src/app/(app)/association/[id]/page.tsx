import type { Metadata } from "next";
import Link from "next/link";
import { Download, Landmark } from "lucide-react";
import { todayZurich } from "@/lib/time";
import { getRequestLocale, getT } from "@/lib/i18n";
import type { TFunction, Locale } from "@/lib/i18n/core";
import { dayKeyLabel } from "@/lib/i18n/extra/admin2/msg";
import { Alert, Badge, Button, Card, EmptyState, PageHeader, SectionTitle, Select, StatCard } from "@/components/ui";
import { currentSwissYear } from "@/modules/federal/queries";
import { parseYear, yearOptions } from "@/modules/federal/types";
import { listAssociationMembers, loadClubStats, requireAssociation, sharingScope } from "@/modules/association/queries";
import { nextDeadline, passRate, sumClubStats, type DeadlineView } from "@/modules/association/stats";
import { AssociationTabs } from "./tabs";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("adm2.assoc.a.title") };
}

function DeadlineBadge({ d, t, locale }: { d: DeadlineView; t: TFunction; locale: Locale }) {
  const tone = d.status === "today" || d.status === "soon" ? "warn" : d.status === "past" ? "neutral" : "outline";
  const when = d.status === "today" ? t("adm2.assoc.d.today") : d.status === "past" ? t("adm2.assoc.d.past") : t("adm2.assoc.d.inDays", { n: d.daysLeft });
  return <Badge tone={tone}>{t(`adm2.federal.dl.${d.key}`)}: {dayKeyLabel(d.day, locale)} ({when})</Badge>;
}

export default async function AssociationDashboardPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ year?: string }> }) {
  const { id } = await params;
  const ctx = await requireAssociation(id);
  const locale = await getRequestLocale();
  const t = getT(locale);
  const sp = await searchParams;
  const nowYear = currentSwissYear();
  const year = parseYear(sp.year, nowYear);
  const today = todayZurich();

  const members = await listAssociationMembers(ctx.association.id);
  const scope = sharingScope(ctx.access, members);
  const rows = await loadClubStats(scope.readable, scope.names, year, today);
  const sum = sumClubStats(rows);
  const pending = members.filter((m) => m.status === "PENDING" && !m.tenantDeletedAt).length;
  const rate = passRate(sum.op);

  return (
    <div>
      <PageHeader
        title={ctx.association.name}
        subtitle={`${ctx.association.region ? `${ctx.association.region} · ` : ""}${t(sum.clubs === 1 ? "adm2.assoc.d.activeClubs.one" : "adm2.assoc.d.activeClubs.other", { n: sum.clubs })} · ${year}`}
        back={{ href: "/association", label: t("adm2.assoc.a.title") }}
      />
      <AssociationTabs id={ctx.association.id} active="overview" pending={pending} />
      {ctx.association.deletedAt ? <Alert tone="warn" className="mb-4">{t("adm2.assoc.d.deleted")}</Alert> : null}
      {pending ? (
        <Alert tone="info" className="mb-4">
          {t(pending === 1 ? "adm2.assoc.d.waiting.one" : "adm2.assoc.d.waiting.other", { n: pending })} <Link href={`/association/${ctx.association.id}/clubs`} className="underline">{t("adm2.assoc.d.view")}</Link>
        </Alert>
      ) : null}

      <form method="get" className="mb-4 flex items-end gap-2.5">
        <label className="flex-1 max-w-48">
          <span className="block text-sm text-ink-3 mb-1">{t("adm2.assoc.d.year")}</span>
          <Select name="year" defaultValue={String(year)}>
            {yearOptions(nowYear).map((y) => <option key={y} value={y}>{y}</option>)}
          </Select>
        </label>
        <Button type="submit" variant="secondary">{t("adm2.assoc.d.show")}</Button>
        <a href={`/association/${ctx.association.id}/export?kind=stats&year=${year}`} className="press ml-auto inline-flex h-11 items-center gap-2 rounded-control border border-line px-3 text-sm font-medium" download>
          <Download className="h-4 w-4" aria-hidden /> CSV
        </a>
      </form>

      {rows.length === 0 ? (
        <EmptyState icon={<Landmark className="h-6 w-6" />} title={t("adm2.assoc.d.noClubs")} text={t("adm2.assoc.d.noClubsText")} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <StatCard label={t("adm2.assoc.d.members")} value={sum.members.total} hint={t("adm2.assoc.d.membersHint", { active: sum.members.active, juniors: sum.members.juniors })} />
            <StatCard label={t("adm2.assoc.d.op")} value={sum.op.shooters} hint={`${t("adm2.assoc.d.opHint", { n: sum.op.passed })}${rate !== null ? ` (${rate} %)` : ""}`} tone="accent" />
            <StatCard label={t("adm2.assoc.d.remaining")} value={sum.op.remaining} hint={t("adm2.assoc.d.remainingHint", { n: sum.op.notPassedResults })} tone={sum.op.remaining ? "warn" : "neutral"} />
            <StatCard label={t("adm2.assoc.d.fs")} value={sum.fs.participants} hint={t("adm2.assoc.d.fsHint", { n: sum.fs.confirmed })} />
          </div>
          {sum.unconfirmed ? <p className="mt-2 text-sm text-ink-3">{t("adm2.assoc.d.unconfirmed", { n: sum.unconfirmed })}</p> : null}

          <SectionTitle>{t("adm2.assoc.d.clubs")}</SectionTitle>
          <div className="space-y-2.5">
            {rows.map((r) => {
              const next = nextDeadline(r.deadlines);
              const clubRate = passRate(r.op);
              return (
                <Card key={r.tenantId} className="animate-rise p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-medium">{r.clubName}</div>
                    {r.unconfirmed ? <Badge tone="warn">{t("adm2.assoc.d.unconfirmedBadge", { n: r.unconfirmed })}</Badge> : null}
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                    <div><dt className="text-ink-3">{t("adm2.assoc.d.members")}</dt><dd className="tabular-nums">{r.members.total} <span className="text-ink-3">{t("adm2.assoc.d.membersRow", { active: r.members.active, juniors: r.members.juniors })}</span></dd></div>
                    <div><dt className="text-ink-3">{t("adm2.assoc.d.opShooters")}</dt><dd className="tabular-nums">{r.op.shooters}{clubRate !== null ? <span className="text-ink-3"> · {clubRate} %</span> : null}</dd></div>
                    <div><dt className="text-ink-3">{t("adm2.assoc.d.passedRemaining")}</dt><dd className="tabular-nums">{r.op.passed} / {r.op.remaining}{r.op.unknown ? <span className="text-ink-3">{t("adm2.assoc.d.noRule", { n: r.op.unknown })}</span> : null}</dd></div>
                    <div><dt className="text-ink-3">{t("adm2.assoc.d.fs")}</dt><dd className="tabular-nums">{r.fs.participants} <span className="text-ink-3">{t("adm2.assoc.d.guests", { n: r.fs.guests })}</span></dd></div>
                  </dl>
                  {r.deadlines.length ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {next ? <DeadlineBadge d={next} t={t} locale={locale} /> : <Badge tone="neutral">{t("adm2.assoc.d.allPast", { year })}</Badge>}
                    </div>
                  ) : <p className="mt-3 text-xs text-ink-3">{t("adm2.assoc.d.noDeadlines", { year })}</p>}
                </Card>
              );
            })}
          </div>
          <p className="mt-4 text-xs text-ink-3">
            {t("adm2.assoc.d.footer", { year })}
          </p>
        </>
      )}
    </div>
  );
}
