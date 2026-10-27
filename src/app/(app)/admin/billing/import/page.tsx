import { requirePermission } from "@/lib/tenant";
import { Card, PageHeader } from "@/components/ui";
import { AdminBillingTabs } from "@/modules/billing/ui/admin-tabs";
import { CamtImport } from "@/modules/billing/ui/camt-import";
import { getBillingProfile } from "@/modules/billing/profile";

export const metadata = { title: "Bankimport" };

export default async function BillingImportPage() {
  const ctx = await requirePermission("tenant.manage");
  const profile = await getBillingProfile(ctx.tenant.id, ctx.tenant.name);
  return (
    <div>
      <PageHeader title="Zahlungen importieren" subtitle="Kontoauszug (camt.054 / camt.053) hochladen und Rechnungen automatisch abgleichen" back={{ href: "/admin/billing", label: "Mitgliederbeiträge" }} />
      <AdminBillingTabs />
      <Card className="animate-rise p-4 mb-4 text-sm text-ink-2 space-y-1.5">
        <p><span className="font-medium">So geht&apos;s:</span> Im E-Banking die Gutschriften als <span className="font-medium">camt.054</span> (Einzelgutschriften) oder den Kontoauszug als <span className="font-medium">camt.053</span> herunterladen und hier hochladen.</p>
        <p className="text-ink-3 text-xs">Zuordnung zuerst über die QR-Referenz{profile.qrIban ? " (aktiv, eure IBAN ist eine QR-IBAN)" : ""}, sonst über Rechnungsnummer im Zahlungszweck und exakten Betrag. Gilt für Mitgliederbeiträge und Reservations-Rechnungen. Bereits bezahlte Rechnungen werden übersprungen, die gleiche Datei kann also gefahrlos nochmals importiert werden.</p>
      </Card>
      <CamtImport />
    </div>
  );
}
