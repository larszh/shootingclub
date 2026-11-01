import "server-only";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { MODULES, type ModuleKey } from "@/lib/modules";
import { eventUid, bookingUid } from "./ics";
import { buildFeedIcs, keepInFeed, parseKindFilter, type FeedEvent } from "@/modules/embed/icalendar";
import { personsSuffix } from "@/modules/bookings/pricing";
import { shiftUid } from "@/modules/shifts/service";
import { enabledEventTenantIds, isEventsModuleEnabled } from "./queries";
import { EVENT_KINDS, kindMeta } from "./types";

const TOKEN_RE = /^[A-Za-z0-9_-]{32,64}$/;

/** «abc.ics» → «abc»; null bei ungültigem Format. Next.js liefert den Parameter bereits dekodiert. */
export function parseFeedToken(raw: string) {
  const t = raw.replace(/\.ics$/i, "");
  return TOKEN_RE.test(t) ? t : null;
}

/** «?kind=TRAINING,COMPETITION» für den Vereins-Feed; unbekannte Werte werden ignoriert. */
export function parseFeedKinds(raw: string | null | undefined) {
  return parseKindFilter(raw, EVENT_KINDS);
}

const DAY = 86_400_000;

function feedWindowStart(now: Date) {
  return new Date(now.getTime() - 180 * DAY);
}

/** Absagen bleiben 30 Tage im Feed (STATUS:CANCELLED), damit Kalender-Apps sie entfernen bzw. markieren. */
function cancelledSince(now: Date) {
  return new Date(now.getTime() - 30 * DAY);
}

type EventRow = {
  id: string; title: string; description: string | null; kind: string; startsAt: Date; endsAt: Date | null; allDay: boolean;
  location: string | null; isCancelled: boolean; createdAt: Date; updatedAt: Date;
};

function toFeedEvent(e: EventRow, baseUrl: string, opts?: { tentative?: boolean; prefix?: string }): FeedEvent {
  return {
    uid: eventUid(e.id),
    summary: (e.isCancelled ? "Abgesagt: " : "") + (opts?.prefix ? `${opts.prefix} · ` : "") + e.title,
    description: e.description,
    location: e.location,
    url: `${baseUrl}/events/${e.id}`,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    allDay: e.allDay,
    status: e.isCancelled ? "CANCELLED" : opts?.tentative ? "TENTATIVE" : "CONFIRMED",
    categories: [kindMeta(e.kind).label],
    updatedAt: e.updatedAt,
    created: e.createdAt,
  };
}

const eventSelect = { id: true, title: true, description: true, kind: true, startsAt: true, endsAt: true, allDay: true, location: true, isCancelled: true, createdAt: true, updatedAt: true } as const;

/** Ist ein Modul für die Tenants aktiv? (Standard aus der Modul-Registry, sonst TenantModule) */
async function enabledTenantIds(tenantIds: string[], key: ModuleKey) {
  if (!tenantIds.length) return [];
  const rows = await db.tenantModule.findMany({ where: { tenantId: { in: tenantIds }, moduleKey: key }, select: { tenantId: true, enabled: true } });
  const byTenant = new Map(rows.map((r) => [r.tenantId, r.enabled]));
  const def = MODULES.find((m) => m.key === key)?.defaultEnabled ?? false;
  return tenantIds.filter((id) => byTenant.get(id) ?? def);
}

/** Vereins-Feed: alle Anlässe (Absagen 30 Tage mit STATUS:CANCELLED), optional nach Art gefiltert. null = unbekannter Token. */
export async function buildTenantFeed(token: string, baseUrl: string, opts?: { kinds?: string[] }) {
  // Gelöschte Vereine (in der Löschfrist) liefern keinen Feed mehr (404).
  const tenant = await db.tenant.findFirst({ where: { calendarToken: token, deletedAt: null }, select: { id: true, name: true, slug: true } });
  if (!tenant) return null;
  if (!(await isEventsModuleEnabled(tenant.id))) return null;
  const now = new Date();
  const kinds = opts?.kinds ?? [];
  const events = await db.event.findMany({
    where: {
      tenantId: tenant.id,
      startsAt: { gte: feedWindowStart(now) },
      ...(kinds.length ? { kind: { in: kinds } } : {}),
      OR: [{ isCancelled: false }, { updatedAt: { gte: cancelledSince(now) } }],
    },
    orderBy: { startsAt: "asc" },
    take: 1000,
    select: eventSelect,
  });
  const kindLabel = kinds.length ? ` (${kinds.map((k) => kindMeta(k).plural).join(", ")})` : "";
  const ics = buildFeedIcs({
    name: `${tenant.name} – Anlässe${kindLabel}`,
    description: `Vereinskalender ${tenant.name} (Standchef)`,
    events: events.filter((e) => keepInFeed(e, now)).map((e) => toFeedEvent(e, baseUrl)),
  });
  return { ics, filename: `${tenant.slug}-anlaesse.ics` };
}

