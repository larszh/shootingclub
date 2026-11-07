import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { getEventForEdit, requireEventsPermission } from "@/modules/events/queries";
import { eventToDefaults } from "@/modules/events/form-defaults";
import { EventForm } from "@/modules/events/ui/event-form";
import { writingAvailability } from "@/modules/ai/content/service";
import { ContentTranslations } from "@/modules/ai/content/ui/content-translations";
import { getRequestLocale, getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("misc.events.editTitle") };
}

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireEventsPermission("events.manage");
  const { id } = await params;
  const event = await getEventForEdit(ctx.tenant.id, id);
  if (!event) notFound();
  const writing = await writingAvailability(ctx, "event");
  const t = getT(await getRequestLocale());
  return (
    <div>
      <PageHeader title={t("misc.events.editTitle")} subtitle={event.title} back={{ href: `/events/${event.id}`, label: t("misc.events.back") }} />
      <EventForm initial={eventToDefaults(event, { keepId: true })} mode="edit" writing={writing} />
      <div className="mt-6">
        <ContentTranslations ctx={ctx} type="event" id={event.id} />
      </div>
    </div>
  );
}
