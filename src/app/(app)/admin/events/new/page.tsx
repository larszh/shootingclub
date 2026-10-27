import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { getEventForEdit, requireEventsPermission } from "@/modules/events/queries";
import { blankEventDefaults, eventToDefaults } from "@/modules/events/form-defaults";
import { EventForm } from "@/modules/events/ui/event-form";

export const metadata: Metadata = { title: "Neuer Anlass" };

export default async function NewEventPage({ searchParams }: { searchParams: Promise<{ copy?: string }> }) {
  const ctx = await requireEventsPermission("events.manage");
  const sp = await searchParams;
  const source = sp.copy ? await getEventForEdit(ctx.tenant.id, sp.copy) : null;
  const initial = source ? eventToDefaults(source, { keepId: false, shiftDays: 7 }) : blankEventDefaults();
  return (
    <div>
      <PageHeader title={source ? "Anlass duplizieren" : "Neuer Anlass"} subtitle={source ? `Kopie von «${source.title}», eine Woche später. Passe Datum und Details an.` : "Training, Wettkampf, Versammlung oder Arbeitseinsatz"} back={{ href: source ? `/events/${source.id}` : "/admin/events", label: "Zurück" }} />
      <EventForm initial={initial} mode={source ? "copy" : "create"} />
    </div>
  );
}
