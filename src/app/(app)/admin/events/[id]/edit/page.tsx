import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { getEventForEdit, requireEventsPermission } from "@/modules/events/queries";
import { eventToDefaults } from "@/modules/events/form-defaults";
import { EventForm } from "@/modules/events/ui/event-form";

export const metadata: Metadata = { title: "Anlass bearbeiten" };

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireEventsPermission("events.manage");
  const { id } = await params;
  const event = await getEventForEdit(ctx.tenant.id, id);
  if (!event) notFound();
  return (
    <div>
      <PageHeader title="Anlass bearbeiten" subtitle={event.title} back={{ href: `/events/${event.id}`, label: "Zurück" }} />
      <EventForm initial={eventToDefaults(event, { keepId: true })} mode="edit" />
    </div>
  );
}
