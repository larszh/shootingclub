import type { Metadata } from "next";
import Link from "next/link";
import { Info } from "lucide-react";
import { Alert, Card, PageHeader, SectionTitle, StatCard } from "@/components/ui";
import { getRequestLocale, getT, type TFunction } from "@/lib/i18n";
import { requirePermission } from "@/lib/tenant";
import { todayZurich } from "@/lib/time";
import { cn } from "@/lib/utils";
import { aiAvailability } from "@/lib/ai";
import { kindLabel } from "@/modules/events/ui/i18n";
import { chf, parseReportYear, REPORT_MIN_YEAR, type ReportAggregates } from "@/modules/ai/content/reports/aggregates";
import { loadReportAggregates } from "@/modules/ai/content/reports/queries";
import { getReportDraft, payloadHashOf } from "@/modules/ai/content/service";
import { ReportEditor } from "@/modules/ai/content/ui/report-editor";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("aicontent.report.metaTitle") };
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 px-4 py-2">
      <span className="text-sm text-ink-2">{label}</span>
      <span className="text-right font-medium tabular-nums">{value}</span>
    </div>
  );
}

function Figures({ a, t, locale }: { a: ReportAggregates; t: TFunction; locale: string }) {
  const statuses = Object.entries(a.members.byStatus).filter(([, n]) => n > 0);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label={t("aicontent.fig.membersEnd")} value={a.members.atYearEnd} />
        <StatCard label={t("aicontent.fig.joined")} value={a.members.joined} tone="ok" />
        <StatCard label={t("aicontent.fig.left")} value={a.members.left} />
        <StatCard label={t("aicontent.fig.juniors")} value={a.members.juniors} tone="accent" />
      </div>
      {statuses.length ? (
        <Card className="divide-y divide-line">
          {statuses.map(([s, n]) => <Row key={s} label={t(`aicontent.status.${s}`)} value={n} />)}
        </Card>
      ) : null}

      {a.events ? (
        <>
          <SectionTitle>{t("aicontent.fig.events")}</SectionTitle>
          <Card className="divide-y divide-line">
            <Row label={t("aicontent.fig.eventsHeld")} value={a.events.held} />
            {Object.entries(a.events.byKind).map(([k, n]) => <Row key={k} label={`– ${kindLabel(k, locale, true)}`} value={n} />)}
            <Row label={t("aicontent.fig.eventsCancelled")} value={a.events.cancelled} />
            <Row label={t("aicontent.fig.registrations")} value={a.events.registrations} />
          </Card>
        </>
      ) : null}

      {a.bookings ? (
        <>
          <SectionTitle>{t("aicontent.fig.bookings")}</SectionTitle>
          <Card className="divide-y divide-line">
            <Row label={t("aicontent.fig.bookingsConfirmed")} value={a.bookings.confirmed} />
            <Row label={t("aicontent.fig.bookingsPersons")} value={a.bookings.persons} />
            <Row label={t("aicontent.fig.bookingsCancelled")} value={a.bookings.cancelled} />
          </Card>
        </>
      ) : null}

      {a.op || a.fs ? (
        <>
          <SectionTitle>{t("aicontent.fig.federal")}</SectionTitle>
          <Card className="divide-y divide-line">
            {a.op ? (
              <>
                <Row label={t("aicontent.fig.opShooters")} value={a.op.shooters} />
                <Row label={t("aicontent.fig.opPassed")} value={a.op.passed} />
                <Row label={t("aicontent.fig.opRemaining")} value={a.op.remaining} />
                <Row label={t("aicontent.fig.opRate")} value={a.op.passRatePercent === null ? "–" : `${a.op.passRatePercent}%`} />
              </>
            ) : null}
            {a.fs ? <Row label={t("aicontent.fig.fsParticipants")} value={a.fs.participants} /> : null}
          </Card>
        </>
      ) : null}

      {a.championships ? (
        <>
          <SectionTitle>{t("aicontent.fig.championships")}</SectionTitle>
          {a.championships.length ? (
            <Card className="divide-y divide-line">
              {a.championships.map((c, i) => (
                <div key={i} className="px-4 py-2.5">
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-ink-3">{t("aicontent.fig.classified", { n: c.classified })}</p>
                  {c.podium.length ? <ol className="mt-1 text-sm text-ink-2">{c.podium.map((p, j) => <li key={j}>{p.rank}. {p.name} ({p.total})</li>)}</ol> : null}
                </div>
              ))}
            </Card>
          ) : <p className="text-sm text-ink-3">{t("aicontent.fig.noChampionship")}</p>}
        </>
      ) : null}

      {a.finance ? (
        <>
          <SectionTitle>{t("aicontent.fig.finance")}</SectionTitle>
          <Card className="divide-y divide-line">
            <div className="grid grid-cols-3 gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-ink-3">
              <span />
              <span className="text-right">{t("aicontent.fig.invoiced")}</span>
              <span className="text-right">{t("aicontent.fig.received")}</span>
            </div>
            {Object.entries(a.finance.revenue).filter(([, r]) => r.invoicedCents || r.receivedCents).map(([k, r]) => (
              <div key={k} className="grid min-h-11 grid-cols-3 items-center gap-2 px-4 py-2 text-sm">
                <span className="text-ink-2">{t(`aicontent.fin.${k}`)}</span>
                <span className="text-right tabular-nums">{chf(r.invoicedCents)}</span>
                <span className="text-right tabular-nums">{chf(r.receivedCents)}</span>
              </div>
            ))}
            <div className="grid min-h-11 grid-cols-3 items-center gap-2 px-4 py-2 text-sm font-semibold">
              <span>{t("aicontent.fig.total")}</span>
              <span className="text-right tabular-nums">{chf(a.finance.totals.invoicedCents)}</span>
              <span className="text-right tabular-nums">{chf(a.finance.totals.receivedCents)}</span>
            </div>
          </Card>
          <p className="text-xs text-ink-3">{t("aicontent.fig.financeNote")}</p>
        </>
      ) : null}
    </div>
  );
}

