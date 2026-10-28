import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/tenant";
import { PageHeader } from "@/components/ui";
import { countOpenMatchesForProgram, getProgram } from "@/modules/scores/queries";
import { ProgramForm } from "@/modules/scores/ui/program-form";

export const metadata: Metadata = { title: "Programm bearbeiten" };

export default async function EditProgramPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePermission("tenant.programs.manage");
  const { id } = await params;
  const p = await getProgram(ctx, id);
  if (!p || p.scope !== "tenant") notFound();
  const openMatches = await countOpenMatchesForProgram(ctx, id);
  return (
    <div>
      <PageHeader title="Programm bearbeiten" back={{ href: `/scores/programs/${id}`, label: p.name }} />
      <ProgramForm scope="tenant" initial={{ id: p.id, name: p.name, description: p.description, discipline: p.discipline, weaponNote: p.weaponNote, scoringMode: p.scoringMode, stages: p.stages }} openMatches={openMatches} />
    </div>
  );
}
