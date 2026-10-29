import "server-only";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { buildIcs, bookingUid, eventUid, type IcsEvent } from "./ics";
import { personsSuffix } from "@/modules/bookings/pricing";
import { enabledEventTenantIds, isEventsModuleEnabled } from "./queries";
import { kindMeta } from "./types";

const TOKEN_RE = /^[A-Za-z0-9_-]{32,64}$/;

/** «abc.ics» → «abc»; null bei ungültigem Format. Next.js liefert den Parameter bereits dekodiert. */
export function parseFeedToken(raw: string) {
  const t = raw.replace(/\.ics$/i, "");
  return TOKEN_RE.test(t) ? t : null;
}

function feedWindowStart() {
  return new Date(Date.now() - 180 * 86_400_000);
}

type EventRow = {
  id: string; title: string; description: string | null; kind: string; startsAt: Date; endsAt: Date | null; allDay: boolean;
  location: string | null; isCancelled: boolean; createdAt: Date; updatedAt: Date;
};

function toIcsEvent(e: EventRow, baseUrl: string, opts?: { tentative?: boolean; prefix?: string }): IcsEvent {
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
    stamp: e.updatedAt,
    created: e.createdAt,
  };
}

const eventSelect = { id: true, title: true, description: true, kind: true, startsAt: true, endsAt: true, allDay: true, location: true, isCancelled: true, createdAt: true, updatedAt: true } as const;

/** Vereins-Feed: alle Anlässe (abgesagte mit STATUS:CANCELLED). null = unbekannter Token. */
export async function buildTenantFeed(token: string, baseUrl: string) {
  const tenant = await db.tenant.findUnique({ where: { calendarToken: token }, select: { id: true, name: true, slug: true } });
  if (!tenant) return null;
  if (!(await isEventsModuleEnabled(tenant.id))) return null;
  const events = await db.event.findMany({
    where: { tenantId: tenant.id, startsAt: { gte: feedWindowStart() } },
    orderBy: { startsAt: "asc" },
    take: 1000,
    select: eventSelect,
  });
  const ics = buildIcs({ name: `${tenant.name} – Anlässe`, description: `Vereinskalender ${tenant.name} (Standchef)`, events: events.map((e) => toIcsEvent(e, baseUrl)) });
  return { ics, filename: `${tenant.slug}-anlaesse.ics` };
}

/** Persönlicher Feed: Zusagen/Vielleicht aus allen Vereinen + eigene Reservationen. */
export async function buildUserFeed(token: string, baseUrl: string) {
  const user = await db.user.findUnique({ where: { calendarToken: token }, select: { id: true, name: true, memberships: { select: { tenantId: true, tenant: { select: { name: true } } } } } });
  if (!user) return null;
  const tenantIds = await enabledEventTenantIds(user.memberships.map((m) => m.tenantId));
  const multi = user.memberships.length > 1;
  const tenantName = new Map(user.memberships.map((m) => [m.tenantId, m.tenant.name]));
  const since = feedWindowStart();

  const [rsvps, bookings] = await Promise.all([
    tenantIds.length
      ? db.eventRsvp.findMany({
          where: { userId: user.id, status: { in: ["YES", "MAYBE"] }, event: { tenantId: { in: tenantIds }, startsAt: { gte: since } } },
          select: { status: true, event: { select: { ...eventSelect, tenantId: true } } },
          take: 1000,
        })
      : Promise.resolve([]),
    db.booking.findMany({
      where: { userId: user.id, status: { in: ["CONFIRMED", "PENDING"] }, startsAt: { gte: since } },
      select: { id: true, startsAt: true, endsAt: true, status: true, note: true, persons: true, isFlatRate: true, createdAt: true, updatedAt: true, tenantId: true, resource: { select: { name: true } }, tenant: { select: { name: true } } },
      orderBy: { startsAt: "asc" },
      take: 1000,
    }),
  ]);

  const events: IcsEvent[] = rsvps
    .sort((a, b) => a.event.startsAt.getTime() - b.event.startsAt.getTime())
    .map((r) => toIcsEvent(r.event, baseUrl, { tentative: r.status === "MAYBE", prefix: multi ? tenantName.get(r.event.tenantId) : undefined }));
  for (const b of bookings) {
    events.push({
      uid: bookingUid(b.id),
      summary: `Reservation: ${b.resource.name}${b.status === "PENDING" ? " (unbestätigt)" : ""}`,
      description: [b.tenant.name, personsSuffix(b), b.note].filter(Boolean).join("\n"),
      location: `${b.resource.name}, ${b.tenant.name}`,
      url: `${baseUrl}/bookings/${b.id}`,
      startsAt: b.startsAt,
      endsAt: b.endsAt,
      status: b.status === "PENDING" ? "TENTATIVE" : "CONFIRMED",
      categories: ["Reservation"],
      stamp: b.updatedAt,
      created: b.createdAt,
    });
  }
  const ics = buildIcs({ name: "Meine Termine (Standchef)", description: `Anlässe und Reservationen von ${user.name}`, events });
  return { ics, filename: "meine-termine.ics" };
}

/** Einzelner Anlass als .ics für eingeloggte Mitglieder. */
export async function buildSingleEventIcs(user: { id: string; isSuperAdmin: boolean; memberships: Array<{ tenantId: string }> }, eventId: string, baseUrl: string) {
  const event = await db.event.findUnique({ where: { id: eventId }, select: { ...eventSelect, tenantId: true, tenant: { select: { name: true } } } });
  if (!event) return null;
  const member = user.memberships.some((m) => m.tenantId === event.tenantId);
  if (!member && !user.isSuperAdmin) return null;
  if (!(await isEventsModuleEnabled(event.tenantId))) return null;
  const ics = buildIcs({ name: event.tenant.name, events: [toIcsEvent(event, baseUrl)] });
  const slug = event.title.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "anlass";
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
