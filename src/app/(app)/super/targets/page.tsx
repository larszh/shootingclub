import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireSuperAdmin } from "@/lib/tenant";
import { Card, LinkButton, PageHeader } from "@/components/ui";
import { listGlobalTargets } from "@/modules/targets/queries";
import { subjectLabel } from "@/modules/targets/types";
import { TargetPreview } from "@/modules/targets/ui/target-preview";
import { TargetDeleteButton } from "@/modules/targets/ui/target-controls";

export const metadata: Metadata = { title: "Globale Scheiben" };

export default async function SuperTargetsPage() {
  const me = await requireSuperAdmin();
  const targets = await listGlobalTargets(me.id);
  return (
    <div>
      <PageHeader title="Globale Scheiben" subtitle="Für alle Tenants sichtbar" back={{ href: "/super", label: "Verwaltung" }} action={<LinkButton href="/super/targets/new" size="sm"><Plus className="h-4 w-4" /> Neu</LinkButton>} />
      <Card className="animate-rise divide-y divide-line overflow-hidden">
        {targets.map((t) => (
          <div key={t.id} className="flex items-center gap-3 px-4 py-3">
            <div className="h-14 w-10 rounded border border-line overflow-hidden bg-white shrink-0"><TargetPreview target={t} size="A6" className="h-full w-full" /></div>
            <div className="min-w-0 flex-1"><Link href={`/super/targets/${t.id}/edit`} className="font-medium hover:underline">{t.name}</Link><div className="text-xs text-ink-3">{subjectLabel(t.subject)} · {t.paperSizes.join(", ")}</div></div>
            <TargetDeleteButton targetId={t.id} redirectTo="/super/targets" />
          </div>
        ))}
      </Card>
    </div>
  );
}
