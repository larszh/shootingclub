import { requirePermission } from "@/lib/tenant";
import { PageHeader } from "@/components/ui";
import { AdminBookingTabs } from "@/modules/bookings/ui/admin-tabs";
import { getBookingSettings, listProviderConfigs } from "@/modules/bookings/queries";
import { BookingSettingsForm } from "@/modules/bookings/ui/settings-form";

export const metadata = { title: "Reservations-Einstellungen" };

export default async function BookingSettingsPage() {
  const ctx = await requirePermission("tenant.manage");
  const [settings, providers] = await Promise.all([getBookingSettings(ctx.tenant.id), listProviderConfigs(ctx.tenant.id)]);
  return (
    <div>
      <PageHeader title="Einstellungen" subtitle="Dauer, Preise, Öffnungszeiten, Freigabe, Zahlung" back={{ href: "/admin/bookings", label: "Reservationen" }} />
      <AdminBookingTabs />
      <BookingSettingsForm settings={settings} providers={providers} />
    </div>
  );
}
