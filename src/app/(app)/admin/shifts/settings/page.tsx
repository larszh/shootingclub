import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { requireShiftsAdmin } from "@/modules/shifts/guard";
import { getWorkSettings } from "@/modules/shifts/queries";
import { WORK_STATUS_OPTIONS } from "@/modules/shifts/types";
import { statusLabel } from "@/modules/members/types";
import { WorkSettingsForm } from "@/modules/shifts/ui/settings-form";

export const metadata: Metadata = { title: "Arbeitsstunden: Einstellungen" };

export default async function ShiftSettingsPage() {
  const ctx = await requireShiftsAdmin();
  const s = await getWorkSettings(ctx.tenant.id);
  return (
    <div>
      <PageHeader title="Arbeitsstunden" subtitle="Soll pro Jahr und Ersatzabgabe" back={{ href: "/admin/shifts", label: "Einsätze" }} />
      <WorkSettingsForm
        initial={{ enabled: s.enabled, requiredHours: s.requiredHours, rate: s.ratePerMissingHourCents ? (s.ratePerMissingHourCents / 100).toFixed(2) : "", statuses: s.statuses }}
        statusOptions={WORK_STATUS_OPTIONS.map((v) => ({ value: v, label: statusLabel(v) }))}
      />
    </div>
  );
}
