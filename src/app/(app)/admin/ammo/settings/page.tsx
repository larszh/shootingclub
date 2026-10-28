import type { Metadata } from "next";
import Link from "next/link";
import { Info } from "lucide-react";
import { requireAmmoAdmin } from "@/modules/ammo/guard";
import { getAmmoSettings } from "@/modules/ammo/queries";
import { AdminAmmoTabs } from "@/modules/ammo/ui/admin-tabs";
import { AmmoSettingsForm } from "@/modules/ammo/ui/settings-form";
import { LEGAL_HINT } from "@/modules/ammo/types";
import { Alert, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Munition: Einstellungen" };

export default async function AmmoSettingsPage() {
  const ctx = await requireAmmoAdmin();
  const settings = await getAmmoSettings(ctx.tenant.id);
  return (
    <div>
      <PageHeader title="Einstellungen" subtitle="Abgabe, Prüfung und Rechnung" back={{ href: "/admin/ammo", label: "Munition" }} />
      <AdminAmmoTabs />
      <Alert tone="info" icon={<Info className="h-4 w-4" />} className="mb-4">
        {LEGAL_HINT} Zahlungsempfänger und IBAN stammen aus dem <Link href="/admin/billing/settings" className="font-medium underline">Rechnungsprofil</Link>. Online- oder Kartenzahlung ist für Munition bewusst nicht vorgesehen.
      </Alert>
      <AmmoSettingsForm settings={settings} />
    </div>
  );
}
