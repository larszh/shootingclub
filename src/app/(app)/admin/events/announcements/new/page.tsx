import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { todayZurich } from "@/lib/time";
import { requireEventsPermission } from "@/modules/events/queries";
import { AnnouncementForm } from "@/modules/events/ui/announcement-form";

export const metadata: Metadata = { title: "Neue Mitteilung" };

export default async function NewAnnouncementPage() {
  await requireEventsPermission("announcements.manage");
  return (
    <div>
      <PageHeader title="Neue Mitteilung" back={{ href: "/admin/events/announcements", label: "Mitteilungen" }} />
      <AnnouncementForm initial={{ title: "", body: "", pinned: false, expiresOn: "" }} minDate={todayZurich()} />
    </div>
  );
}
