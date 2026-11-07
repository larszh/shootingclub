import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Landmark } from "lucide-react";
import { requireSuperAdmin } from "@/lib/tenant";
import { Badge, Card, EmptyState, PageHeader, SectionTitle } from "@/components/ui";
import { listAllAssociations } from "@/modules/association/queries";
import { CreateAssociationForm } from "./forms";

export const metadata: Metadata = { title: "Verbände" };

export default async function SuperAssociationsPage() {
  await requireSuperAdmin();
  const associations = await listAllAssociations();
  return (
    <div>
      <PageHeader title="Verbände" subtitle="Kantonal- und Regionalverbände" back={{ href: "/super", label: "Verwaltung" }} />
      <SectionTitle>Neu</SectionTitle>
      <CreateAssociationForm />
      <SectionTitle>Alle</SectionTitle>
      {associations.length === 0 ? (
        <EmptyState icon={<Landmark className="h-6 w-6" />} title="Noch keine Verbände" text="Lege einen Verband an und gib den Code den Vereinen weiter." />
      ) : (
        <Card className="animate-rise divide-y divide-line overflow-hidden">
          {associations.map((a) => (
            <Link key={a.id} href={`/super/associations/${a.id}`} className="flex items-center gap-3 px-4 py-3 min-h-14 hover:bg-surface-2">
              <Landmark className="h-5 w-5 shrink-0 text-ink-2" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate flex items-center gap-2">
                  {a.name}
                  {a.deletedAt ? <Badge tone="danger">Gelöscht</Badge> : null}
                </div>
                <div className="text-xs text-ink-3 truncate">
                  {a.region ? `${a.region} · ` : ""}Code <span className="font-mono">{a.code}</span> · {a._count.members} Vereine · {a._count.admins} Zugänge
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-ink-3" aria-hidden />
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
