import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { todayZurich } from "@/lib/time";
import { getRequestLocale, getT } from "@/lib/i18n";
import { formatDate } from "@/lib/i18n/core";
import { requireShiftsAdmin } from "@/modules/shifts/guard";
import { shiftEventOptions } from "@/modules/shifts/queries";
import { ShiftForm } from "@/modules/shifts/ui/shift-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("adm2.shifts.new.title") };
}

export default async function NewShiftPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const ctx = await requireShiftsAdmin();
  const locale = await getRequestLocale();
  const t = getT(locale);
  const sp = await searchParams;
  const events = await shiftEventOptions(ctx.tenant.id);
  const choices = events.map((e) => ({ id: e.id, title: e.title, kind: e.kind, day: e.day, time: e.time, endTime: e.endTime, label: `${formatDate(e.startsAt, locale, { weekday: "short" })} · ${e.title}` }));
  const pre = sp.event ? events.find((e) => e.id === sp.event) : undefined;
  return (
    <div>
      <PageHeader title={t("adm2.shifts.new.title")} back={{ href: "/admin/shifts", label: t("adm2.shifts.tab.shifts") }} />
      <ShiftForm events={choices} defaultDate={todayZurich()}
        initial={pre ? { title: pre.kind === "WORK" ? t("adm2.shifts.form.workTitle") : t("adm2.shifts.form.helperTitle"), eventId: pre.id, date: pre.day, startTime: pre.time ?? "08:00", endTime: pre.endTime ?? "12:00", capacity: 2, requiredQualification: null, hoursCredit: null, note: null } : undefined} />
    </div>
  );
}
