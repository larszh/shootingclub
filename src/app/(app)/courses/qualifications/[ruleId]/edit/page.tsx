import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Alert, PageHeader } from "@/components/ui";
import { requireQualificationAccess } from "@/modules/courses/guard";
import { getRule, programOptions } from "@/modules/courses/queries";
import { isProtectedQualKind } from "@/modules/courses/types";
import { RuleForm } from "@/modules/courses/ui/rule-form";

export const metadata: Metadata = { title: "Regel bearbeiten" };

export default async function EditRulePage({ params }: { params: Promise<{ ruleId: string }> }) {
  const ctx = await requireQualificationAccess();
  const { ruleId } = await params;
  const rule = await getRule(ctx.tenant.id, ruleId.slice(0, 40));
  if (!rule) notFound();
  const allKinds = ctx.can("qualifications.manage");
  if (!allKinds && isProtectedQualKind(rule.kind)) {
    return (
      <div className="max-w-2xl">
        <PageHeader title="Regel bearbeiten" subtitle={rule.name} back={{ href: `/courses/qualifications/${rule.id}`, label: "Regel" }} />
        <Alert tone="info">Regeln für Sicherheits- und Leiterqualifikationen kann nur ein Admin bearbeiten.</Alert>
      </div>
    );
  }
  const programs = await programOptions(ctx.tenant.id);
  const all = programs.some((p) => p.id === rule.programId) ? programs : [{ id: rule.program.id, name: rule.program.name, discipline: rule.program.discipline, passMinScore: null, passMaxZeros: null, officialKind: null }, ...programs];
  return (
    <div className="max-w-2xl">
      <PageHeader title="Regel bearbeiten" subtitle={rule.name} back={{ href: `/courses/qualifications/${rule.id}`, label: "Regel" }} />
      <RuleForm
        programs={all}
        allKinds={allKinds}
        initial={{ id: rule.id, programId: rule.programId, name: rule.name, kind: rule.kind, passScore: rule.passScore, maxZeros: rule.maxZeros, validityMonths: rule.validityMonths, requireInstructor: rule.requireInstructor, isActive: rule.isActive }}
      />
    </div>
  );
}
