import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { getEventForEdit, requireEventsPermission } from "@/modules/events/queries";
import { blankEventDefaults, eventToDefaults } from "@/modules/events/form-defaults";
import { EventForm } from "@/modules/events/ui/event-form";
import { writingAvailability } from "@/modules/ai/content/service";
import { getRequestLocale, getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("misc.events.newTitle") };
}

export default async function NewEventPage({ searchParams }: { searchParams: Promise<{ copy?: string }> }) {
  const ctx = await requireEventsPermission("events.manage");
  const sp = await searchParams;
  const source = sp.copy ? await getEventForEdit(ctx.tenant.id, sp.copy) : null;
  const writing = await writingAvailability(ctx, "event");
  const t = getT(await getRequestLocale());
  const initial = source ? eventToDefaults(source, { keepId: false, shiftDays: 7 }) : blankEventDefaults();
  return (
    <div>
      <PageHeader title={t(source ? "misc.events.copyTitle" : "misc.events.newTitle")} subtitle={source ? t("misc.events.copySub", { title: source.title }) : t("misc.events.newSub")} back={{ href: source ? `/events/${source.id}` : "/admin/events", label: t("misc.events.back") }} />
      <EventForm initial={initial} mode={source ? "copy" : "create"} writing={writing} />
    </div>
  );
}
