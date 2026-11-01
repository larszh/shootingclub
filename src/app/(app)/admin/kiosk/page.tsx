import type { Metadata } from "next";
import Link from "next/link";
import { Alert, Badge, Card, PageHeader, SectionTitle, StatCard } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { formatDateZurich, todayZurich } from "@/lib/time";
import { requireKioskAdmin } from "@/modules/kiosk/guard";
import { billingPreview, kioskInvoices, kioskStats } from "@/modules/kiosk/queries";
import { invoiceCategoryName, periodLabel, periodPresets, resolvePeriod } from "@/modules/kiosk/logic";
import { getBillingProfile } from "@/modules/billing/profile";
import { FEE_INVOICE_STATUS } from "@/modules/billing/types";
import { KioskBillingPanel, type KioskBillingCandidate } from "@/modules/kiosk/ui/billing-panel";
import { PeriodPicker } from "@/modules/kiosk/ui/period-picker";
import { KioskInvoiceActions, ReleaseCancelledButton } from "@/modules/kiosk/ui/entry-buttons";

export const metadata: Metadata = { title: "Schützenstube: Abrechnung" };

const entries = (n: number) => `${n} ${n === 1 ? "Eintrag" : "Einträge"}`;
const day = (d: Date | null) => (d ? new Intl.DateTimeFormat("de-CH", { timeZone: "Europe/Zurich", day: "2-digit", month: "2-digit" }).format(d) : "");

export default async function AdminKioskPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; preset?: string }> }) {
  const ctx = await requireKioskAdmin();
  const sp = await searchParams;
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
    ? "Bitte zuerst das Modul «Mitgliederbeiträge» aktivieren (Einstellungen → Module). Die Rechnungen erscheinen dort und bei den Mitgliedern unter «Zahlungen»."
    : !profile.payeeName || !profile.iban ? "Bitte zuerst das Rechnungsprofil (Zahlungsempfänger und IBAN) ausfüllen." : null;

  return (
    <div>
      <PageHeader title="Schützenstube" subtitle="Konsumationen verrechnen" back={{ href: "/admin", label: "Verwaltung" }} />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Offen total" value={formatMoney(stats.openCents, profile.currency)} tone={stats.openCents ? "warn" : "neutral"} hint={entries(stats.openCount)} />
        <StatCard label="Mitglieder mit Offenem" value={stats.openMembers} />
        <StatCard label="Bar heute" value={formatMoney(stats.cashTodayCents, profile.currency)} hint={entries(stats.cashTodayCount)} href="/admin/kiosk/cash" />
        <StatCard label="Im Zeitraum" value={formatMoney(preview.totalCents, profile.currency)} hint={periodLabel(period)} />
      </div>

      {stats.releasable ? (
        <Alert tone="info" className="mb-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="min-w-0 flex-1">{stats.releasable} {stats.releasable === 1 ? "Eintrag gehört" : "Einträge gehören"} zu stornierten Rechnungen. Wieder freigeben, um sie neu zu verrechnen.</span>
            <ReleaseCancelledButton count={stats.releasable} />
          </div>
        </Alert>
      ) : null}

      <SectionTitle>Zeitraum</SectionTitle>
      <PeriodPicker basePath="/admin/kiosk" presets={periodPresets(today)} current={period} />

      <p className="mb-3 text-sm text-ink-3">
        Pro Mitglied eine Rechnung «{invoiceCategoryName(period)}» mit QR-Zahlteil über alle noch nicht verrechneten Konsumationen auf Rechnung im Zeitraum.
        Bar bezahlte Einträge und Gäste werden nicht verrechnet. Einzelne Einträge korrigieren: unter <Link href={`/admin/kiosk/entries?from=${period.from}&to=${period.to}&status=open`} className="underline">Einträge</Link>.
      </p>
      <KioskBillingPanel key={`${period.from}_${period.to}`} from={period.from} to={period.to} label={periodLabel(period)} categoryName={invoiceCategoryName(period)} candidates={candidates} blocker={blocker} currency={profile.currency} />

      <SectionTitle>Rechnungen</SectionTitle>
      {invoices.length ? (
        <Card className="animate-rise mb-2 divide-y divide-line overflow-hidden">
          {invoices.map((i) => {
            const st = FEE_INVOICE_STATUS[i.status] ?? { label: i.status, tone: "neutral" as const };
            return (
              <div key={i.id} className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2">
                <div className="min-w-0 flex-1 basis-48">
                  <div className="flex flex-wrap items-center gap-1.5"><span className="font-medium">{i.memberName}</span><Badge tone={st.tone}>{st.label}</Badge></div>
                  <div className="text-xs text-ink-3">
                    <Link href={`/billing/invoices/${i.id}/print`} prefetch={false} className="underline">Nr. {i.number}</Link> · {i.categoryName} · {formatDateZurich(i.issuedAt, { weekday: undefined })} · {entries(i.entryCount)}
                    {i.status === "PAID" && i.paidAt ? ` · bezahlt ${formatDateZurich(i.paidAt, { weekday: undefined })}` : ""}
                  </div>
                </div>
                <span className="shrink-0 font-medium tabular-nums">{formatMoney(i.amountCents, i.currency)}</span>
                {canSetStatus ? <KioskInvoiceActions id={i.id} number={i.number} status={i.status} /> : null}
              </div>
            );
          })}
        </Card>
      ) : <p className="mb-2 text-sm text-ink-3">Noch keine Rechnungen der Schützenstube.</p>}
      <p className="mb-4 text-xs text-ink-3">
        {canSetStatus
          ? "Bar oder per Überweisung bezahlte Rechnungen hier als bezahlt markieren. Eine falsche Rechnung stornieren und die Einträge danach wieder freigeben."
          : "Den Status einer Rechnung (bezahlt, storniert) ändert ein Admin des Vereins."} Angezeigt: alle offenen und die neuesten übrigen.
      </p>
    </div>
  );
}
