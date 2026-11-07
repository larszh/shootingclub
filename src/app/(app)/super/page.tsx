import type { Metadata } from "next";
import Link from "next/link";
import { Building2, ChevronRight, History, Landmark, ListChecks, Server, Target, Users } from "lucide-react";
import { requireSuperAdmin } from "@/lib/tenant";
import { db } from "@/lib/db";
import { Card, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Super-Admin" };

export default async function SuperPage() {
  await requireSuperAdmin();
  const [tenants, users, programs, targets, associations] = await Promise.all([
    db.tenant.count(), db.user.count(), db.program.count({ where: { tenantId: null } }), db.targetTemplate.count({ where: { tenantId: null, ownerUserId: null } }),
    db.association.count({ where: { deletedAt: null } }),
  ]);
  const rows = [
    { href: "/super/tenants", icon: Building2, label: "Tenants", count: tenants },
    { href: "/super/users", icon: Users, label: "Benutzer", count: users },
    { href: "/super/programs", icon: ListChecks, label: "Globale Programme", count: programs },
    { href: "/super/targets", icon: Target, label: "Globale Scheiben", count: targets },
    { href: "/super/associations", icon: Landmark, label: "Verbände", count: associations },
  ];
  return (
    <div>
      <PageHeader title="Globale Verwaltung" subtitle="Nur für Super-Admins" back={{ href: "/me", label: "Mehr" }} />
      <Card className="animate-rise divide-y divide-line overflow-hidden">
        {rows.map((r) => (
          <Link key={r.href} href={r.href} className="flex items-center gap-3 px-4 h-14 hover:bg-surface-2"><r.icon className="h-5 w-5 text-ink-2" /><span className="flex-1 font-medium">{r.label}</span><span className="text-sm text-ink-3 tabular-nums">{r.count}</span><ChevronRight className="h-4 w-4 text-ink-3" /></Link>
        ))}
      </Card>
      <Card className="animate-rise mt-3 divide-y divide-line overflow-hidden">
        <Link href="/super/audit" className="flex items-center gap-3 px-4 h-14 hover:bg-surface-2"><History className="h-5 w-5 text-ink-2" /><span className="flex-1 font-medium">Protokoll (alle Vereine)</span><ChevronRight className="h-4 w-4 text-ink-3" /></Link>
        <Link href="/super/system" className="flex items-center gap-3 px-4 h-14 hover:bg-surface-2"><Server className="h-5 w-5 text-ink-2" /><span className="flex-1 font-medium">System (Mail & Jobs)</span><ChevronRight className="h-4 w-4 text-ink-3" /></Link>
      </Card>
    </div>
  );
}
