import type { Metadata } from "next";
import Link from "next/link";
import { Bot, Building2, ChevronRight, History, Landmark, Languages, LifeBuoy, ListChecks, Server, Target, Users } from "lucide-react";
import { requireSuperAdmin } from "@/lib/tenant";
import { db } from "@/lib/db";
import { Card, PageHeader } from "@/components/ui";
import { getRequestLocale, getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("adm2.super.meta") };
}

export default async function SuperPage() {
  await requireSuperAdmin();
  const t = getT(await getRequestLocale());
  const [tenants, users, programs, targets, associations] = await Promise.all([
    db.tenant.count(), db.user.count(), db.program.count({ where: { tenantId: null } }), db.targetTemplate.count({ where: { tenantId: null, ownerUserId: null } }),
    db.association.count({ where: { deletedAt: null } }),
  ]);
  const rows = [
    { href: "/super/tenants", icon: Building2, label: t("adm2.super.tenants"), count: tenants },
    { href: "/super/users", icon: Users, label: t("adm2.super.users"), count: users },
    { href: "/super/programs", icon: ListChecks, label: t("adm2.super.programs"), count: programs },
    { href: "/super/targets", icon: Target, label: t("adm2.super.targets"), count: targets },
    { href: "/super/associations", icon: Landmark, label: t("adm2.super.associations"), count: associations },
  ];
  return (
    <div>
      <PageHeader title={t("adm2.super.title")} subtitle={t("adm2.super.subtitle")} back={{ href: "/me", label: t("adm2.super.more") }} />
      <Card className="animate-rise divide-y divide-line overflow-hidden">
        {rows.map((r) => (
          <Link key={r.href} href={r.href} className="flex items-center gap-3 px-4 h-14 hover:bg-surface-2"><r.icon className="h-5 w-5 text-ink-2" /><span className="flex-1 font-medium">{r.label}</span><span className="text-sm text-ink-3 tabular-nums">{r.count}</span><ChevronRight className="h-4 w-4 text-ink-3" /></Link>
        ))}
      </Card>
      <Card className="animate-rise mt-3 divide-y divide-line overflow-hidden">
        {[
          { href: "/super/translations", icon: Languages, label: t("misc.nav.superTranslations") },
          { href: "/super/ai", icon: Bot, label: t("misc.nav.superAi") },
          { href: "/super/support", icon: LifeBuoy, label: t("misc.nav.superSupport") },
        ].map((r) => (
          <Link key={r.href} href={r.href} className="flex items-center gap-3 px-4 h-14 hover:bg-surface-2"><r.icon className="h-5 w-5 text-ink-2" /><span className="flex-1 font-medium">{r.label}</span><ChevronRight className="h-4 w-4 text-ink-3" /></Link>
        ))}
      </Card>
      <Card className="animate-rise mt-3 divide-y divide-line overflow-hidden">
        <Link href="/super/audit" className="flex items-center gap-3 px-4 h-14 hover:bg-surface-2"><History className="h-5 w-5 text-ink-2" /><span className="flex-1 font-medium">{t("adm2.super.auditAll")}</span><ChevronRight className="h-4 w-4 text-ink-3" /></Link>
        <Link href="/super/system" className="flex items-center gap-3 px-4 h-14 hover:bg-surface-2"><Server className="h-5 w-5 text-ink-2" /><span className="flex-1 font-medium">{t("adm2.super.system")}</span><ChevronRight className="h-4 w-4 text-ink-3" /></Link>
      </Card>
    </div>
  );
}
