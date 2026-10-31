import { requireShifts } from "@/modules/shifts/guard";

/** Helfereinsätze: Modul aktiv (alle Mitglieder). */
export default async function ShiftsLayout({ children }: { children: React.ReactNode }) {
  await requireShifts();
  return <>{children}</>;
}
