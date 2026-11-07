import Link from "next/link";
import { CalendarDays, ChevronRight, Clock, MapPin, Plus } from "lucide-react";
import { Card, SectionTitle } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { AppContext, ActiveTenant } from "@/lib/tenant";
import { eventDescriptions, listCurrentAnnouncements, listEvents } from "../queries";
import { getRequestLocale, getT, getTenantLocale } from "@/lib/i18n";
import { displayContent } from "@/modules/ai/content/service";
import { TranslationSwitchButton, TranslationToggle } from "@/modules/ai/content/ui/translation-toggle";
import { whenLabelL } from "./i18n";
import { AnnouncementCard } from "./announcement-card";
import { DateBadge, KindChip } from "./bits";
import { MyRsvpBadge } from "./event-card";

function hasEvents(ctx: AppContext): ctx is AppContext & { tenant: ActiveTenant } {
  return !!ctx.tenant && ctx.hasModule("events");
}

/** Nächste Anlässe (max. 3) für die Startseite. Rendert nichts, wenn das Modul aus ist. */
export async function UpcomingEventsCard({ ctx, limit = 3 }: { ctx: AppContext; limit?: number }) {
  if (!hasEvents(ctx)) return null;
  const [rawEvents, locale, sourceLocale] = await Promise.all([
    listEvents(ctx, { tab: "upcoming", limit: limit + 2 }).then((list) => list.slice(0, limit)),
    getRequestLocale(),
    getTenantLocale(ctx.tenant.id),
  ]);
  // Titel in der Sprache des Mitglieds – nur wenn der ganze Anlass aktuell übersetzt ist (wie auf /events).
  const descriptions = locale === sourceLocale ? new Map<string, string | null>() : await eventDescriptions(ctx.tenant.id, rawEvents.map((e) => e.id));
  const titles = await displayContent(ctx.tenant.id, "event", rawEvents.map((e) => ({ id: e.id, sources: { title: e.title, description: descriptions.get(e.id) ?? null } })), locale);
  const events = rawEvents.map((e) => {
    const d = titles.get(e.id);
    return d?.translated && d.fields.title ? { ...e, title: d.fields.title } : e;
  });
  const canManage = ctx.can("events.manage");
  const t = getT(locale);

  return (
    <section>
      <SectionTitle action={<Link href="/events" className="text-xs text-ink-3 hover:text-ink">{t("money.payments.all")}</Link>}>{t("money.events.dash.upcoming")}</SectionTitle>
      {events.length ? (
        <Card className="animate-rise divide-y divide-line overflow-hidden">
          {events.map((e) => (
            <Link key={e.id} href={`/events/${e.id}`} className={cn("press flex items-center gap-3 p-3 hover:bg-surface-2/60", e.isCancelled && "opacity-70")}>
              <DateBadge date={e.startsAt} muted={e.isCancelled} locale={locale} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <KindChip kind={e.kind} locale={locale} />
                  {e.isCancelled ? <span className="text-xs font-semibold text-accent">{t("money.events.cancelled")}</span> : e.rsvpEnabled ? <MyRsvpBadge status={e.myStatus} open={e.rsvpOpen} locale={locale} /> : null}
                </div>
                <p className={cn("mt-0.5 truncate font-medium", e.isCancelled && "line-through")}>{e.title}</p>
                <p className="flex min-w-0 items-center gap-x-2 text-xs text-ink-3">
                  <span className="inline-flex shrink-0 items-center gap-1"><Clock className="h-3 w-3" />{whenLabelL(e, locale)}</span>
                  {e.location ? <span className="inline-flex min-w-0 items-center gap-1"><MapPin className="h-3 w-3 shrink-0" /><span className="truncate">{e.location}</span></span> : null}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" />
            </Link>
          ))}
        </Card>
      ) : (
        <Card className="animate-rise flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-2"><CalendarDays className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="font-medium">{t("money.events.empty.none")}</p>
            <p className="text-sm text-ink-3">{canManage ? t("money.events.dash.emptyManage") : t("money.events.dash.emptyMember")}</p>
          </div>
          {canManage ? (
            <Link href="/admin/events/new" className="press inline-flex h-10 shrink-0 items-center gap-1 rounded-control bg-ink px-3 text-sm font-medium text-bg"><Plus className="h-4 w-4" /> {t("money.events.dash.new")}</Link>
          ) : null}
        </Card>
      )}
    </section>
  );
}

/** Aktuelle Mitteilungen (angeheftete zuerst, max. 3). Rendert nichts ohne Mitteilungen. */
export async function AnnouncementsCard({ ctx, limit = 3 }: { ctx: AppContext; limit?: number }) {
  if (!hasEvents(ctx)) return null;
  const items = await listCurrentAnnouncements(ctx.tenant.id, limit);
  if (!items.length) return null;
  const [locale, sourceLocale] = await Promise.all([getRequestLocale(), getTenantLocale(ctx.tenant.id)]);
  const t = getT(locale);
  // Mitteilungen in der Sprache des Mitglieds, wenn aktuell übersetzt (sonst Original) – wie auf /events.
  const shown = await displayContent(ctx.tenant.id, "announcement", items.map((a) => ({ id: a.id, sources: { title: a.title, body: a.body } })), locale);
  return (
    <section>
      <SectionTitle action={<Link href="/events" className="text-xs text-ink-3 hover:text-ink">{t("money.payments.all")}</Link>}>{t("money.news.title")}</SectionTitle>
      <div className="stagger space-y-2.5">
        {items.map((a) => {
          const d = shown.get(a.id);
          if (!d?.translated) return <AnnouncementCard key={a.id} a={a} compact locale={locale} />;
          const switchBtn = <TranslationSwitchButton locale={locale} sourceLocale={sourceLocale} reviewed={d.reviewed} />;
          return (
            <TranslationToggle
              key={a.id}
              translated={<AnnouncementCard a={{ ...a, title: d.fields.title ?? a.title, body: d.fields.body ?? a.body }} compact locale={locale}>{switchBtn}</AnnouncementCard>}
              original={<AnnouncementCard a={a} compact locale={locale}>{switchBtn}</AnnouncementCard>}
            />
          );
        })}
      </div>
    </section>
  );
}
