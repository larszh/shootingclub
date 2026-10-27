import { requirePermission } from "@/lib/tenant";
import { PageHeader } from "@/components/ui";
import { getBookingSettings } from "@/modules/bookings/queries";
import { ResourceForm } from "@/modules/bookings/ui/resource-form";

export const metadata = { title: "Neue Ressource" };

export default async function NewResourcePage() {
  const ctx = await requirePermission("tenant.manage");
  const settings = await getBookingSettings(ctx.tenant.id);
  return (
    <div>
      <PageHeader title="Neue Ressource" back={{ href: "/admin/bookings/resources", label: "Ressourcen" }} />
      <ResourceForm tenantDurations={settings.durationOptions} currency={settings.currency} />
    </div>
  );
}
