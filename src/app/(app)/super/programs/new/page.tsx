import { requireSuperAdmin } from "@/lib/tenant";
import { PageHeader } from "@/components/ui";
import { ProgramForm } from "@/modules/scores/ui/program-form";

export const metadata = { title: "Globales Programm" };

export default async function SuperNewProgramPage() {
  await requireSuperAdmin();
  return (
    <div>
      <PageHeader title="Globales Programm" subtitle="Für alle Tenants verfügbar" back={{ href: "/super/programs", label: "Globale Programme" }} />
      <ProgramForm scope="global" />
    </div>
  );
}
