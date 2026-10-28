import type { Metadata } from "next";
import { Megaphone, Plus } from "lucide-react";
import { Alert, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { listAllAnnouncements, requireEventsPermission } from "@/modules/events/queries";
import { AnnouncementCard } from "@/modules/events/ui/announcement-card";
import { AnnouncementRowActions } from "@/modules/events/ui/manage-actions";

export const metadata: Metadata = { title: "Mitteilungen" };

export default async function AnnouncementsAdminPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const ctx = await requireEventsPermission("announcements.manage");
  const sp = await searchParams;
  const items = await listAllAnnouncements(ctx.tenant.id);
  return (
    <div>
      <PageHeader title="Mitteilungen" subtitle="Infos an alle Mitglieder, sichtbar unter «Anlässe» und auf der Startseite." back={{ href: "/events", label: "Anlässe" }}
        action={<LinkButton href="/admin/events/announcements/new" size="sm"><Plus className="h-4 w-4" /> Neu</LinkButton>} />
      {sp.saved ? <div className="mb-4"><Alert tone="ok">Mitteilung gespeichert.</Alert></div> : null}
      {items.length ? (
        <div className="stagger space-y-2.5">
          {items.map((a) => (
            <div key={a.id} className={a.isExpired ? "opacity-60" : undefined}>
              <AnnouncementCard a={a}>
                <AnnouncementRowActions id={a.id} pinned={a.pinned} />
              </AnnouncementCard>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={<Megaphone className="h-5 w-5" />} title="Noch keine Mitteilungen" text="Informiere alle über Neuigkeiten, geänderte Öffnungszeiten oder wichtige Termine."
          action={<LinkButton href="/admin/events/announcements/new" size="sm"><Plus className="h-4 w-4" /> Mitteilung schreiben</LinkButton>} />
      )}
    </div>
  );
}
