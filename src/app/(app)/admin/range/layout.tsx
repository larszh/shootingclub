import { requireRangeAdmin } from "@/modules/range/guard";

/** Standbetrieb einrichten: nur mit aktivem Modul «range» und Recht «range.manage». */
export default async function AdminRangeLayout({ children }: { children: React.ReactNode }) {
  await requireRangeAdmin();
  return <>{children}</>;
}
