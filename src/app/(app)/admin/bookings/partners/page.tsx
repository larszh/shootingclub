import type { Metadata } from "next";
import { Download, Handshake } from "lucide-react";
import { requirePermission } from "@/lib/tenant";
import { Alert, Button, buttonClasses, Card, EmptyState, Input, PageHeader, SectionTitle } from "@/components/ui";
import { AdminBookingTabs } from "@/modules/bookings/ui/admin-tabs";
import { loadPartnerReport } from "@/modules/sharing/queries";
import { formatHours } from "@/modules/sharing/logic";
import { parsePeriod } from "@/modules/sharing/period";
import { formatMoney } from "@/lib/money";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Partnervereine" };

export default async function PartnerReportPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const ctx = await requirePermission("tenant.manage");
  const sp = await searchParams;
  const period = parsePeriod(sp.from, sp.to) ?? parsePeriod(null, null)!;
  const invalid = !!(sp.from || sp.to) && !parsePeriod(sp.from, sp.to);
  const [report, shareCount] = await Promise.all([
    loadPartnerReport(ctx.tenant.id, period.from, period.to),
    db.resourceShare.count({ where: { resource: { tenantId: ctx.tenant.id } } }),
  ]);
  const qs = `from=${period.fromStr}&to=${period.toStr}`;
  const t = report.total;

  return (
    <div>
      <PageHeader title="Partnervereine" subtitle="Buchungen auf gemeinsamen Anlagen, z.B. für die Kostenaufteilung" back={{ href: "/admin/bookings", label: "Reservationen" }} />
      <AdminBookingTabs />

      <Card className="animate-rise p-4">
        <form method="get" className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="block text-sm font-medium text-ink-2 mb-1.5">Von</span><Input type="date" name="from" defaultValue={period.fromStr} required /></label>
            <label className="block"><span className="block text-sm font-medium text-ink-2 mb-1.5">Bis</span><Input type="date" name="to" defaultValue={period.toStr} required /></label>
          </div>
          <Button type="submit" variant="secondary" className="w-full">Anzeigen</Button>
        </form>
        {invalid ? <div className="mt-3"><Alert tone="warn">Ungültiger Zeitraum (max. 3 Jahre). Angezeigt wird der laufende Monat.</Alert></div> : null}
      </Card>

      <SectionTitle>Zusammenfassung</SectionTitle>
      {report.rows.length ? (
        <>
          <div className="stagger grid grid-cols-3 gap-2.5 mb-3">
            <Card className="p-4"><div className="text-2xl font-semibold tabular-nums">{t.bookings}</div><div className="text-xs text-ink-3">Buchungen</div></Card>
            <Card className="p-4"><div className="text-2xl font-semibold tabular-nums">{formatHours(t.hours)}</div><div className="text-xs text-ink-3">Stunden</div></Card>
            <Card className="p-4"><div className="text-lg font-semibold tabular-nums leading-8 truncate">{formatMoney(t.amountCents, report.currency)}</div><div className="text-xs text-ink-3">Betrag</div></Card>
          </div>
          <Card className="animate-rise divide-y divide-line overflow-hidden">
            {report.rows.map((r) => (
              <div key={r.tenantId} className="px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium truncate">{r.name}</span>
                  <span className="font-semibold tabular-nums shrink-0">{formatMoney(r.amountCents, report.currency)}</span>
                </div>
                <div className="mt-0.5 text-xs text-ink-3 tabular-nums">
                  {r.bookings} {r.bookings === 1 ? "Buchung" : "Buchungen"} · {formatHours(r.hours)} h · {r.persons} {r.persons === 1 ? "Person" : "Personen"}
                  {r.paidCents ? ` · bezahlt ${formatMoney(r.paidCents, report.currency)}` : ""}{r.openCents ? ` · offen ${formatMoney(r.openCents, report.currency)}` : ""}
                </div>
              </div>
            ))}
          </Card>
          <p className="mt-2 text-xs text-ink-3">Gezählt werden bestätigte Buchungen mit Beginn im Zeitraum; Anfragen, Stornierungen und Ablehnungen nicht.</p>
        </>
      ) : (
        <EmptyState icon={<Handshake className="h-5 w-5" />} title="Keine Partnerbuchungen im Zeitraum"
          text={shareCount ? "Mitglieder der Partnervereine haben in diesem Zeitraum nichts gebucht." : "Teile eine Anlage mit einem Partnerverein: Ressourcen → Anlage öffnen → «Mit Partnerverein teilen»."} />
      )}

      <SectionTitle>Export</SectionTitle>
      <Card className="animate-rise p-4 space-y-3">
        <p className="text-sm text-ink-3">Summen pro Partnerverein als CSV für Excel (Buchungen, Stunden, Personen, Betrag, bezahlt, offen). Die einzelnen Buchungen enthält der Export unter «Übersicht» (Spalte «Partnerverein»).</p>
        <a href={`/api/export/bookings/partners?${qs}`} className={buttonClasses("secondary", "md", "w-full")}><Download className="h-4 w-4" /> CSV herunterladen</a>
        <a href={`/api/export/bookings?${qs}`} className="flex min-h-11 items-center justify-center text-xs text-ink-3 hover:text-ink">Alle Buchungen des Zeitraums (CSV)</a>
      </Card>
    </div>
  );
}
