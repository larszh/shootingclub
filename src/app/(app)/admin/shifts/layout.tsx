import { requireShiftsAdmin } from "@/modules/shifts/guard";
import { adminShiftCounts } from "@/modules/shifts/queries";
import { ShiftAdminTabs } from "@/modules/shifts/ui/nav";

/** Einsatzplanung: Modul «Helfereinsätze» aktiv und Recht «shifts.manage». */
export default async function AdminShiftsLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireShiftsAdmin();
  const counts = await adminShiftCounts(ctx.tenant.id);
  return (
    <>
      <ShiftAdminTabs badges={{ "/admin/shifts": counts.toConfirm, "/admin/shifts/hours": counts.pendingLogs }} />
      {children}
    </>
  );
}