/**
 * Persönlicher Feed: Zusagen/Vielleicht aus allen Vereinen, eigene Reservationen,
 * Helfereinsätze (Modul «shifts») und Kurstage (Modul «courses», als Teilnehmer/in oder Leitung).
 */
export async function buildUserFeed(token: string, baseUrl: string) {
  const user = await db.user.findUnique({
    where: { calendarToken: token },
    select: { id: true, name: true, deletedAt: true, memberships: { where: { status: { not: "LEFT" }, tenant: { deletedAt: null } }, select: { tenantId: true, tenant: { select: { name: true } } } } },
  });
  if (!user || user.deletedAt) return null;
  const allTenantIds = user.memberships.map((m) => m.tenantId);
  const [eventTenantIds, shiftTenantIds, courseTenantIds] = await Promise.all([
    enabledEventTenantIds(allTenantIds),
    enabledTenantIds(allTenantIds, "shifts"),
    enabledTenantIds(allTenantIds, "courses"),
  ]);
  const multi = user.memberships.length > 1;
  const tenantName = new Map(user.memberships.map((m) => [m.tenantId, m.tenant.name]));
  const prefixOf = (tenantId: string) => (multi ? tenantName.get(tenantId) : undefined);
  const now = new Date();
  const since = feedWindowStart(now);
  const cancelledFrom = cancelledSince(now);

  const [rsvps, bookings, shifts, sessions] = await Promise.all([
    eventTenantIds.length
      ? db.eventRsvp.findMany({
          where: {
            userId: user.id,
            status: { in: ["YES", "MAYBE"] },
            event: { tenantId: { in: eventTenantIds }, startsAt: { gte: since }, OR: [{ isCancelled: false }, { updatedAt: { gte: cancelledFrom } }] },
          },
          select: { status: true, event: { select: { ...eventSelect, tenantId: true } } },
          take: 1000,
        })
      : Promise.resolve([]),
    db.booking.findMany({
      where: {
        userId: user.id,
        startsAt: { gte: since },
        tenant: { deletedAt: null },
        // Abgesagte/abgelehnte bleiben 30 Tage (STATUS:CANCELLED), damit eine früher «unbestätigt» gezeigte Reservation verschwindet.
        OR: [
          { status: { in: ["CONFIRMED", "PENDING"] } },
          { status: { in: ["CANCELLED", "REJECTED"] }, cancelledAt: { gte: cancelledFrom } },
          { status: { in: ["CANCELLED", "REJECTED"] }, cancelledAt: null, updatedAt: { gte: cancelledFrom } },
        ],
      },
      select: { id: true, startsAt: true, endsAt: true, status: true, cancelledAt: true, note: true, persons: true, isFlatRate: true, createdAt: true, updatedAt: true, tenantId: true, resource: { select: { name: true } }, tenant: { select: { name: true } } },
      orderBy: { startsAt: "asc" },
      take: 1000,
    }),
    shiftTenantIds.length
      ? db.shiftAssignment.findMany({
          where: { userId: user.id, status: { in: ["ASSIGNED", "DONE"] }, shift: { tenantId: { in: shiftTenantIds }, startsAt: { gte: since } } },
          select: {
            createdAt: true,
            shift: {
              select: {
                id: true, tenantId: true, title: true, startsAt: true, endsAt: true, note: true, createdAt: true,
                event: { select: { title: true, location: true, isCancelled: true, updatedAt: true } },
              },
            },
          },
          take: 1000,
        })
      : Promise.resolve([]),
    courseTenantIds.length
      ? db.courseSession.findMany({
          where: {
            startsAt: { gte: since },
            course: {
              tenantId: { in: courseTenantIds },
              OR: [{ leaderUserId: user.id }, { participants: { some: { userId: user.id, status: { not: "DROPPED" } } } }],
            },
          },
          select: {
            id: true, title: true, startsAt: true, endsAt: true, eventId: true,
            event: { select: { location: true, isCancelled: true, updatedAt: true } },
            course: { select: { id: true, name: true, tenantId: true, leaderUserId: true, createdAt: true, updatedAt: true } },
          },
          orderBy: { startsAt: "asc" },
          take: 1000,
        })
      : Promise.resolve([]),
  ]);

  const events: FeedEvent[] = rsvps
    .filter((r) => keepInFeed(r.event, now))
    .map((r) => toFeedEvent(r.event, baseUrl, { tentative: r.status === "MAYBE", prefix: prefixOf(r.event.tenantId) }));

  for (const b of bookings) {
    const cancelled = b.status === "CANCELLED" || b.status === "REJECTED";
    events.push({
      uid: bookingUid(b.id),
      summary: `${b.status === "REJECTED" ? "Abgelehnt: " : cancelled ? "Abgesagt: " : ""}Reservation: ${b.resource.name}${b.status === "PENDING" ? " (unbestätigt)" : ""}`,
      description: [b.tenant.name, personsSuffix(b), b.note].filter(Boolean).join("\n"),
      location: `${b.resource.name}, ${b.tenant.name}`,
      url: `${baseUrl}/bookings/${b.id}`,
      startsAt: b.startsAt,
      endsAt: b.endsAt,
      status: cancelled ? "CANCELLED" : b.status === "PENDING" ? "TENTATIVE" : "CONFIRMED",
      categories: ["Reservation"],
      updatedAt: b.cancelledAt && b.cancelledAt > b.updatedAt ? b.cancelledAt : b.updatedAt,
      created: b.createdAt,
    });
  }

  for (const a of shifts) {
    const s = a.shift;
    // Shift hat kein updatedAt: jüngste bekannte Änderung (Einteilung, Schicht, Anlass)
    const stamps = [s.createdAt, a.createdAt, s.event?.updatedAt].filter((d): d is Date => !!d);
    const updatedAt = new Date(Math.max(...stamps.map((d) => d.getTime())));
    const cancelled = !!s.event?.isCancelled;
    if (cancelled && !keepInFeed({ isCancelled: true, updatedAt }, now)) continue;
    const prefix = prefixOf(s.tenantId);
    events.push({
      uid: shiftUid(s.id),
      summary: `${cancelled ? "Abgesagt: " : ""}${prefix ? `${prefix} · ` : ""}Helfereinsatz: ${s.title}${s.event ? ` (${s.event.title})` : ""}`,
      description: s.note,
      location: s.event?.location ?? null,
      url: `${baseUrl}/shifts`,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      status: cancelled ? "CANCELLED" : "CONFIRMED",
      categories: ["Helfereinsatz"],
      updatedAt,
      created: s.createdAt,
    });
  }

  // Kurstage, die schon als Anlass mit Zusage im Feed sind, nicht doppelt aufführen
  const rsvpEventIds = new Set(rsvps.map((r) => r.event.id));
  for (const cs of sessions) {
    if (cs.eventId && rsvpEventIds.has(cs.eventId)) continue;
    const updatedAt = cs.event?.updatedAt && cs.event.updatedAt > cs.course.updatedAt ? cs.event.updatedAt : cs.course.updatedAt;
    const cancelled = !!cs.event?.isCancelled;
    if (cancelled && !keepInFeed({ isCancelled: true, updatedAt }, now)) continue;
    const prefix = prefixOf(cs.course.tenantId);
    const role = cs.course.leaderUserId === user.id ? " (Leitung)" : "";
    events.push({
      uid: `course-session-${cs.id}@standchef.ch`,
      summary: `${cancelled ? "Abgesagt: " : ""}${prefix ? `${prefix} · ` : ""}${cs.course.name}: ${cs.title}${role}`,
      location: cs.event?.location ?? null,
      url: `${baseUrl}/courses/${cs.course.id}`,
      startsAt: cs.startsAt,
      endsAt: cs.endsAt,
      status: cancelled ? "CANCELLED" : "CONFIRMED",
      categories: ["Kurs"],
      updatedAt,
      created: cs.course.createdAt,
    });
  }

  events.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const ics = buildFeedIcs({ name: "Meine Termine (Standchef)", description: `Anlässe, Reservationen, Einsätze und Kurse von ${user.name}`, events });
  return { ics, filename: "meine-termine.ics" };
}

