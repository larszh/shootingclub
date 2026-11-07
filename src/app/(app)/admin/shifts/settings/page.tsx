import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { getRequestLocale, getT } from "@/lib/i18n";
import { requireShiftsAdmin } from "@/modules/shifts/guard";
import { getWorkSettings } from "@/modules/shifts/queries";
import { WORK_STATUS_OPTIONS } from "@/modules/shifts/types";
import { WorkSettingsForm } from "@/modules/shifts/ui/settings-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("adm2.shifts.settings.metaTitle") };
}

export default async function ShiftSettingsPage() {
  const ctx = await requireShiftsAdmin();
  const t = getT(await getRequestLocale());
  const s = await getWorkSettings(ctx.tenant.id);
  return (
    <div>
      <PageHeader title={t("adm2.shifts.settings.title")} subtitle={t("adm2.shifts.settings.subtitle")} back={{ href: "/admin/shifts", label: t("adm2.shifts.tab.shifts") }} />
      <WorkSettingsForm
        initial={{ enabled: s.enabled, proRata: s.proRata, requiredHours: s.requiredHours, rate: s.ratePerMissingHourCents ? (s.ratePerMissingHourCents / 100).toFixed(2) : "", statuses: s.statuses }}
        statusOptions={WORK_STATUS_OPTIONS.map((v) => ({ value: v, label: t(`members.status.${v}`) }))}
      />
    </div>
  );
}
