import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/tenant";

/** Speicher-Einstellungen nur für Admins und nur, wenn die Dateiablage aktiv ist. */
export default async function AdminFilesLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requirePermission("tenant.manage");
  if (!ctx.hasModule("files")) redirect("/?module=files");
  return <>{children}</>;
}
