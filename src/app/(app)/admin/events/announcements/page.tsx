import type { Metadata } from "next";
import { Megaphone, Plus } from "lucide-react";
import { Alert, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { listAllAnnouncements, requireEventsPermission } from "@/modules/events/queries";
import { AnnouncementCard } from "@/modules/events/ui/announcement-card";
import { AnnouncementRowActions } from "@/modules/events/ui/manage-actions";
import { getRequestLocale, getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("misc.events.announcements") };
}

export default async function AnnouncementsAdminPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const ctx = await requireEventsPermission("announcements.manage");
  const sp = await searchParams;
  const items = await listAllAnnouncements(ctx.tenant.id);
  const locale = await getRequestLocale();
  const t = getT(locale);
  return (
    <div>
      <PageHeader title={t("misc.events.announcements")} subtitle={t("misc.events.announcementsSub")} back={{ href: "/events", label: t("money.events.title") }}
        action={<LinkButton href="/admin/events/announcements/new" size="sm"><Plus className="h-4 w-4" /> {t("misc.events.new")}</LinkButton>} />
      {sp.saved ? <div className="mb-4"><Alert tone="ok">{t("misc.events.annSaved")}</Alert></div> : null}
      {items.length ? (
        <div className="stagger space-y-2.5">
          {items.map((a) => (
            <div key={a.id} className={a.isExpired ? "opacity-60" : undefined}>
              <AnnouncementCard a={a} locale={locale}>
                <AnnouncementRowActions id={a.id} pinned={a.pinned} />
              </AnnouncementCard>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={<Megaphone className="h-5 w-5" />} title={t("misc.events.noAnn")} text={t("misc.events.noAnnText")}
          action={<LinkButton href="/admin/events/announcements/new" size="sm"><Plus className="h-4 w-4" /> {t("misc.events.annWrite")}</LinkButton>} />
      )}
    </div>
  );
}
