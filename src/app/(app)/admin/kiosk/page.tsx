import type { Metadata } from "next";
import Link from "next/link";
import { Alert, Badge, Card, PageHeader, SectionTitle, StatCard } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { todayZurich } from "@/lib/time";
import { INTL_LOCALE, formatDate, getRequestLocale, getT } from "@/lib/i18n";
import { localizePresets, periodText } from "@/modules/kiosk/ui/i18n";
import { requireKioskAdmin } from "@/modules/kiosk/guard";
import { billingPreview, kioskInvoices, kioskStats } from "@/modules/kiosk/queries";
import { invoiceCategoryName, periodPresets, resolvePeriod } from "@/modules/kiosk/logic";
import { getBillingProfile } from "@/modules/billing/profile";
import { FEE_INVOICE_STATUS } from "@/modules/billing/types";
import { KioskBillingPanel, type KioskBillingCandidate } from "@/modules/kiosk/ui/billing-panel";
import { PeriodPicker } from "@/modules/kiosk/ui/period-picker";
import { KioskInvoiceActions, ReleaseCancelledButton } from "@/modules/kiosk/ui/entry-buttons";

export async function generateMetadata(): Promise<Metadata> {
  const t = getT(await getRequestLocale());
  return { title: t("adm1.kiosk.metaTitle", { area: t("adm1.home.kiosk"), tab: t("adm1.kiosk.tab.billing") }) };
}

export default async function AdminKioskPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; preset?: string }> }) {
  const ctx = await requireKioskAdmin();
  const sp = await searchParams;
  const locale = await getRequestLocale();
  const t = getT(locale);
  const entries = (n: number) => t(n === 1 ? "adm1.kiosk.entries.one" : "adm1.kiosk.entries.other", { n });
  const dayFmt = new Intl.DateTimeFormat(INTL_LOCALE[locale], { timeZone: "Europe/Zurich", day: "2-digit", month: "2-digit" });
  const day = (d: Date | null) => (d ? dayFmt.format(d) : "");
  const tenantId = ctx.tenant.id;
  const today = todayZurich();
  const period = resolvePeriod(sp, today);
  const [stats, preview, profile, invoices] = await Promise.all([
    kioskStats(tenantId),
    billingPreview(tenantId, period),
    getBillingProfile(tenantId, ctx.tenant.name),
    kioskInvoices(tenantId),
  ]);
  // Status ändern (bezahlt/offen/storniert) geht über die Beitragsverwaltung: Admin (tenant.manage) und Modul aktiv.
  const canSetStatus = ctx.can("tenant.manage") && ctx.hasModule("billing");
  const candidates: KioskBillingCandidate[] = preview.rows.map((r) => ({
    userId: r.userId, name: r.name, count: r.count, totalCents: r.totalCents, billable: r.billable,
    range: r.firstAt && r.lastAt ? (day(r.firstAt) === day(r.lastAt) ? day(r.firstAt) : `${day(r.firstAt)}–${day(r.lastAt)}`) : "",
  }));
  const blocker = !ctx.hasModule("billing")
    ? t("adm1.kiosk.blockerBilling")
    : !profile.payeeName || !profile.iban ? t("adm1.kiosk.blockerProfile") : null;
  const label = periodText(period, locale);

  return (
    <div>
      <PageHeader title={t("adm1.home.kiosk")} subtitle={t("adm1.kiosk.subtitle")} back={{ href: "/admin", label: t("adm1.home.title") }} />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={t("adm1.kiosk.openTotal")} value={formatMoney(stats.openCents, profile.currency)} tone={stats.openCents ? "warn" : "neutral"} hint={entries(stats.openCount)} />
        <StatCard label={t("adm1.kiosk.membersOpen")} value={stats.openMembers} />
        <StatCard label={t("adm1.kiosk.cashToday")} value={formatMoney(stats.cashTodayCents, profile.currency)} hint={entries(stats.cashTodayCount)} href="/admin/kiosk/cash" />
        <StatCard label={t("adm1.kiosk.inPeriod")} value={formatMoney(preview.totalCents, profile.currency)} hint={label} />
      </div>

      {stats.releasable ? (
        <Alert tone="info" className="mb-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="min-w-0 flex-1">{t(stats.releasable === 1 ? "adm1.kiosk.releasable.one" : "adm1.kiosk.releasable.other", { n: stats.releasable })}</span>
            <ReleaseCancelledButton count={stats.releasable} />
          </div>
        </Alert>
      ) : null}

      <SectionTitle>{t("adm1.kiosk.period")}</SectionTitle>
      <PeriodPicker basePath="/admin/kiosk" presets={localizePresets(t, periodPresets(today))} current={period} />

      <p className="mb-3 text-sm text-ink-3">
        {t("adm1.kiosk.billingExplain", { name: invoiceCategoryName(period) })}{" "}
        <Link href={`/admin/kiosk/entries?from=${period.from}&to=${period.to}&status=open`} className="underline">{t("adm1.kiosk.tab.entries")}</Link>.
      </p>
      <KioskBillingPanel key={`${period.from}_${period.to}`} from={period.from} to={period.to} label={label} categoryName={invoiceCategoryName(period)} candidates={candidates} blocker={blocker} currency={profile.currency} />

      <SectionTitle>{t("money.billing.invoices")}</SectionTitle>
      {invoices.length ? (
        <Card className="animate-rise mb-2 divide-y divide-line overflow-hidden">
          {invoices.map((i) => {
            const st = FEE_INVOICE_STATUS[i.status] ? { label: t(`money.status.${i.status}`), tone: FEE_INVOICE_STATUS[i.status]!.tone } : { label: i.status, tone: "neutral" as const };
            return (
              <div key={i.id} className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2">
                <div className="min-w-0 flex-1 basis-48">
                  <div className="flex flex-wrap items-center gap-1.5"><span className="font-medium">{i.memberName}</span><Badge tone={st.tone}>{st.label}</Badge></div>
                  <div className="text-xs text-ink-3">
                    <Link href={`/billing/invoices/${i.id}/print`} prefetch={false} className="underline">{t("adm1.members.numberShort", { nr: i.number })}</Link> · {i.categoryName} · {formatDate(i.issuedAt, locale)} · {entries(i.entryCount)}
                    {i.status === "PAID" && i.paidAt ? ` · ${t("adm1.inv.paidOn", { date: formatDate(i.paidAt, locale) })}` : ""}
                  </div>
                </div>
                <span className="shrink-0 font-medium tabular-nums">{formatMoney(i.amountCents, i.currency)}</span>
                {canSetStatus ? <KioskInvoiceActions id={i.id} number={i.number} status={i.status} /> : null}
              </div>
            );
          })}
        </Card>
      ) : <p className="mb-2 text-sm text-ink-3">{t("adm1.kiosk.noInvoices")}</p>}
      <p className="mb-4 text-xs text-ink-3">
        {t(canSetStatus ? "adm1.kiosk.statusHintAdmin" : "adm1.kiosk.statusHintOther")} {t("adm1.kiosk.shownInvoices")}
      </p>
    </div>
  );
}
