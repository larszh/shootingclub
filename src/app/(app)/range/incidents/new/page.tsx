import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { todayZurich, zurichParts } from "@/lib/time";
import { requireRange } from "@/modules/range/guard";
import { listOpenDays } from "@/modules/range/queries";
import { dbDateKey } from "@/modules/range/logic";
import { IncidentForm } from "@/modules/range/ui/incident-form";
import { EmergencyBox } from "@/modules/range/ui/emergency-box";

export const metadata: Metadata = { title: "Vorfall melden" };

function nowParts() {
  return zurichParts(new Date());
}

export default async function NewIncidentPage() {
  const ctx = await requireRange();
  const today = todayZurich();
  const open = (await listOpenDays(ctx.tenant.id)).find((d) => dbDateKey(d.date) === today);
  const now = nowParts();
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <PageHeader title="Vorfall melden" subtitle="Unfall, Beinahe-Unfall oder Schaden" back={{ href: "/range/incidents", label: "Vorfälle" }} />
      <EmergencyBox hasRules />
      <IncidentForm defaultDate={now.dateStr} defaultTime={now.timeStr} defaultLocation={open?.resource?.name ?? ""} />
    </div>
  );
}
