import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { getRequestLocale, getT } from "@/lib/i18n";
import { todayZurich, zurichParts } from "@/lib/time";
import { requireRange } from "@/modules/range/guard";
import { listOpenDays } from "@/modules/range/queries";
import { dbDateKey } from "@/modules/range/logic";
import { IncidentForm } from "@/modules/range/ui/incident-form";
import { EmergencyBox } from "@/modules/range/ui/emergency-box";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("shooting.incident.new") };
}

function nowParts() {
  return zurichParts(new Date());
}

export default async function NewIncidentPage() {
  const ctx = await requireRange();
  const today = todayZurich();
  const open = (await listOpenDays(ctx.tenant.id)).find((d) => dbDateKey(d.date) === today);
  const now = nowParts();
  const locale = await getRequestLocale();
  const t = getT(locale);
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <PageHeader title={t("shooting.incident.new")} subtitle={t("shooting.incident.newSubtitle")} back={{ href: "/range/incidents", label: t("shooting.range.tab./range/incidents") }} />
      <EmergencyBox hasRules locale={locale} />
      <IncidentForm locale={locale} defaultDate={now.dateStr} defaultTime={now.timeStr} defaultLocation={open?.resource?.name ?? ""} />
    </div>
  );
}
