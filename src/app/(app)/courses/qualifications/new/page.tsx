import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { requireQualificationAccess } from "@/modules/courses/guard";
import { programOptions } from "@/modules/courses/queries";
import { RuleForm } from "@/modules/courses/ui/rule-form";

export const metadata: Metadata = { title: "Neue Regel" };

export default async function NewRulePage() {
  const ctx = await requireQualificationAccess();
  const programs = await programOptions(ctx.tenant.id);
  return (
    <div className="max-w-2xl">
      <PageHeader title="Neue Qualifikationsregel" back={{ href: "/courses/qualifications", label: "Qualifikationen" }} />
      <RuleForm programs={programs} allKinds={ctx.can("qualifications.manage")} />
    </div>
  );
}
