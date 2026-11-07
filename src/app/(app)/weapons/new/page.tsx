import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { requireWeaponsAdmin } from "@/modules/weapons/guard";
import { getWeaponSettings, listDisciplines } from "@/modules/weapons/queries";
import { WeaponForm } from "@/modules/weapons/ui/weapon-form";

export const metadata: Metadata = { title: "Waffe erfassen" };

export default async function NewWeaponPage() {
  const ctx = await requireWeaponsAdmin();
  const [disciplines, settings] = await Promise.all([listDisciplines(ctx.tenant.id), getWeaponSettings(ctx.tenant.id)]);
  return (
    <div>
      <PageHeader title="Waffe erfassen" back={{ href: "/weapons", label: "Vereinswaffen" }} />
      <WeaponForm disciplines={disciplines} defaultServiceEveryShots={settings.serviceEveryShotsDefault} />
    </div>
  );
}
