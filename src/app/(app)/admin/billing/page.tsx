import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Download, Landmark, Printer } from "lucide-react";
import { requireBillingAdmin } from "@/modules/billing/guard";
import { Badge, Card, PageHeader, SectionTitle } from "@/components/ui";
import { AdminBillingTabs } from "@/modules/billing/ui/admin-tabs";
import { currentYear, feeRunPreview, feeStats, listRuns } from "@/modules/billing/queries";
import { getBillingProfile } from "@/modules/billing/profile";
import { RunForm } from "@/modules/billing/ui/run-form";
import { YearSelect } from "@/modules/billing/ui/year-select";
import { formatMoney } from "@/lib/money";
import { formatDate, getRequestLocale, getT, getTenantLocale } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("adm1.home.billing") };
}

export default async function AdminBillingPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const ctx = await requireBillingAdmin();
  const ui = await getRequestLocale();
  const t = getT(ui);
  const sp = await searchParams;
  const rawYear = Number(sp.year);
  const year = Number.isInteger(rawYear) && rawYear >= 2000 && rawYear <= 2100 ? rawYear : currentYear();
  const [stats, runs, preview, profile, locale] = await Promise.all([feeStats(ctx.tenant.id, year), listRuns(ctx.tenant.id), feeRunPreview(ctx.tenant.id, year), getBillingProfile(ctx.tenant.id, ctx.tenant.name), getTenantLocale(ctx.tenant.id)]);
  // Titel erscheint auf der Rechnung und im QR-Zahlteil: in der Sprache des Vereins vorschlagen.
  const defaultTitle = `${getT(locale)("invoice.memberFee")} ${year}`;
  const run = runs.find((r) => r.year === year);
  // Gleiche Planung wie der Lauf selbst: ohne Ausgetretene und ohne Mitglieder in einer Haushaltsrechnung
  const eligible = preview.members;
  const last = runs[0];
  const years = [...new Set([currentYear() + 1, currentYear(), currentYear() - 1, ...runs.map((r) => r.year)])].sort((a, b) => b - a);

  return (
    <div>
      <PageHeader title={t("adm1.module.billing.name")} subtitle={ctx.tenant.name} back={{ href: "/me", label: t("adm1.home.more") }}
        action={<YearSelect year={year} years={years} />} />
      <AdminBillingTabs />

      {!profile.qrReady ? <Card className="p-4 mb-4 border-warn/40 bg-warn/5 text-sm">{t("adm1.bill.profileIncomplete")} <Link href="/admin/billing/settings" className="underline font-medium">{t("adm1.bill.profileIncompleteLink")}</Link>{t("adm1.bill.profileIncompleteAfter")}</Card> : null}

      <div className="stagger grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Card className="p-4"><div className="text-2xl font-semibold tabular-nums">{stats.withCategory}<span className="text-sm text-ink-3 font-normal"> / {stats.members}</span></div><div className="text-xs text-ink-3">{t("adm1.bill.membersWithFee")}</div></Card>
        <Card className="p-4">
          <div className="text-2xl font-semibold tabular-nums">{stats.invoiced}</div>
          <div className="text-xs text-ink-3">{t("adm1.bill.invoicesYear", { year })}</div>
          {stats.coverage.withFee ? (
            <div className="mt-1 text-xs text-ink-3">
              {stats.coverage.household ? `${t("adm1.bill.inHousehold", { n: stats.coverage.household })} · ` : ""}
              <span className={stats.coverage.notInvoiced ? "text-warn" : undefined}>{t("adm1.bill.notInvoiced", { n: stats.coverage.notInvoiced })}</span>
            </div>
          ) : null}
        </Card>
        <Card className="p-4"><div className="text-2xl font-semibold tabular-nums">{formatMoney(stats.openCents, profile.currency)}</div><div className="text-xs text-ink-3">{t("adm1.bill.openStat", { n: stats.open })}{stats.overdue ? ` · ${t("adm1.bill.overdueN", { n: stats.overdue })}` : ""}</div></Card>
        <Card className="p-4"><div className="text-2xl font-semibold tabular-nums">{formatMoney(stats.paidCents, profile.currency)}</div><div className="text-xs text-ink-3">{t("adm1.bill.paidStat", { n: stats.paid })}</div></Card>
      </div>

      <SectionTitle>{t("adm1.bill.annualInvoice", { year })}</SectionTitle>
      {run ? (
        <Link href={`/admin/billing/runs/${run.id}`} className="block press">
          <Card className="p-4 flex items-center gap-3 hover:border-ink/30">
            <div className="min-w-0 flex-1">
              <div className="font-medium">{run.title}</div>
              <div className="text-xs text-ink-3">{t("adm1.bill.runLine", { count: run.count, paid: run.paid, open: run.open, date: formatDate(run.dueAt, ui) })}</div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-2" aria-hidden><div className="h-full rounded-full bg-ok" style={{ width: `${run.totalCents ? Math.round((run.paidCents / run.totalCents) * 100) : 0}%` }} /></div>
            </div>
            <Badge tone={run.open === 0 ? "ok" : "warn"}>{run.open === 0 ? t("adm1.bill.allPaid") : t("adm1.bill.openN", { n: run.open })}</Badge>
            <ChevronRight className="h-4 w-4 text-ink-3" />
          </Card>
        </Link>
      ) : null}
      {eligible > 0 || !run ? (
        <div className="mt-2.5"><RunForm year={year} defaults={{ title: run?.title ?? defaultTitle, invoicePrefix: run?.invoicePrefix ?? last?.invoicePrefix ?? "MB-", dueDays: run?.dueDays ?? last?.dueDays ?? 30, note: run?.note ?? last?.note ?? null }} eligible={eligible} invoices={{ combined: preview.invoicesCombined, separate: preview.invoicesSeparate }} alreadyInvoiced={preview.alreadyInvoiced} /></div>
      ) : (
        <p className="mt-2 text-xs text-ink-3">{t("adm1.bill.allInvoiced", { year })}</p>
      )}

      <SectionTitle>{t("adm1.bill.paymentsExport")}</SectionTitle>
      <div className="animate-rise grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Link href="/admin/billing/import" className="press"><Card className="p-3.5 flex items-center gap-3 hover:border-ink/30 min-h-14"><Landmark className="h-5 w-5 text-ink-2" /><span className="min-w-0"><span className="block text-sm font-medium">{t("adm1.bill.camtTitle")}</span><span className="block text-xs text-ink-3">{t("adm1.bill.camtHint")}</span></span></Card></Link>
        <a href={`/api/export/billing?year=${year}`} className="press"><Card className="p-3.5 flex items-center gap-3 hover:border-ink/30 min-h-14"><Download className="h-5 w-5 text-ink-2" /><span className="min-w-0"><span className="block text-sm font-medium">{t("adm1.bill.csvTitle", { year })}</span><span className="block text-xs text-ink-3">{t("adm1.bill.csvHint")}</span></span></Card></a>
      </div>

      {runs.length > 1 || (runs.length === 1 && !run) ? (
        <>
          <SectionTitle>{t("adm1.bill.earlierYears")}</SectionTitle>
          <Card className="animate-rise divide-y divide-line overflow-hidden">
            {runs.filter((r) => r.year !== year).map((r) => (
              <Link key={r.id} href={`/admin/billing/runs/${r.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                <div className="min-w-0 flex-1"><div className="font-medium">{r.title}</div><div className="text-xs text-ink-3">{t("adm1.bill.earlierLine", { count: r.count, paid: formatMoney(r.paidCents, profile.currency), total: formatMoney(r.totalCents, profile.currency) })}</div></div>
                <Printer className="h-4 w-4 text-ink-3" />
              </Link>
            ))}
          </Card>
        </>
      ) : null}
    </div>
  );
}
