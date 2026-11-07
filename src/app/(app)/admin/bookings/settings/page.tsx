import { requirePermission } from "@/lib/tenant";
import { PageHeader } from "@/components/ui";
import { AdminBookingTabs } from "@/modules/bookings/ui/admin-tabs";
import { getBookingSettings, listProviderConfigs } from "@/modules/bookings/queries";
import { BookingSettingsForm } from "@/modules/bookings/ui/settings-form";
import { getRequestLocale, getT } from "@/lib/i18n";

export async function generateMetadata() {
  return { title: getT(await getRequestLocale())("adm1.bk.settingsMeta") };
}

export default async function BookingSettingsPage() {
  const ctx = await requirePermission("tenant.manage");
  const t = getT(await getRequestLocale());
  const [settings, providers] = await Promise.all([getBookingSettings(ctx.tenant.id), listProviderConfigs(ctx.tenant.id)]);
  return (
    <div>
      <PageHeader title={t("adm1.common.settings")} subtitle={t("adm1.bk.settingsSubtitle")} back={{ href: "/admin/bookings", label: t("adm1.bk.title") }} />
      <AdminBookingTabs />
      <BookingSettingsForm settings={settings} providers={providers} />
    </div>
  );
}
