import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { getEventForEdit, requireEventsPermission } from "@/modules/events/queries";
import { eventToDefaults } from "@/modules/events/form-defaults";
import { EventForm } from "@/modules/events/ui/event-form";
import { writingAvailability } from "@/modules/ai/content/service";
import { ContentTranslations } from "@/modules/ai/content/ui/content-translations";

export const metadata: Metadata = { title: "Anlass bearbeiten" };

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireEventsPermission("events.manage");
  const { id } = await params;
  const event = await getEventForEdit(ctx.tenant.id, id);
  if (!event) notFound();
  const writing = await writingAvailability(ctx, "event");
  return (
    <div>
      <PageHeader title="Anlass bearbeiten" subtitle={event.title} back={{ href: `/events/${event.id}`, label: "Zurück" }} />
      <EventForm initial={eventToDefaults(event, { keepId: true })} mode="edit" writing={writing} />
      <div className="mt-6">
        <ContentTranslations ctx={ctx} type="event" id={event.id} />
      </div>
    </div>
  );
}
