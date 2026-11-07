import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/tenant";
import { PageHeader } from "@/components/ui";
import { countOpenMatchesForProgram, getProgram } from "@/modules/scores/queries";
import { ProgramForm } from "@/modules/scores/ui/program-form";
import { getRequestLocale, getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("shooting.program.form.editTitle") };
}

export default async function EditProgramPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePermission("tenant.programs.manage");
  const { id } = await params;
  const p = await getProgram(ctx, id);
  if (!p || p.scope !== "tenant") notFound();
  const openMatches = await countOpenMatchesForProgram(ctx, id);
  const t = getT(await getRequestLocale());
  return (
    <div>
      <PageHeader title={t("shooting.program.form.editTitle")} back={{ href: `/scores/programs/${id}`, label: p.name }} />
      <ProgramForm scope="tenant" initial={{ id: p.id, name: p.name, description: p.description, discipline: p.discipline, weaponNote: p.weaponNote, scoringMode: p.scoringMode, stages: p.stages, officialKind: p.officialKind, passMinScore: p.passMinScore, passMaxZeros: p.passMaxZeros }} openMatches={openMatches} />
    </div>
  );
}
