import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { MODULES } from "@/lib/modules";
import { requireModule, type AppContext, type ActiveTenant } from "@/lib/tenant";
import { userAvatarUrl } from "@/components/avatar";
import { effectiveEnd, isRsvpStatus, rsvpWindow, type EventKind, type RsvpStatus } from "./types";

type TenantCtx = AppContext & { tenant: ActiveTenant };

/** Modul «events» aktiv und Recht vorhanden, sonst Umleitung. */
export async function requireEventsPermission(perm: "events.manage" | "announcements.manage" | "tenant.manage") {
  const ctx = await requireModule("events");
  if (!ctx.can(perm)) redirect("/events?denied=1");
  return ctx;
}

/** Prüft ohne Kontext, ob das Modul für einen Tenant aktiv ist (für Feeds und Exporte). */
export async function isEventsModuleEnabled(tenantId: string) {
  const row = await db.tenantModule.findUnique({ where: { tenantId_moduleKey: { tenantId, moduleKey: "events" } } });
  if (row) return row.enabled;
  return MODULES.find((m) => m.key === "events")?.defaultEnabled ?? false;
}

export async function enabledEventTenantIds(tenantIds: string[]) {
  if (!tenantIds.length) return [];
  const rows = await db.tenantModule.findMany({ where: { tenantId: { in: tenantIds }, moduleKey: "events" } });
  const byTenant = new Map(rows.map((r) => [r.tenantId, r.enabled]));
  const def = MODULES.find((m) => m.key === "events")?.defaultEnabled ?? false;
  return tenantIds.filter((id) => byTenant.get(id) ?? def);
}

/** Öffentliche Basis-URL (APP_URL oder aus dem Request). */
export async function getBaseUrl() {
  const env = process.env.APP_URL?.replace(/\/+$/, "");
  if (env) return env;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto.split(",")[0]!.trim()}://${host.split(",")[0]!.trim()}`;
}

export function nowDate() {
  return new Date();
}

// ---------------------------------------------------------------------------
// Anlässe
// ---------------------------------------------------------------------------

export type RsvpCounts = { yes: number; yesGuests: number; maybe: number; no: number };
const EMPTY_COUNTS: RsvpCounts = { yes: 0, yesGuests: 0, maybe: 0, no: 0 };

export async function rsvpCounts(eventIds: string[]) {
  const map = new Map<string, RsvpCounts>();
  if (!eventIds.length) return map;
  const rows = await db.eventRsvp.groupBy({ by: ["eventId", "status"], where: { eventId: { in: eventIds } }, _count: { _all: true }, _sum: { guests: true } });
  for (const r of rows) {
    const c = map.get(r.eventId) ?? { ...EMPTY_COUNTS };
    if (r.status === "YES") {
      c.yes += r._count._all;
      c.yesGuests += r._sum.guests ?? 0;
    } else if (r.status === "MAYBE") c.maybe += r._count._all;
    else if (r.status === "NO") c.no += r._count._all;
    map.set(r.eventId, c);
  }
  return map;
}

export type EventListItem = {
  id: string;
  title: string;
  kind: string;
  startsAt: Date;
  endsAt: Date | null;
  allDay: boolean;
  location: string | null;
  isCancelled: boolean;
  rsvpEnabled: boolean;
  capacity: number | null;
  rsvpDeadline: Date | null;
  counts: RsvpCounts;
  myStatus: RsvpStatus | null;
  myGuests: number;
  rsvpOpen: boolean;
  isPast: boolean;
};

const listSelect = {
  id: true, title: true, kind: true, startsAt: true, endsAt: true, allDay: true, location: true, isCancelled: true,
  rsvpEnabled: true, capacity: true, rsvpDeadline: true,
} as const;

