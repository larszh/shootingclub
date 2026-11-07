import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { requireWeaponsAdmin } from "@/modules/weapons/guard";
import { getWeaponSettings } from "@/modules/weapons/queries";
import { WeaponSettingsForm } from "@/modules/weapons/ui/settings-form";

export const metadata: Metadata = { title: "Vereinswaffen: Einstellungen" };

export default async function WeaponSettingsPage() {
  const ctx = await requireWeaponsAdmin();
  const s = await getWeaponSettings(ctx.tenant.id);
  return (
    <div>
      <PageHeader title="Vereinswaffen" subtitle="Einstellungen des Vereins" back={{ href: "/weapons", label: "Vereinswaffen" }} />
      <WeaponSettingsForm initial={{ minorReportDays: s.minorReportDays, serviceEveryShotsDefault: s.serviceEveryShotsDefault, saved: s.saved }} />
    </div>
  );
}
