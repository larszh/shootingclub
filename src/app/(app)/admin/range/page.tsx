import type { Metadata } from "next";
import { getRequestLocale, getT } from "@/lib/i18n";
import Link from "next/link";
import { ChevronRight, Clock, QrCode, ScrollText, ShieldAlert } from "lucide-react";
import { Card, PageHeader, StatCard } from "@/components/ui";
import { todayZurich } from "@/lib/time";
import { requireRangeAdmin } from "@/modules/range/guard";
import { getActiveRules, incidentCounts, listWindows, quotaOverview, rulesAcceptanceStats } from "@/modules/range/queries";
import { ADMIN_RANGE_TABS } from "@/modules/range/nav";
import { RangeTabs } from "@/modules/range/ui/range-tabs";

export async function generateMetadata(): Promise<Metadata> {
  const t = getT(await getRequestLocale());
  return { title: t("adm2.range.setupTitle") };
}

export default async function AdminRangePage() {
  const ctx = await requireRangeAdmin();
  const t = getT(await getRequestLocale());
  const tenantId = ctx.tenant.id;
  const year = Number(todayZurich().slice(0, 4));
  const [rules, windows, quota, incidents] = await Promise.all([getActiveRules(tenantId), listWindows(tenantId), quotaOverview(tenantId, year, t("adm2.common.wholeFacility")), incidentCounts(tenantId)]);
  const stats = rules ? await rulesAcceptanceStats(tenantId, rules.id) : null;
  const main = quota.rows.find((r) => r.resourceId === null) ?? quota.rows[0];

  const links = [
    { href: "/admin/range/rules", icon: ScrollText, title: t("adm2.range.tab.rules"), text: rules ? t("adm2.range.link.rules.active", { n: rules.version }) : t("adm2.range.link.rules.none") },
    { href: "/admin/range/times", icon: Clock, title: t("adm2.range.link.times"), text: t("adm2.range.link.windows", { n: windows.length }) },
    { href: "/range/incidents", icon: ShieldAlert, title: t("adm2.range.link.incidents"), text: incidents.open ? t("adm2.range.link.incidentsOpen", { n: incidents.open }) : t("adm2.range.link.incidentsNone") },
    { href: "/range/qr", icon: QrCode, title: t("adm2.range.link.qr"), text: t("adm2.range.link.qrText") },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title={t("adm2.range.title")} subtitle={ctx.tenant.name} back={{ href: "/admin", label: t("adm2.common.settings") }} />
      <RangeTabs tabs={ADMIN_RANGE_TABS} label={t("adm2.range.setupTitle")} />
      <div className="stagger grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <StatCard label={t("adm2.range.stat.rulesConfirmed")} value={stats ? `${stats.done.length}/${stats.total}` : "–"} href="/admin/range/rules" />
        <StatCard label={t("adm2.range.stat.halfDays", { year })} value={main ? (main.max !== null ? `${main.used}/${main.max}` : main.used) : 0} href="/range/quota" tone={main?.status?.tone === "danger" ? "warn" : "neutral"} />
        <StatCard label={t("adm2.range.stat.openIncidents")} value={incidents.open} hint={incidents.high ? t("adm2.range.stat.highSeverity", { n: incidents.high }) : undefined} href="/range/incidents" tone={incidents.high ? "warn" : "neutral"} />
      </div>
      <Card className="divide-y divide-line overflow-hidden">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-surface-2">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-2"><l.icon className="h-5 w-5" aria-hidden /></span>
            <div className="min-w-0 flex-1"><div className="font-medium">{l.title}</div><div className="truncate text-xs text-ink-3">{l.text}</div></div>
            <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
          </Link>
        ))}
      </Card>
      <p className="text-xs text-ink-3">{t("adm2.range.responsibility")}</p>
    </div>
  );
}
