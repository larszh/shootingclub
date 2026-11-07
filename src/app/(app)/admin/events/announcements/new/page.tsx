import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { todayZurich } from "@/lib/time";
import { requireEventsPermission } from "@/modules/events/queries";
import { AnnouncementForm } from "@/modules/events/ui/announcement-form";
import { writingAvailability } from "@/modules/ai/content/service";

export const metadata: Metadata = { title: "Neue Mitteilung" };

export default async function NewAnnouncementPage() {
  const ctx = await requireEventsPermission("announcements.manage");
  const writing = await writingAvailability(ctx, "announcement");
  return (
    <div>
      <PageHeader title="Neue Mitteilung" back={{ href: "/admin/events/announcements", label: "Mitteilungen" }} />
      <AnnouncementForm initial={{ title: "", body: "", pinned: false, expiresOn: "" }} minDate={todayZurich()} writing={writing} />
    </div>
  );
}
