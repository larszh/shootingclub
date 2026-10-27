import { notFound } from "next/navigation";
import { requireSuperAdmin } from "@/lib/tenant";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { parseStages } from "@/modules/scores/types";
import { ProgramForm } from "@/modules/scores/ui/program-form";

export const metadata = { title: "Globales Programm bearbeiten" };

export default async function SuperEditProgramPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSuperAdmin();
  const { id } = await params;
  const p = await db.program.findUnique({ where: { id } });
  if (!p || p.tenantId !== null) notFound();
  return (
    <div>
      <PageHeader title="Globales Programm bearbeiten" back={{ href: "/super/programs", label: "Globale Programme" }} />
      <ProgramForm scope="global" initial={{ id: p.id, name: p.name, description: p.description, discipline: p.discipline, weaponNote: p.weaponNote, scoringMode: p.scoringMode, stages: parseStages(p.stagesJson) }} />
    </div>
  );
}
