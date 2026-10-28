import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, CalendarPlus, Plus, Settings } from "lucide-react";
import { requireModule } from "@/lib/tenant";
import { cn } from "@/lib/utils";
import { Alert, EmptyState, LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { getBaseUrl, getCalendarTokens, listCurrentAnnouncements, listEvents, tenantFeedPath, userFeedPath, type EventListItem } from "@/modules/events/queries";
import { EVENT_KINDS, EVENT_KIND_META, isEventKind, monthKey, monthLabel } from "@/modules/events/types";
import { EventCard } from "@/modules/events/ui/event-card";
import { AnnouncementCard } from "@/modules/events/ui/announcement-card";
import { CalendarSubscribe } from "@/modules/events/ui/calendar-subscribe";
import { KindIcon } from "@/modules/events/ui/bits";

export const metadata: Metadata = { title: "Anlässe" };

type SearchParams = Promise<{ tab?: string; kind?: string; denied?: string }>;

function groupByMonth(events: EventListItem[]) {
  const groups: Array<{ key: string; label: string; items: EventListItem[] }> = [];
  for (const e of events) {
    const key = monthKey(e.startsAt);
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) {
      g = { key, label: monthLabel(e.startsAt), items: [] };
      groups.push(g);
    }
    g.items.push(e);
  }
  return groups;
}

export default async function EventsPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await requireModule("events");
  const sp = await searchParams;
  const tab = sp.tab === "past" ? "past" : "upcoming";
  const kind = isEventKind(sp.kind) ? sp.kind : null;
  const canManage = ctx.can("events.manage");
  const canAnnounce = ctx.can("announcements.manage");

  const [events, announcements, tokens, base] = await Promise.all([
    listEvents(ctx, { tab, kind }),
    tab === "upcoming" ? listCurrentAnnouncements(ctx.tenant.id, 10) : Promise.resolve([]),
    getCalendarTokens(ctx),
    getBaseUrl(),
  ]);
  const groups = groupByMonth(events);
  const href = (t: string, k: string | null) => {
    const q = new URLSearchParams();
    if (t === "past") q.set("tab", "past");
    if (k) q.set("kind", k);
    const s = q.toString();
    return s ? `/events?${s}` : "/events";
  };
  const openCount = events.filter((e) => e.rsvpOpen && !e.myStatus).length;

  return (
    <div>
      <PageHeader
        title="Anlässe"
        subtitle={ctx.tenant.name}
        action={canManage || canAnnounce ? (
          <div className="flex gap-2">
            {canManage ? <LinkButton href="/admin/events/new" size="sm" aria-label="Neuer Anlass"><Plus className="h-4 w-4" /><span className="hidden sm:inline">Neuer Anlass</span></LinkButton> : null}
            <LinkButton href={canManage ? "/admin/events" : "/admin/events/announcements"} variant="secondary" size="sm" aria-label="Verwalten"><Settings className="h-4 w-4" /><span className="hidden sm:inline">Verwalten</span></LinkButton>
          </div>
        ) : null}
      />

      {sp.denied ? <div className="mb-4"><Alert>Dafür fehlt dir die Berechtigung.</Alert></div> : null}

      {announcements.length ? (
        <>
          <SectionTitle action={canAnnounce ? <Link href="/admin/events/announcements/new" className="text-xs text-ink-3 hover:text-ink">+ Neu</Link> : null}>Mitteilungen</SectionTitle>
          <div className="stagger mb-6 space-y-2.5">{announcements.map((a) => <AnnouncementCard key={a.id} a={a} />)}</div>
        </>
      ) : null}

      <div className="mb-3 grid grid-cols-2 gap-1 rounded-control bg-surface-2 p-1" role="group" aria-label="Zeitraum">
        {(["upcoming", "past"] as const).map((t) => (
          <Link key={t} href={href(t, kind)} aria-current={tab === t ? "page" : undefined} scroll={false}
            className={cn("press flex h-11 items-center justify-center rounded-[0.6rem] text-sm font-medium", tab === t ? "bg-surface text-ink shadow-sm" : "text-ink-3")}>
            {t === "upcoming" ? "Kommende" : "Vergangene"}
          </Link>
        ))}
      </div>

      <div className="-mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" aria-label="Nach Art filtern">
        <Link href={href(tab, null)} scroll={false} aria-current={!kind ? "true" : undefined}
          className={cn("press h-9 shrink-0 rounded-full border px-3.5 text-sm font-medium leading-[2.1rem]", !kind ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2")}>Alle</Link>
        {EVENT_KINDS.map((k) => (
          <Link key={k} href={href(tab, k)} scroll={false} aria-current={kind === k ? "true" : undefined}
            className={cn("press inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium", kind === k ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2")}>
            <KindIcon kind={k} className="h-3.5 w-3.5" /> {EVENT_KIND_META[k].plural}
          </Link>
        ))}
      </div>

      {tab === "upcoming" && openCount > 0 ? (
        <p className="animate-fade mb-3 rounded-control bg-accent-soft px-3.5 py-2.5 text-sm text-accent">
          {openCount === 1 ? "Bei einem Anlass fehlt noch deine Antwort." : `Bei ${openCount} Anlässen fehlt noch deine Antwort.`}
        </p>
      ) : null}

      {groups.length ? (
        groups.map((g) => (
          <section key={g.key} className="mb-5">
            <SectionTitle>{g.label}</SectionTitle>
            <div className="stagger space-y-2.5">{g.items.map((e) => <EventCard key={e.id} e={e} />)}</div>
          </section>
        ))
      ) : (
        <EmptyState
          icon={<CalendarDays className="h-5 w-5" />}
          title={tab === "upcoming" ? (kind ? `Keine kommenden ${EVENT_KIND_META[kind].plural}` : "Keine Anlässe geplant") : "Noch keine vergangenen Anlässe"}
          text={tab === "upcoming" ? (canManage ? "Erfasse den ersten Anlass – auch als Serie, z.B. jeden Dienstag Training." : "Sobald der Verein etwas plant, erscheint es hier.") : undefined}
          action={tab === "upcoming" && canManage ? <LinkButton href="/admin/events/new" size="sm"><Plus className="h-4 w-4" /> Anlass erfassen</LinkButton> : null}
        />
      )}

      <details className="group mt-8">
        <summary className="press flex cursor-pointer list-none items-center gap-2 rounded-control px-1 py-2 text-sm font-medium text-ink-2 hover:text-ink [&::-webkit-details-marker]:hidden">
          <CalendarPlus className="h-4 w-4" /> Kalender abonnieren
          <span className="ml-auto text-ink-3 transition-transform group-open:rotate-90">›</span>
        </summary>
        <div className="mt-2">
          <CalendarSubscribe
            tenantName={ctx.tenant.name}
            tenantFeedUrl={tokens.tenantToken ? base + tenantFeedPath(tokens.tenantToken) : null}
            userFeedUrl={tokens.userToken ? base + userFeedPath(tokens.userToken) : null}
          />
        </div>
      </details>
    </div>
  );
}
