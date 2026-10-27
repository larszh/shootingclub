import type { Metadata } from "next";
import { requireModule } from "@/lib/tenant";
import { PageHeader } from "@/components/ui";
import { listPrograms, listTenantMembers } from "@/modules/scores/queries";
import { MatchSetup } from "@/modules/scores/ui/match-setup";

export const metadata: Metadata = { title: "Durchgang starten" };

export default async function NewMatchPage({ searchParams }: { searchParams: Promise<{ programId?: string }> }) {
  const ctx = await requireModule("scores");
  const { programId } = await searchParams;
  const [programs, members] = await Promise.all([listPrograms(ctx), listTenantMembers(ctx.tenant.id)]);
  return (
    <div>
      <PageHeader title="Durchgang starten" subtitle="Programm und Teilnehmer wählen" back={{ href: "/scores", label: "Schiessen" }} />
      <MatchSetup
        programs={programs.map((p) => ({ id: p.id, name: p.name, discipline: p.discipline, shots: p.totals.shots, stages: p.stages.length, favorite: p.favorite, distances: p.totals.distances }))}
        members={members.filter((m) => m.id !== ctx.user.id)}
        me={{ id: ctx.user.id, name: ctx.user.name }}
        initialProgramId={programId}
      />
    </div>
  );
}
