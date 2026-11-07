import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { getRequestLocale, getT } from "@/lib/i18n";
import { requireWeaponsAdmin } from "@/modules/weapons/guard";
import { getWeaponSettings, listDisciplines } from "@/modules/weapons/queries";
import { WeaponForm } from "@/modules/weapons/ui/weapon-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("adm2.weapons.new.title") };
}

export default async function NewWeaponPage() {
  const ctx = await requireWeaponsAdmin();
  const t = getT(await getRequestLocale());
  const [disciplines, settings] = await Promise.all([listDisciplines(ctx.tenant.id), getWeaponSettings(ctx.tenant.id)]);
  return (
    <div>
      <PageHeader title={t("adm2.weapons.new.title")} back={{ href: "/weapons", label: t("adm2.weapons.title") }} />
      <WeaponForm disciplines={disciplines} defaultServiceEveryShots={settings.serviceEveryShotsDefault} />
    </div>
  );
}
