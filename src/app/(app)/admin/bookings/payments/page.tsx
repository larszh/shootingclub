import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/tenant";
import { Card, LinkTabs, PageHeader, SectionTitle } from "@/components/ui";
import { AdminBookingTabs } from "@/modules/bookings/ui/admin-tabs";
import { listTenantPayments, type TenantPaymentKind } from "@/lib/payments/queries";
import { PaymentProviderList } from "@/lib/payments/ui/provider-list";
import { TenantPaymentsTable } from "@/lib/payments/ui/payments-table";

export const metadata = { title: "Zahlungsanbieter" };

const KINDS = ["all", "BOOKING", "FEE"] as const;
type KindFilter = (typeof KINDS)[number];

export default async function PaymentProvidersPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const ctx = await requirePermission("tenant.manage");
  if (!ctx.hasModule("bookings") && !ctx.hasModule("billing")) redirect("/?module=bookings");
  const sp = await searchParams;
  const kind: KindFilter = KINDS.includes(sp.kind as KindFilter) ? (sp.kind as KindFilter) : "all";
  const payments = await listTenantPayments(ctx.tenant.id, { kind: kind === "all" ? undefined : (kind as TenantPaymentKind), take: 200 });
  const billing = ctx.hasModule("billing");
  return (
    <div>
      <PageHeader title="Zahlungsanbieter" subtitle="Jeder Verein nutzt sein eigenes Konto. Zugangsdaten werden verschlüsselt gespeichert." back={{ href: "/admin/bookings", label: "Reservationen" }} />
      <AdminBookingTabs />
      <Card className="animate-rise mb-4 space-y-2 p-4 text-sm text-ink-2">
        <p>Das Geld fliesst direkt auf das Konto des Vereins beim jeweiligen Anbieter. Standchef speichert nur die Zugangsdaten für die Zahlungsseite.</p>
        <p>
          Nach dem Einrichten unter <Link href="/admin/bookings/settings" className="underline">Einstellungen</Link> die Online-Zahlung für Reservationen aktivieren
          {billing ? <> und im <Link href="/admin/billing/settings" className="underline">Rechnungsprofil</Link> den Anbieter für Beitragsrechnungen wählen</> : null}.
        </p>
        <p className="text-xs text-ink-3">Munition ist nie online bezahlbar (AGB der Zahlungsanbieter) und wird immer per Rechnung abgerechnet.</p>
      </Card>

      <PaymentProviderList tenantId={ctx.tenant.id} />

      <SectionTitle>Online-Zahlungen</SectionTitle>
      <LinkTabs
        className="mb-3"
        label="Zahlungen filtern"
        active={kind}
        items={[
          { value: "all", href: "/admin/bookings/payments", label: "Alle" },
          { value: "BOOKING", href: "/admin/bookings/payments?kind=BOOKING", label: "Reservationen" },
          { value: "FEE", href: "/admin/bookings/payments?kind=FEE", label: "Rechnungen" },
        ]}
      />
      <TenantPaymentsTable rows={payments} />
      {payments.length >= 200 ? <p className="mt-2 text-xs text-ink-3">Es werden die neuesten 200 Zahlungen angezeigt.</p> : null}
    </div>
  );
}
