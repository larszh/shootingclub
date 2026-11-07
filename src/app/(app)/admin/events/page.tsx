import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, FileDown, Plus, Users } from "lucide-react";
import { Alert, Card, EmptyState, LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { cn } from "@/lib/utils";
import { getBaseUrl, getCalendarTokens, listEventsForAdmin, requireEventsPermission, tenantFeedPath, type EventListItem } from "@/modules/events/queries";
import { whenLabelL } from "@/modules/events/ui/i18n";
import { getRequestLocale, getT, type Locale, type TFunction } from "@/lib/i18n";
import { DateBadge, KindChip } from "@/modules/events/ui/bits";
import { EventRowActions } from "@/modules/events/ui/manage-actions";
import { TenantFeedAdmin } from "@/modules/events/ui/calendar-subscribe";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("misc.events.manageTitle") };
}

function AdminRow({ e, t, locale }: { e: EventListItem; t: TFunction; locale: Locale }) {
  const seats = e.counts.yes + e.counts.yesGuests;
  return (
    <Card className={cn("p-3", e.isCancelled && "opacity-75")}>
      <Link href={`/events/${e.id}`} className="press flex gap-3">
        <DateBadge date={e.startsAt} muted={e.isPast || e.isCancelled} locale={locale} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <KindChip kind={e.kind} locale={locale} />
            {e.isCancelled ? <span className="text-xs font-semibold text-accent">{t("money.events.cancelled")}</span> : null}
          </div>
          <p className={cn("mt-0.5 font-medium leading-snug", e.isCancelled && "line-through")}>{e.title}</p>
          <p className="text-xs text-ink-3">{whenLabelL(e, locale)}{e.location ? ` · ${e.location}` : ""}</p>
          {e.rsvpEnabled ? (
            <p className="mt-1 flex items-center gap-1 text-xs text-ink-3"><Users className="h-3.5 w-3.5" />{t("misc.events.counts", { yes: `${seats}${e.capacity ? `/${e.capacity}` : ""}`, maybe: e.counts.maybe, no: e.counts.no })}</p>
          ) : null}
        </div>
      </Link>
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-line pt-2">
        <EventRowActions eventId={e.id} isCancelled={e.isCancelled} />
        {e.rsvpEnabled ? <a href={`/api/export/events/${e.id}`} className="press inline-flex h-11 items-center gap-1 rounded-control px-2 text-sm text-ink-2 hover:bg-surface-2" aria-label={t("misc.events.csvAria")}><FileDown className="h-4 w-4" /> CSV</a> : null}
      </div>
    </Card>
  );
}

export default async function AdminEventsPage({ searchParams }: { searchParams: Promise<{ series?: string }> }) {
  const ctx = await requireEventsPermission("events.manage");
  const sp = await searchParams;
  const [{ upcoming, past }, tokens, base] = await Promise.all([listEventsForAdmin(ctx), getCalendarTokens(ctx), getBaseUrl()]);
  const series = Number(sp.series);
  const locale = await getRequestLocale();
  const t = getT(locale);

  return (
    <div>
      <PageHeader title={t("misc.events.manageTitle")} subtitle={ctx.tenant.name} back={{ href: "/events", label: t("money.events.title") }}
        action={<LinkButton href="/admin/events/new" size="sm"><Plus className="h-4 w-4" /> {t("misc.events.new")}</LinkButton>} />

      {series > 0 ? <div className="mb-4"><Alert tone="ok">{t("misc.events.seriesCreated", { n: series })}</Alert></div> : null}

      <SectionTitle>{t("misc.events.upcoming", { n: upcoming.length })}</SectionTitle>
      {upcoming.length ? (
        <div className="stagger space-y-2.5">{upcoming.map((e) => <AdminRow key={e.id} e={e} t={t} locale={locale} />)}</div>
      ) : (
        <EmptyState icon={<CalendarDays className="h-5 w-5" />} title={t("misc.events.noUpcoming")} text={t("misc.events.noUpcomingText")}
          action={<LinkButton href="/admin/events/new" size="sm"><Plus className="h-4 w-4" /> {t("misc.events.create")}</LinkButton>} />
      )}

      {past.length ? (
        <>
          <SectionTitle action={<Link href="/events?tab=past" className="inline-flex min-h-11 items-center text-xs text-ink-3 hover:text-ink">{t("misc.events.all")}</Link>}>{t("misc.events.past")}</SectionTitle>
          <div className="space-y-2.5">{past.map((e) => <AdminRow key={e.id} e={e} t={t} locale={locale} />)}</div>
        </>
      ) : null}

      {ctx.can("tenant.manage") ? (
        <>
          <SectionTitle>{t("misc.events.feed")}</SectionTitle>
          <TenantFeedAdmin locale={locale} tenantFeedUrl={tokens.tenantToken ? base + tenantFeedPath(tokens.tenantToken) : null} />
        </>
      ) : null}
    </div>
  );
}