export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const ctx = await requirePermission("tenant.manage");
  const sp = await searchParams;
  const locale = await getRequestLocale();
  const t = getT(locale);
  const currentYear = Number(todayZurich().slice(0, 4));
  const year = parseReportYear(sp.year, currentYear);
  const years = Array.from({ length: 6 }, (_, i) => currentYear - i).filter((y) => y >= REPORT_MIN_YEAR);

  const [aggregates, avail, draft] = await Promise.all([
    loadReportAggregates(ctx, year),
    aiAvailability(ctx, "reports"),
    getReportDraft(ctx.tenant.id, year),
  ]);
  const stale = !!draft && draft.payloadHash !== payloadHashOf(aggregates);
  const showAi = avail.ok || !["clubOff", "clubsNotAllowed", "featureOff", "platformOff"].includes(avail.reason) || !!draft;

  return (
    <div className="space-y-4">
      <PageHeader title={t("aicontent.report.title")} subtitle={ctx.tenant.name} back={{ href: "/admin", label: t("aicontent.back") }} />

      <nav aria-label={t("aicontent.report.yearLabel")} className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {years.map((y) => (
          <Link key={y} href={`/admin/reports?year=${y}`} scroll={false} aria-current={y === year ? "page" : undefined}
            className={cn("press inline-flex h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium tabular-nums", y === year ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2")}>
            {y}
          </Link>
        ))}
      </nav>

      <Alert tone="info" icon={<Info className="h-4 w-4" />}>{t("aicontent.report.numbersNote")}</Alert>

      <SectionTitle>{t("aicontent.report.figures", { year })}</SectionTitle>
      <Figures a={aggregates} t={t} locale={locale} />

      {showAi ? (
        <>
          <SectionTitle>{t("aicontent.report.textTitle")}</SectionTitle>
          <ReportEditor
            key={year}
            year={year}
            clubName={ctx.tenant.name}
            initial={draft}
            ai={avail.ok ? { ok: true } : { ok: false, messageKey: `ai.unavailable.${avail.reason}` }}
            stale={stale}
          />
        </>
      ) : (
        <p className="text-sm text-ink-3">{t("aicontent.report.aiOff")}</p>
      )}
    </div>
  );
}
