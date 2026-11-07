import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { getRequestLocale, getT } from "@/lib/i18n";
import { requireQualificationAccess } from "@/modules/courses/guard";
import { programOptions } from "@/modules/courses/queries";
import { RuleForm } from "@/modules/courses/ui/rule-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("adm2.courses.q.newMeta") };
}

export default async function NewRulePage() {
  const ctx = await requireQualificationAccess();
  const t = getT(await getRequestLocale());
  const programs = await programOptions(ctx.tenant.id);
  return (
    <div className="max-w-2xl">
      <PageHeader title={t("adm2.courses.q.newTitle")} back={{ href: "/courses/qualifications", label: t("adm2.courses.q.quals") }} />
      <RuleForm programs={programs} allKinds={ctx.can("qualifications.manage")} />
    </div>
  );
}
