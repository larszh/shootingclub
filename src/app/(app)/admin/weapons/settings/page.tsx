import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { getRequestLocale, getT } from "@/lib/i18n";
import { requireWeaponsAdmin } from "@/modules/weapons/guard";
import { getWeaponSettings } from "@/modules/weapons/queries";
import { WeaponSettingsForm } from "@/modules/weapons/ui/settings-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("adm2.weapons.settings.metaTitle") };
}

export default async function WeaponSettingsPage() {
  const ctx = await requireWeaponsAdmin();
  const t = getT(await getRequestLocale());
  const s = await getWeaponSettings(ctx.tenant.id);
  return (
    <div>
      <PageHeader title={t("adm2.weapons.title")} subtitle={t("adm2.weapons.settings.subtitle")} back={{ href: "/weapons", label: t("adm2.weapons.title") }} />
      <WeaponSettingsForm initial={{ minorReportDays: s.minorReportDays, serviceEveryShotsDefault: s.serviceEveryShotsDefault, saved: s.saved }} />
    </div>
  );
}
