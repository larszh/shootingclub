/** Reiter des Standbetriebs (ohne Client-Abhängigkeit, auch in Server-Komponenten nutzbar). */
export type RangeTab = { href: string; label: string };

export function rangeTabs(can: { duty: boolean; manage: boolean }): RangeTab[] {
  const tabs: RangeTab[] = [{ href: "/range", label: "Heute" }];
  if (can.duty) tabs.push({ href: "/range/log", label: "Standbuch" }, { href: "/range/quota", label: "Halbtage" });
  tabs.push({ href: "/range/incidents", label: "Vorfälle" }, { href: "/range/rules", label: "Standordnung" });
  return tabs;
}

export const ADMIN_RANGE_TABS: RangeTab[] = [
  { href: "/admin/range", label: "Übersicht" },
  { href: "/admin/range/rules", label: "Standordnung" },
  { href: "/admin/range/times", label: "Schiesszeiten" },
];
