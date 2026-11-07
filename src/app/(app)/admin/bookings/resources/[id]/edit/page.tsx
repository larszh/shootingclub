import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/tenant";
import { PageHeader } from "@/components/ui";
import { getBookingSettings, getResource } from "@/modules/bookings/queries";
import { ResourceForm } from "@/modules/bookings/ui/resource-form";
import { getRequestLocale, getT } from "@/lib/i18n";

export async function generateMetadata() {
  return { title: getT(await getRequestLocale())("adm1.bk.editResource") };
}

export default async function EditResourcePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePermission("tenant.manage");
  const { id } = await params;
  const t = getT(await getRequestLocale());
  const [settings, resource] = await Promise.all([getBookingSettings(ctx.tenant.id), getResource(ctx.tenant.id, id)]);
  if (!resource) notFound();
  return (
    <div>
      <PageHeader title={resource.name} subtitle={t("adm1.bk.editResource")} back={{ href: "/admin/bookings/resources", label: t("adm1.bk.resources") }} />
      <ResourceForm initial={resource} tenant={{ durationOptions: settings.durationOptions, currency: settings.currency, personPricing: settings.personPricing, maxPersons: settings.maxPersons, flatExclusive: settings.flatExclusive, capacityPerPerson: settings.capacityPerPerson }} />
    </div>
  );
}
