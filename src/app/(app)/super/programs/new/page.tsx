import { requireSuperAdmin } from "@/lib/tenant";
import { PageHeader } from "@/components/ui";
import { getRequestLocale, getT } from "@/lib/i18n";
import { ProgramForm } from "@/modules/scores/ui/program-form";

export async function generateMetadata() {
  return { title: getT(await getRequestLocale())("adm2.super.p.newTitle") };
}

export default async function SuperNewProgramPage() {
  await requireSuperAdmin();
  const t = getT(await getRequestLocale());
  return (
    <div>
      <PageHeader title={t("adm2.super.p.newTitle")} subtitle={t("adm2.super.p.forAll")} back={{ href: "/super/programs", label: t("adm2.super.programs") }} />
      <ProgramForm scope="global" />
    </div>
  );
}
