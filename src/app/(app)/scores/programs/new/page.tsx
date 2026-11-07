import type { Metadata } from "next";
import { requirePermission } from "@/lib/tenant";
import { PageHeader } from "@/components/ui";
import { ProgramForm } from "@/modules/scores/ui/program-form";
import { getRequestLocale, getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("shooting.program.form.newTitle") };
}

export default async function NewProgramPage() {
  await requirePermission("tenant.programs.manage");
  const t = getT(await getRequestLocale());
  return (
    <div>
      <PageHeader title={t("shooting.program.form.newTitle")} subtitle={t("shooting.program.form.newSub")} back={{ href: "/scores/programs", label: t("shooting.program.form.programs") }} />
      <ProgramForm scope="tenant" />
    </div>
  );
}
