import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { addDays, todayZurich, zurichParts } from "@/lib/time";
import { getAnnouncement, requireEventsPermission } from "@/modules/events/queries";
import { AnnouncementForm } from "@/modules/events/ui/announcement-form";

export const metadata: Metadata = { title: "Mitteilung bearbeiten" };

export default async function EditAnnouncementPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireEventsPermission("announcements.manage");
  const { id } = await params;
  const a = await getAnnouncement(ctx.tenant.id, id);
  if (!a) notFound();
  // expiresAt liegt am Tagesanfang nach dem letzten sichtbaren Tag
  const expiresOn = a.expiresAt ? addDays(zurichParts(a.expiresAt).dateStr, -1) : "";
  return (
    <div>
      <PageHeader title="Mitteilung bearbeiten" back={{ href: "/admin/events/announcements", label: "Mitteilungen" }} />
      <AnnouncementForm initial={{ id: a.id, title: a.title, body: a.body, pinned: a.pinned, expiresOn }} minDate={todayZurich()} />
    </div>
  );
}
