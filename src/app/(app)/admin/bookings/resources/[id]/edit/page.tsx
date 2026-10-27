import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/tenant";
import { PageHeader } from "@/components/ui";
import { getBookingSettings, getResource } from "@/modules/bookings/queries";
import { ResourceForm } from "@/modules/bookings/ui/resource-form";

export const metadata = { title: "Ressource bearbeiten" };

export default async function EditResourcePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePermission("tenant.manage");
  const { id } = await params;
  const [settings, resource] = await Promise.all([getBookingSettings(ctx.tenant.id), getResource(ctx.tenant.id, id)]);
  if (!resource) notFound();
  return (
    <div>
      <PageHeader title={resource.name} subtitle="Ressource bearbeiten" back={{ href: "/admin/bookings/resources", label: "Ressourcen" }} />
      <ResourceForm initial={resource} tenantDurations={settings.durationOptions} currency={settings.currency} />
    </div>
  );
}
