import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { todayZurich } from "@/lib/time";
import { requireChampionshipAdmin } from "@/modules/championship/guard";
import { listSelectablePrograms } from "@/modules/championship/queries";
import { ChampionshipForm } from "@/modules/championship/ui/championship-form";

export const metadata: Metadata = { title: "Neue Meisterschaft" };

export default async function NewChampionshipPage() {
  const ctx = await requireChampionshipAdmin();
  const year = Number(todayZurich().slice(0, 4));
  const programs = await listSelectablePrograms(ctx.tenant.id);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Neue Meisterschaft" subtitle="Programme, Streichresultate und Kategorien festlegen" back={{ href: "/championship", label: "Meisterschaft" }} />
      <ChampionshipForm
        programs={programs}
        values={{ name: `Jahresmeisterschaft ${year}`, year, startsOn: `${year}-01-01`, endsOn: `${year}-12-31`, bestOf: 3, officialOnly: false, categoriesText: "", rulesText: "", programs: [] }}
      />
    </div>
  );
}
