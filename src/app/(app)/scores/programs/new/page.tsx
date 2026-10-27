import type { Metadata } from "next";
import { requirePermission } from "@/lib/tenant";
import { PageHeader } from "@/components/ui";
import { ProgramForm } from "@/modules/scores/ui/program-form";

export const metadata: Metadata = { title: "Neues Programm" };

export default async function NewProgramPage() {
  await requirePermission("tenant.programs.manage");
  return (
    <div>
      <PageHeader title="Neues Programm" subtitle="Nur für deinen Verein sichtbar" back={{ href: "/scores/programs", label: "Programme" }} />
      <ProgramForm scope="tenant" />
    </div>
  );
}
