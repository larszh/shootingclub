import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { todayZurich } from "@/lib/time";
import { requireEventsPermission } from "@/modules/events/queries";
import { AnnouncementForm } from "@/modules/events/ui/announcement-form";
import { writingAvailability } from "@/modules/ai/content/service";
import { getRequestLocale, getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("misc.events.annNew") };
}

export default async function NewAnnouncementPage() {
  const ctx = await requireEventsPermission("announcements.manage");
  const writing = await writingAvailability(ctx, "announcement");
  const t = getT(await getRequestLocale());
  return (
    <div>
      <PageHeader title={t("misc.events.annNew")} back={{ href: "/admin/events/announcements", label: t("misc.events.announcements") }} />
      <AnnouncementForm initial={{ title: "", body: "", pinned: false, expiresOn: "" }} minDate={todayZurich()} writing={writing} />
    </div>
  );
}
