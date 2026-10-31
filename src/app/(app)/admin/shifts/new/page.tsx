import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { formatDateZurich, todayZurich } from "@/lib/time";
import { requireShiftsAdmin } from "@/modules/shifts/guard";
import { shiftEventOptions } from "@/modules/shifts/queries";
import { ShiftForm } from "@/modules/shifts/ui/shift-form";

export const metadata: Metadata = { title: "Einsatz erfassen" };

export default async function NewShiftPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const ctx = await requireShiftsAdmin();
  const sp = await searchParams;
  const events = await shiftEventOptions(ctx.tenant.id);
  const choices = events.map((e) => ({ id: e.id, title: e.title, kind: e.kind, day: e.day, time: e.time, endTime: e.endTime, label: `${formatDateZurich(e.startsAt)} · ${e.title}` }));
  const pre = sp.event ? events.find((e) => e.id === sp.event) : undefined;
  return (
    <div>
      <PageHeader title="Einsatz erfassen" back={{ href: "/admin/shifts", label: "Einsätze" }} />
      <ShiftForm events={choices} defaultDate={todayZurich()}
        initial={pre ? { title: pre.kind === "WORK" ? "Arbeitseinsatz" : "Helfer", eventId: pre.id, date: pre.day, startTime: pre.time ?? "08:00", endTime: pre.endTime ?? "12:00", capacity: 2, requiredQualification: null, hoursCredit: null, note: null } : undefined} />
    </div>
  );
}
