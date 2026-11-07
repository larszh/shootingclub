import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { getRequestLocale, getT } from "@/lib/i18n";
import { todayZurich } from "@/lib/time";
import { requireChampionshipAdmin } from "@/modules/championship/guard";
import { listSelectablePrograms } from "@/modules/championship/queries";
import { ChampionshipForm } from "@/modules/championship/ui/championship-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("adm2.champ.new.title") };
}

export default async function NewChampionshipPage() {
  const ctx = await requireChampionshipAdmin();
  const t = getT(await getRequestLocale());
  const year = Number(todayZurich().slice(0, 4));
  const programs = await listSelectablePrograms(ctx.tenant.id);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t("adm2.champ.new.title")} subtitle={t("adm2.champ.new.subtitle")} back={{ href: "/championship", label: t("adm2.champ.back") }} />
      <ChampionshipForm
        programs={programs}
        values={{ name: t("adm2.champ.defaultName", { year }), year, startsOn: `${year}-01-01`, endsOn: `${year}-12-31`, bestOf: 3, officialOnly: false, categoriesText: "", rulesText: "", programs: [] }}
      />
    </div>
  );
}
