import { requireEventsPermission } from "@/modules/events/queries";
import { AdminEventTabs } from "@/modules/events/ui/admin-tabs";

export default async function AdminEventsLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireEventsPermission("events.manage");
  return (
    <div>
      <AdminEventTabs showAnnouncements={ctx.can("announcements.manage")} />
      {children}
    </div>
  );
}
