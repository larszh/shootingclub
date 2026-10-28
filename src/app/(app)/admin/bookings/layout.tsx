import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/tenant";

/** Verwaltung der Reservationen nur, wenn das Modul für den Verein aktiv ist. */
export default async function AdminBookingsLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requirePermission("tenant.manage");
  if (!ctx.hasModule("bookings")) redirect("/?module=bookings");
  return <>{children}</>;
}
