import { requireWeapons } from "@/modules/weapons/guard";

/** Vereinswaffen: Modul aktiv und mindestens «weapons.loan» (Trainer/Standchef). */
export default async function WeaponsLayout({ children }: { children: React.ReactNode }) {
  await requireWeapons();
  return <>{children}</>;
}
