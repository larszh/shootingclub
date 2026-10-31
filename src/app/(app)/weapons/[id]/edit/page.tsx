import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { requireWeaponsAdmin } from "@/modules/weapons/guard";
import { stripBlockReason } from "@/modules/weapons/logic";
import { getWeapon, listDisciplines } from "@/modules/weapons/queries";
import { WeaponForm } from "@/modules/weapons/ui/weapon-form";

export const metadata: Metadata = { title: "Waffe bearbeiten" };

export default async function EditWeaponPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireWeaponsAdmin();
  const { id } = await params;
  const [w, disciplines] = await Promise.all([getWeapon(ctx.tenant.id, id.slice(0, 40), true), listDisciplines(ctx.tenant.id)]);
  if (!w) notFound();
  return (
    <div>
      <PageHeader title="Waffe bearbeiten" subtitle={w.name} back={{ href: `/weapons/${w.id}`, label: w.name }} />
      <WeaponForm
        disciplines={disciplines}
        initial={{
          id: w.id, name: w.name, discipline: w.discipline, manufacturer: w.manufacturer, model: w.model, caliber: w.caliber, serialNumber: w.serialNumber,
          shotCount: w.shotCount, serviceEveryShots: w.serviceEveryShots, nextServiceAt: w.nextServiceAt ? w.nextServiceAt.toISOString().slice(0, 10) : null,
          notes: stripBlockReason(w.notes),
        }}
      />
    </div>
  );
}
