import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { requireChampionshipAdmin } from "@/modules/championship/guard";
import { getChampionship, listSelectablePrograms } from "@/modules/championship/queries";
import { ChampionshipForm } from "@/modules/championship/ui/championship-form";

export const metadata: Metadata = { title: "Meisterschaft bearbeiten" };

export default async function EditChampionshipPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireChampionshipAdmin();
  const { id } = await params;
  const c = await getChampionship(ctx.tenant.id, id);
  if (!c) notFound();
  const programs = await listSelectablePrograms(ctx.tenant.id, c.programs.map((p) => p.programId));
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Meisterschaft bearbeiten" subtitle={c.name} back={{ href: `/championship/${c.id}`, label: "Rangliste" }} />
      <ChampionshipForm
        programs={programs}
        values={{
          id: c.id, name: c.name, year: c.year, startsOn: c.startsOn, endsOn: c.endsOn, bestOf: c.bestOf, officialOnly: c.officialOnly,
          categoriesText: c.categoriesText, rulesText: c.rulesText,
          programs: c.programs.map((p) => ({ programId: p.programId, required: p.required, weight: p.weight, maxCount: p.maxCount })),
        }}
      />
    </div>
  );
}