async function decorate(
  events: Array<{ id: string; title: string; kind: string; startsAt: Date; endsAt: Date | null; allDay: boolean; location: string | null; isCancelled: boolean; rsvpEnabled: boolean; capacity: number | null; rsvpDeadline: Date | null }>,
  userId: string,
  now: Date,
): Promise<EventListItem[]> {
  const ids = events.map((e) => e.id);
  const [counts, mine] = await Promise.all([
    rsvpCounts(ids),
    ids.length ? db.eventRsvp.findMany({ where: { eventId: { in: ids }, userId }, select: { eventId: true, status: true, guests: true } }) : Promise.resolve([]),
  ]);
  const myMap = new Map(mine.map((r) => [r.eventId, r]));
  return events.map((e) => {
    const my = myMap.get(e.id);
    return {
      ...e,
      counts: counts.get(e.id) ?? { ...EMPTY_COUNTS },
      myStatus: my && isRsvpStatus(my.status) ? my.status : null,
      myGuests: my?.guests ?? 0,
      rsvpOpen: rsvpWindow(e, now).open,
      isPast: effectiveEnd(e).getTime() < now.getTime(),
    };
  });
}

/** Kommende (aufsteigend) oder vergangene (absteigend) Anlässe des aktiven Tenants. */
export async function listEvents(ctx: TenantCtx, opts: { tab: "upcoming" | "past"; kind?: EventKind | null; limit?: number }) {
  const now = nowDate();
  // Grobe Vorauswahl: alles, was noch nicht sicher vorbei ist (max. 1 Tag Puffer); Feinfilter über effectiveEnd.
  const dayAgo = new Date(now.getTime() - 86_400_000);
  const kindWhere = opts.kind ? { kind: opts.kind } : {};
  if (opts.tab === "upcoming") {
    const rows = await db.event.findMany({
      where: { tenantId: ctx.tenant.id, ...kindWhere, OR: [{ endsAt: { gte: now } }, { endsAt: null, startsAt: { gte: dayAgo } }] },
      orderBy: { startsAt: "asc" },
      take: opts.limit ?? 200,
      select: listSelect,
    });
    const upcoming = rows.filter((e) => effectiveEnd(e).getTime() >= now.getTime());
    return decorate(upcoming, ctx.user.id, now);
  }
  const rows = await db.event.findMany({
    where: { tenantId: ctx.tenant.id, ...kindWhere, startsAt: { lt: now } },
    orderBy: { startsAt: "desc" },
    take: (opts.limit ?? 60) + 10,
    select: listSelect,
  });
  const past = rows.filter((e) => effectiveEnd(e).getTime() < now.getTime()).slice(0, opts.limit ?? 60);
  return decorate(past, ctx.user.id, now);
}

export type Attendee = { userId: string; name: string; avatarUrl: string | null; status: RsvpStatus; guests: number; note: string | null; updatedAt: Date };

export async function getEventDetail(ctx: TenantCtx, id: string) {
  const event = await db.event.findFirst({
    where: { id, tenantId: ctx.tenant.id },
    include: { createdBy: { select: { id: true, name: true } } },
  });
  if (!event) return null;
  const now = nowDate();
  const isManager = ctx.can("events.manage");
  const rsvps = await db.eventRsvp.findMany({
    where: { eventId: event.id },
    include: { user: { select: { id: true, name: true, avatarPath: true, updatedAt: true } } },
    orderBy: { createdAt: "asc" },
  });
  const all: Attendee[] = rsvps
    .filter((r) => isRsvpStatus(r.status))
    .map((r) => ({ userId: r.userId, name: r.user.name, avatarUrl: userAvatarUrl(r.user), status: r.status as RsvpStatus, guests: r.guests, note: r.note, updatedAt: r.updatedAt }));
  const counts: RsvpCounts = { ...EMPTY_COUNTS };
  for (const a of all) {
    if (a.status === "YES") {
      counts.yes++;
      counts.yesGuests += a.guests;
    } else if (a.status === "MAYBE") counts.maybe++;
    else counts.no++;
  }
  const mine = all.find((a) => a.userId === ctx.user.id) ?? null;
  // Mitglieder sehen nur die Zusagen (ohne Bemerkungen); Verwalter sehen alles.
  const visible = isManager ? all : all.filter((a) => a.status === "YES").map((a) => ({ ...a, note: null }));
  // Mitglieder ohne Antwort (Antworten ehemaliger Mitglieder zählen nicht mit)
  const noAnswer = isManager ? await db.membership.count({ where: { tenantId: ctx.tenant.id, user: { eventRsvps: { none: { eventId: event.id } } } } }) : 0;
  const seatsTaken = counts.yes + counts.yesGuests;
  return {
    event,
    counts,
    mine,
    attendees: visible,
    isManager,
    noAnswer,
    seatsTaken,
    isFull: event.capacity !== null && seatsTaken >= event.capacity,
    window: rsvpWindow(event, now),
    isPast: effectiveEnd(event).getTime() < now.getTime(),
  };
}

