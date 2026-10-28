import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { requireModule } from "@/lib/tenant";
import { EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { listPrograms } from "@/modules/scores/queries";
import { programUsageCounts } from "@/modules/scores/insights";
import { ProgramList } from "@/modules/scores/ui/program-list";

export const metadata: Metadata = { title: "Programme" };

export default async function ProgramsPage() {
  const ctx = await requireModule("scores");
  const canManage = ctx.can("tenant.programs.manage");
  const [programs, usage] = await Promise.all([listPrograms(ctx, { includeHidden: canManage }), programUsageCounts(ctx.tenant.id)]);

  return (
    <div>
      <PageHeader title="Programme" subtitle="Globale Vorlagen und Programme deines Vereins" back={{ href: "/scores", label: "Schiessen" }}
        action={canManage ? <LinkButton href="/scores/programs/new" size="sm"><Plus className="h-4 w-4" /> Neu</LinkButton> : null} />
      {programs.length ? (
        <ProgramList programs={programs} showHidden={canManage} usage={usage} />
      ) : (
        <EmptyState title="Keine Programme" text="Lege ein Programm an oder bitte einen Admin darum." action={canManage ? <LinkButton href="/scores/programs/new" size="sm">Programm anlegen</LinkButton> : null} />
      )}
    </div>
  );
}
