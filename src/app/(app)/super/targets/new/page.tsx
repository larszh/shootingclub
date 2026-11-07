import { requireSuperAdmin } from "@/lib/tenant";
import { PageHeader } from "@/components/ui";
import { getRequestLocale, getT } from "@/lib/i18n";
import { TargetForm } from "@/modules/targets/ui/target-form";

export async function generateMetadata() {
  return { title: getT(await getRequestLocale())("adm2.super.tg.newTitle") };
}

export default async function SuperNewTargetPage() {
  await requireSuperAdmin();
  const t = getT(await getRequestLocale());
  return (
    <div>
      <PageHeader title={t("adm2.super.tg.newTitle")} subtitle={t("adm2.super.p.forAll")} back={{ href: "/super/targets", label: t("adm2.super.targets") }} />
      <TargetForm scope="global" />
    </div>
  );
}
