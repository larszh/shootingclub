import { requireKioskAdmin } from "@/modules/kiosk/guard";
import { KioskAdminTabs } from "@/modules/kiosk/ui/admin-tabs";

/** Schützenstube verwalten: Modul aktiv und Recht «kiosk.manage». */
export default async function AdminKioskLayout({ children }: { children: React.ReactNode }) {
  await requireKioskAdmin();
  return (
    <>
      <KioskAdminTabs />
      {children}
    </>
  );
}
