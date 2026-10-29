import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireSuperAdmin } from "@/lib/tenant";
import { Badge, Card, LinkButton, PageHeader } from "@/components/ui";
import { listGlobalPrograms } from "@/modules/scores/queries";
import { disciplineLabel, formatDistances, officialKindLabel } from "@/modules/scores/types";
import { ProgramArchiveButton } from "@/modules/scores/ui/admin-controls";

export const metadata: Metadata = { title: "Globale Programme" };

export default async function SuperProgramsPage() {
  await requireSuperAdmin();
  const programs = await listGlobalPrograms();
  return (
    <div>
      <PageHeader title="Globale Programme" subtitle="Für alle Tenants sichtbar (sofern nicht versteckt)" back={{ href: "/super", label: "Verwaltung" }} action={<LinkButton href="/super/programs/new" size="sm"><Plus className="h-4 w-4" /> Neu</LinkButton>} />
      <Card className="animate-rise divide-y divide-line overflow-hidden">
        {programs.map((p) => (
          <div key={p.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <Link href={`/super/programs/${p.id}/edit`} className="font-medium hover:underline">{p.name}</Link>
              <div className="text-xs text-ink-3">{disciplineLabel(p.discipline)} · {formatDistances(p.totals.distances)} · {p.totals.shots} Schuss{p.isArchived ? " · archiviert" : ""}</div>
            </div>
            {p.officialKind ? <Badge tone="accent">{officialKindLabel(p.officialKind)}</Badge> : null}
            {p.isArchived ? <Badge tone="warn">Archiv</Badge> : null}
            <ProgramArchiveButton programId={p.id} archived={p.isArchived} />
          </div>
        ))}
      </Card>
    </div>
  );
}
