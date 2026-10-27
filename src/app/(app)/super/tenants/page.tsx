import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/tenant";
import { db } from "@/lib/db";
import { Card, PageHeader, SectionTitle } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { CreateTenantForm, TenantRow } from "./forms";

export const metadata: Metadata = { title: "Tenants" };

export default async function SuperTenantsPage() {
  await requireSuperAdmin();
  const tenants = await db.tenant.findMany({ include: { _count: { select: { memberships: true, matches: true } } }, orderBy: { createdAt: "desc" } });
  return (
    <div>
      <PageHeader title="Tenants" subtitle="Vereine, Anlagen und Gruppen" back={{ href: "/super", label: "Verwaltung" }} />
      <SectionTitle>Neu</SectionTitle>
      <CreateTenantForm />
      <SectionTitle>Alle</SectionTitle>
      <Card className="animate-rise divide-y divide-line overflow-hidden">
        {tenants.map((t) => <TenantRow key={t.id} id={t.id} name={t.name} meta={`${t.kind} · ${t._count.memberships} Mitglieder · ${t._count.matches} Durchgänge · seit ${formatDate(t.createdAt)} · Code ${t.joinCode}`} />)}
        {tenants.length === 0 ? <p className="p-4 text-sm text-ink-3">Noch keine Tenants.</p> : null}
      </Card>
    </div>
  );
}
