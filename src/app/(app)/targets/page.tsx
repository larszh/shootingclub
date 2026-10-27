import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { requireModule } from "@/lib/tenant";
import { EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { listTargets } from "@/modules/targets/queries";
import { TargetGallery } from "@/modules/targets/ui/target-gallery";

export const metadata: Metadata = { title: "Zielscheiben" };

export default async function TargetsPage() {
  const ctx = await requireModule("targets");
  const targets = await listTargets(ctx, { includeHidden: ctx.can("tenant.targets.manage") });
  return (
    <div>
      <PageHeader title="Zielscheiben" subtitle="Druckvorlagen in A4, A5 und A6" action={<LinkButton href="/targets/new" size="sm"><Plus className="h-4 w-4" /> Eigene</LinkButton>} />
      {targets.length ? <TargetGallery targets={targets} /> : <EmptyState title="Keine Scheiben" text="Lade ein eigenes Sujet hoch." action={<LinkButton href="/targets/new" size="sm">Scheibe anlegen</LinkButton>} />}
    </div>
  );
}
