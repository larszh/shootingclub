import { requireAmmoAdmin } from "@/modules/ammo/guard";

/** Munition verwalten: nur mit aktivem Modul und Recht «ammo.manage». */
export default async function AdminAmmoLayout({ children }: { children: React.ReactNode }) {
  await requireAmmoAdmin();
  return <>{children}</>;
}
