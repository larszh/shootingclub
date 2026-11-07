import { requirePermission } from "@/lib/tenant";
import { PageHeader } from "@/components/ui";
import { getBookingSettings } from "@/modules/bookings/queries";
import { ResourceForm } from "@/modules/bookings/ui/resource-form";
import { getRequestLocale, getT } from "@/lib/i18n";

export async function generateMetadata() {
  return { title: getT(await getRequestLocale())("adm1.bk.newResource") };
}

export default async function NewResourcePage() {
  const ctx = await requirePermission("tenant.manage");
  const t = getT(await getRequestLocale());
  const settings = await getBookingSettings(ctx.tenant.id);
  return (
    <div>
      <PageHeader title={t("adm1.bk.newResource")} back={{ href: "/admin/bookings/resources", label: t("adm1.bk.resources") }} />
      <ResourceForm tenant={{ durationOptions: settings.durationOptions, currency: settings.currency, personPricing: settings.personPricing, maxPersons: settings.maxPersons, flatExclusive: settings.flatExclusive, capacityPerPerson: settings.capacityPerPerson }} />
    </div>
  );
}
