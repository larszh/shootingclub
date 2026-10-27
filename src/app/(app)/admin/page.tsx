import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { requirePermission } from "@/lib/tenant";
import { MODULES } from "@/lib/modules";
import { db } from "@/lib/db";
import { Card, PageHeader, SectionTitle } from "@/components/ui";
import { JoinCodeCard, ModuleToggle, TenantSettingsForm } from "./forms";

export const metadata: Metadata = { title: "Einstellungen" };

export default async function AdminPage() {
  const ctx = await requirePermission("tenant.manage");
  const tenant = await db.tenant.findUniqueOrThrow({ where: { id: ctx.tenant.id }, include: { _count: { select: { memberships: true } } } });
  const base = process.env.APP_URL ?? "";

  return (
    <div>
      <PageHeader title="Einstellungen" subtitle={tenant.name} back={{ href: "/me", label: "Mehr" }} />

      <SectionTitle>Mitglieder einladen</SectionTitle>
      <JoinCodeCard code={tenant.joinCode} link={`${base}/register?code=${tenant.joinCode}`} />
      <Link href="/admin/members" className="block press mt-2.5">
        <Card className="p-4 flex items-center gap-3 hover:border-ink/30"><Users className="h-5 w-5 text-ink-2" /><span className="flex-1 font-medium">Mitglieder & Rollen</span><span className="text-sm text-ink-3">{tenant._count.memberships}</span></Card>
      </Link>

      <SectionTitle>Module</SectionTitle>
      <Card className="animate-rise divide-y divide-line overflow-hidden">
        {MODULES.map((m) => (
          <ModuleToggle key={m.key} moduleKey={m.key} name={m.name} description={m.description} enabled={ctx.hasModule(m.key)} planned={m.status === "planned"} />
        ))}
      </Card>

      <SectionTitle>Stammdaten</SectionTitle>
      <TenantSettingsForm tenant={{ name: tenant.name, kind: tenant.kind, city: tenant.city, canton: tenant.canton }} />
    </div>
  );
}
