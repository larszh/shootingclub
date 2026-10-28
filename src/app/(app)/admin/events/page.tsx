import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, FileDown, Plus, Users } from "lucide-react";
import { Alert, Card, EmptyState, LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { cn } from "@/lib/utils";
import { getBaseUrl, getCalendarTokens, listEventsForAdmin, requireEventsPermission, tenantFeedPath, type EventListItem } from "@/modules/events/queries";
import { whenLabel } from "@/modules/events/types";
import { DateBadge, KindChip } from "@/modules/events/ui/bits";
import { EventRowActions } from "@/modules/events/ui/manage-actions";
import { TenantFeedAdmin } from "@/modules/events/ui/calendar-subscribe";

export const metadata: Metadata = { title: "Anlässe verwalten" };

function AdminRow({ e }: { e: EventListItem }) {
  const seats = e.counts.yes + e.counts.yesGuests;
  return (
    <Card className={cn("p-3", e.isCancelled && "opacity-75")}>
      <Link href={`/events/${e.id}`} className="press flex gap-3">
        <DateBadge date={e.startsAt} muted={e.isPast || e.isCancelled} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <KindChip kind={e.kind} />
            {e.isCancelled ? <span className="text-xs font-semibold text-accent">Abgesagt</span> : null}
          </div>
          <p className={cn("mt-0.5 font-medium leading-snug", e.isCancelled && "line-through")}>{e.title}</p>
          <p className="text-xs text-ink-3">{whenLabel(e)}{e.location ? ` · ${e.location}` : ""}</p>
          {e.rsvpEnabled ? (
            <p className="mt-1 flex items-center gap-1 text-xs text-ink-3"><Users className="h-3.5 w-3.5" />{seats}{e.capacity ? `/${e.capacity}` : ""} dabei · {e.counts.maybe} vielleicht · {e.counts.no} abgemeldet</p>
          ) : null}
        </div>
      </Link>
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-line pt-2">
        <EventRowActions eventId={e.id} isCancelled={e.isCancelled} />
        {e.rsvpEnabled ? <a href={`/api/export/events/${e.id}`} className="press inline-flex h-9 items-center gap-1 rounded-control px-2 text-sm text-ink-2 hover:bg-surface-2" aria-label="Anmeldeliste als CSV"><FileDown className="h-4 w-4" /> CSV</a> : null}
      </div>
    </Card>
  );
}

export default async function AdminEventsPage({ searchParams }: { searchParams: Promise<{ series?: string }> }) {
  const ctx = await requireEventsPermission("events.manage");
  const sp = await searchParams;
  const [{ upcoming, past }, tokens, base] = await Promise.all([listEventsForAdmin(ctx), getCalendarTokens(ctx), getBaseUrl()]);
  const series = Number(sp.series);

  return (
    <div>
      <PageHeader title="Anlässe verwalten" subtitle={ctx.tenant.name} back={{ href: "/events", label: "Anlässe" }}
        action={<LinkButton href="/admin/events/new" size="sm"><Plus className="h-4 w-4" /> Neu</LinkButton>} />

      {series > 0 ? <div className="mb-4"><Alert tone="ok">{series} Anlässe erstellt.</Alert></div> : null}

      <SectionTitle>Kommende ({upcoming.length})</SectionTitle>
      {upcoming.length ? (
        <div className="stagger space-y-2.5">{upcoming.map((e) => <AdminRow key={e.id} e={e} />)}</div>
      ) : (
        <EmptyState icon={<CalendarDays className="h-5 w-5" />} title="Keine kommenden Anlässe" text="Erfasse einen Anlass oder eine ganze Serie, z.B. jeden Dienstag Training bis zu den Sommerferien."
          action={<LinkButton href="/admin/events/new" size="sm"><Plus className="h-4 w-4" /> Anlass erfassen</LinkButton>} />
      )}

      {past.length ? (
        <>
          <SectionTitle action={<Link href="/events?tab=past" className="text-xs text-ink-3 hover:text-ink">Alle</Link>}>Vergangene</SectionTitle>
          <div className="space-y-2.5">{past.map((e) => <AdminRow key={e.id} e={e} />)}</div>
        </>
      ) : null}

      {ctx.can("tenant.manage") ? (
        <>
          <SectionTitle>Kalender-Abo</SectionTitle>
          <TenantFeedAdmin tenantFeedUrl={tokens.tenantToken ? base + tenantFeedPath(tokens.tenantToken) : null} />
        </>
      ) : null}
    </div>
  );
}