export async function getEventForEdit(tenantId: string, id: string) {
  return db.event.findFirst({ where: { id, tenantId } });
}

/** Kompakte Liste für die Verwaltung. */
export async function listEventsForAdmin(ctx: TenantCtx) {
  const [upcoming, past] = await Promise.all([listEvents(ctx, { tab: "upcoming", limit: 100 }), listEvents(ctx, { tab: "past", limit: 20 })]);
  return { upcoming, past };
}

// ---------------------------------------------------------------------------
// Mitteilungen
// ---------------------------------------------------------------------------

export type AnnouncementView = { id: string; title: string; body: string; pinned: boolean; expiresAt: Date | null; createdAt: Date; updatedAt: Date; authorName: string | null; authorAvatarUrl: string | null; isExpired: boolean };

function toAnnouncementView(
  a: { id: string; title: string; body: string; pinned: boolean; expiresAt: Date | null; createdAt: Date; updatedAt: Date; author: { id: string; name: string; avatarPath: string | null; updatedAt: Date } | null },
  now: Date,
): AnnouncementView {
  return {
    id: a.id, title: a.title, body: a.body, pinned: a.pinned, expiresAt: a.expiresAt, createdAt: a.createdAt, updatedAt: a.updatedAt,
    authorName: a.author?.name ?? null,
    authorAvatarUrl: a.author ? userAvatarUrl(a.author) : null,
    isExpired: !!a.expiresAt && a.expiresAt.getTime() < now.getTime(),
  };
}

const authorSelect = { select: { id: true, name: true, avatarPath: true, updatedAt: true } } as const;

/** Aktuelle Mitteilungen: angeheftete zuerst, dann neueste. */
export async function listCurrentAnnouncements(tenantId: string, limit = 10) {
  const now = nowDate();
  const rows = await db.announcement.findMany({
    where: { tenantId, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take: limit,
    include: { author: authorSelect },
  });
  return rows.map((a) => toAnnouncementView(a, now));
}

export async function listAllAnnouncements(tenantId: string) {
  const now = nowDate();
  const rows = await db.announcement.findMany({ where: { tenantId }, orderBy: [{ pinned: "desc" }, { createdAt: "desc" }], take: 100, include: { author: authorSelect } });
  return rows.map((a) => toAnnouncementView(a, now));
}

export async function getAnnouncement(tenantId: string, id: string) {
  return db.announcement.findFirst({ where: { id, tenantId } });
}

// ---------------------------------------------------------------------------
// Kalender-Feeds
// ---------------------------------------------------------------------------

export async function getCalendarTokens(ctx: TenantCtx) {
  const [tenant, user] = await Promise.all([
    db.tenant.findUnique({ where: { id: ctx.tenant.id }, select: { calendarToken: true } }),
    db.user.findUnique({ where: { id: ctx.user.id }, select: { calendarToken: true } }),
  ]);
  return { tenantToken: tenant?.calendarToken ?? null, userToken: user?.calendarToken ?? null };
}

export function tenantFeedPath(token: string) {
  return `/api/ical/tenant/${token}.ics`;
}

export function userFeedPath(token: string) {
  return `/api/ical/me/${token}.ics`;
}
