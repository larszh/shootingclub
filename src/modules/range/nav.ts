/** Reiter des Standbetriebs (ohne Client-Abhängigkeit, auch in Server-Komponenten nutzbar). */
export type RangeTab = { href: string; label: string };

export function rangeTabs(can: { duty: boolean; manage: boolean }): RangeTab[] {
  const tabs: RangeTab[] = [{ href: "/range", label: "Heute" }];
  if (can.duty) tabs.push({ href: "/range/log", label: "Standbuch" }, { href: "/range/quota", label: "Halbtage" });
  tabs.push({ href: "/range/incidents", label: "Vorfälle" }, { href: "/range/rules", label: "Standordnung" });
  return tabs;
}

/** Reiter der Verwaltung; `label` ist ein Wörterbuch-Schlüssel (RangeTabs übersetzt «adm2.»-Schlüssel). */
export const ADMIN_RANGE_TABS: RangeTab[] = [
  { href: "/admin/range", label: "adm2.range.tab.overview" },
  { href: "/admin/range/rules", label: "adm2.range.tab.rules" },
  { href: "/admin/range/times", label: "adm2.range.tab.times" },
];