/** Einzelner Anlass als .ics für eingeloggte Mitglieder. */
export async function buildSingleEventIcs(user: { id: string; isSuperAdmin: boolean; memberships: Array<{ tenantId: string }> }, eventId: string, baseUrl: string) {
  const event = await db.event.findUnique({ where: { id: eventId }, select: { ...eventSelect, tenantId: true, tenant: { select: { name: true } } } });
  if (!event) return null;
  const member = user.memberships.some((m) => m.tenantId === event.tenantId);
  if (!member && !user.isSuperAdmin) return null;
  if (!(await isEventsModuleEnabled(event.tenantId))) return null;
  const ics = buildFeedIcs({ name: event.tenant.name, events: [toFeedEvent(event, baseUrl)] });
  const slug = event.title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "anlass";
  return { ics, filename: `${slug}.ics` };
}

// ---------------------------------------------------------------------------
// Anmeldeliste (CSV)
// ---------------------------------------------------------------------------

function csvCell(v: string | number | null | undefined) {
  if (v === null || v === undefined) return "";
  let s = typeof v === "number" ? String(v) : v;
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`; // Formel-Injection verhindern
  if (/[";\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(rows: Array<Array<string | number | null | undefined>>) {
  return "﻿" + rows.map((r) => r.map(csvCell).join(";")).join("\r\n") + "\r\n";
}

const STATUS_ORDER: Record<string, number> = { YES: 0, MAYBE: 1, NO: 2, NONE: 3 };
const STATUS_LABEL: Record<string, string> = { YES: "Zusage", MAYBE: "Vielleicht", NO: "Absage", NONE: "Keine Antwort" };

/** CSV mit allen Mitgliedern und ihrem Status. null = nicht gefunden / keine Berechtigung. */
export async function buildAttendanceCsv(user: { id: string; isSuperAdmin: boolean; memberships: Array<{ tenantId: string; role: string }> }, eventId: string) {
  const event = await db.event.findUnique({ where: { id: eventId }, select: { id: true, tenantId: true, title: true, startsAt: true } });
  if (!event) return null;
  const membership = user.memberships.find((m) => m.tenantId === event.tenantId);
  if (!can({ isSuperAdmin: user.isSuperAdmin, role: membership?.role ?? null }, "events.manage")) return null;
  if (!(await isEventsModuleEnabled(event.tenantId))) return null;

  const [members, rsvps] = await Promise.all([
    db.membership.findMany({ where: { tenantId: event.tenantId, status: { not: "LEFT" } }, select: { userId: true, memberNumber: true, user: { select: { name: true, email: true } } } }),
    db.eventRsvp.findMany({ where: { eventId: event.id }, select: { userId: true, status: true, guests: true, note: true, updatedAt: true, user: { select: { name: true, email: true } } } }),
  ]);
  const byUser = new Map(rsvps.map((r) => [r.userId, r]));
  type Row = { name: string; email: string; memberNumber: string | null; status: string; guests: number; note: string | null; at: Date | null };
  const rows: Row[] = members.map((m) => {
    const r = byUser.get(m.userId);
    return { name: m.user.name, email: m.user.email, memberNumber: m.memberNumber, status: r?.status ?? "NONE", guests: r?.guests ?? 0, note: r?.note ?? null, at: r?.updatedAt ?? null };
  });
  // Antworten ehemaliger Mitglieder trotzdem aufführen
  const memberIds = new Set(members.map((m) => m.userId));
  for (const r of rsvps) if (!memberIds.has(r.userId)) rows.push({ name: r.user.name, email: r.user.email, memberNumber: null, status: r.status, guests: r.guests, note: r.note, at: r.updatedAt });
  rows.sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) || a.name.localeCompare(b.name, "de-CH"));

  const dt = new Intl.DateTimeFormat("de-CH", { timeZone: "Europe/Zurich", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const yes = rows.filter((r) => r.status === "YES");
  const header = ["Name", "E-Mail", "Mitgliedernummer", "Status", "Begleitpersonen", "Bemerkung", "Geantwortet am", "Anwesend"];
  const body = rows.map((r) => [r.name, r.email, r.memberNumber, STATUS_LABEL[r.status] ?? r.status, r.status === "NONE" ? null : r.guests, r.note, r.at ? dt.format(r.at) : null, ""]);
  const csv = toCsv([
    [event.title, dt.format(event.startsAt)],
    [`Zusagen: ${yes.length}`, `Personen total: ${yes.reduce((s, r) => s + 1 + r.guests, 0)}`],
    [],
    header,
    ...body,
  ]);
  const date = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Zurich" }).format(event.startsAt);
  const slug = event.title.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "anlass";
  return { csv, filename: `anmeldungen-${slug}-${date}.csv` };
}
