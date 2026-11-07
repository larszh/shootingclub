import { notFound } from "next/navigation";
import { requireSuperAdmin } from "@/lib/tenant";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { getRequestLocale, getT } from "@/lib/i18n";
import { parseStages } from "@/modules/scores/types";
import { ProgramForm } from "@/modules/scores/ui/program-form";

export async function generateMetadata() {
  return { title: getT(await getRequestLocale())("adm2.super.p.editTitle") };
}

export default async function SuperEditProgramPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSuperAdmin();
  const t = getT(await getRequestLocale());
  const { id } = await params;
  const p = await db.program.findUnique({ where: { id } });
  if (!p || p.tenantId !== null) notFound();
  return (
    <div>
      <PageHeader title={t("adm2.super.p.editTitle")} back={{ href: "/super/programs", label: t("adm2.super.programs") }} />
      <ProgramForm scope="global" initial={{ id: p.id, name: p.name, description: p.description, discipline: p.discipline, weaponNote: p.weaponNote, scoringMode: p.scoringMode, stages: parseStages(p.stagesJson), officialKind: p.officialKind, passMinScore: p.passMinScore, passMaxZeros: p.passMaxZeros }} />
    </div>
  );
}
