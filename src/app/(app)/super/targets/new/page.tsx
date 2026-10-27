import { requireSuperAdmin } from "@/lib/tenant";
import { PageHeader } from "@/components/ui";
import { TargetForm } from "@/modules/targets/ui/target-form";

export const metadata = { title: "Globale Scheibe" };

export default async function SuperNewTargetPage() {
  await requireSuperAdmin();
  return (
    <div>
      <PageHeader title="Globale Scheibe" subtitle="Für alle Tenants verfügbar" back={{ href: "/super/targets", label: "Globale Scheiben" }} />
      <TargetForm scope="global" />
    </div>
  );
}
