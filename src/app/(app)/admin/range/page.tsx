import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Clock, QrCode, ScrollText, ShieldAlert } from "lucide-react";
import { Card, PageHeader, StatCard } from "@/components/ui";
import { todayZurich } from "@/lib/time";
import { requireRangeAdmin } from "@/modules/range/guard";
import { getActiveRules, incidentCounts, listWindows, quotaOverview, rulesAcceptanceStats } from "@/modules/range/queries";
import { ADMIN_RANGE_TABS } from "@/modules/range/nav";
import { RESPONSIBILITY_HINT } from "@/modules/range/types";
import { RangeTabs } from "@/modules/range/ui/range-tabs";

export const metadata: Metadata = { title: "Standbetrieb einrichten" };

export default async function AdminRangePage() {
  const ctx = await requireRangeAdmin();
  const tenantId = ctx.tenant.id;
  const year = Number(todayZurich().slice(0, 4));
  const [rules, windows, quota, incidents] = await Promise.all([getActiveRules(tenantId), listWindows(tenantId), quotaOverview(tenantId, year), incidentCounts(tenantId)]);
  const stats = rules ? await rulesAcceptanceStats(tenantId, rules.id) : null;
  const main = quota.rows.find((r) => r.resourceId === null) ?? quota.rows[0];

  const links = [
    { href: "/admin/range/rules", icon: ScrollText, title: "Standordnung", text: rules ? `Version ${rules.version} gültig` : "Noch keine Standordnung veröffentlicht" },
    { href: "/admin/range/times", icon: Clock, title: "Schiesszeiten und Kontingent", text: `${windows.length} Zeitfenster` },
    { href: "/range/incidents", icon: ShieldAlert, title: "Vorfälle", text: incidents.open ? `${incidents.open} offen` : "Keine offenen Meldungen" },
    { href: "/range/qr", icon: QrCode, title: "QR-Code für den Check-in", text: "A4-Aushang drucken" },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Standbetrieb" subtitle={ctx.tenant.name} back={{ href: "/admin", label: "Einstellungen" }} />
      <RangeTabs tabs={ADMIN_RANGE_TABS} label="Standbetrieb einrichten" />
      <div className="stagger grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <StatCard label="Standordnung bestätigt" value={stats ? `${stats.done.length}/${stats.total}` : "–"} href="/admin/range/rules" />
        <StatCard label={`Halbtage ${year}`} value={main ? (main.max !== null ? `${main.used}/${main.max}` : main.used) : 0} href="/range/quota" tone={main?.status?.tone === "danger" ? "warn" : "neutral"} />
        <StatCard label="Offene Vorfälle" value={incidents.open} hint={incidents.high ? `${incidents.high} mit hoher Schwere` : undefined} href="/range/incidents" tone={incidents.high ? "warn" : "neutral"} />
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
      <p className="text-xs text-ink-3">{RESPONSIBILITY_HINT}</p>
    </div>
  );
}
