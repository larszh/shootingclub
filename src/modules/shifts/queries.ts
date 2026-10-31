import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { zurichParts, zurichToUtc } from "@/lib/time";
import { isValidOn } from "@/modules/qualifications/types";
import { MEMBER_STATUSES } from "@/modules/members/types";
import { ersatzCategoryPrefix, hoursBalance, memberHours, missingQualification, parseStatuses, staffing, defaultShiftHours } from "./logic";

export type WorkSettings = { enabled: boolean; requiredHours: number; ratePerMissingHourCents: number; statuses: string[] };

const ALLOWED_STATUSES = MEMBER_STATUSES.filter((s) => s !== "LEFT");

export async function getWorkSettings(tenantId: string): Promise<WorkSettings> {
  const s = await db.workHoursSettings.findUnique({ where: { tenantId } });
  return {
    enabled: s?.enabled ?? false,
    requiredHours: s?.requiredHours ?? 0,
    ratePerMissingHourCents: s?.ratePerMissingHourCents ?? 0,
    statuses: parseStatuses(s?.appliesToStatuses ?? "ACTIVE", ALLOWED_STATUSES),
  };
}

export function currentSwissYear(now: Date = new Date()) {
  return Number(zurichParts(now).dateStr.slice(0, 4));
}

/** Zeitraum eines Kalenderjahres (Schweizer Zeit) und als @db.Date-Grenzen. */
export function yearRange(year: number) {
  return {
    start: zurichToUtc(`${year}-01-01`, "00:00"),
    end: zurichToUtc(`${year + 1}-01-01`, "00:00"),
    dayStart: new Date(`${year}-01-01T00:00:00.000Z`),
    dayEnd: new Date(`${year}-12-31T00:00:00.000Z`),
  };
}

/** Mitglieder für Auswahllisten (ohne Ausgetretene und gelöschte Konten). */
export async function shiftMemberOptions(tenantId: string) {
  const rows = await db.membership.findMany({
    where: { tenantId, status: { not: "LEFT" }, user: { deletedAt: null } },
    select: { memberNumber: true, user: { select: { id: true, name: true } } },
    orderBy: { user: { name: "asc" } },
  });
  return rows.map((r) => ({ userId: r.user.id, name: r.user.name, memberNumber: r.memberNumber }));
}
export type ShiftMemberOption = Awaited<ReturnType<typeof shiftMemberOptions>>[number];

/** Anlässe zur Auswahl beim Erfassen eines Einsatzes (ab 30 Tagen zurück, nicht abgesagt). */
export async function shiftEventOptions(tenantId: string, includeId?: string | null) {
  const rows = await db.event.findMany({
    where: { tenantId, OR: [{ isCancelled: false, startsAt: { gte: new Date(Date.now() - 30 * 86_400_000) } }, ...(includeId ? [{ id: includeId }] : [])] },
    select: { id: true, title: true, kind: true, startsAt: true, endsAt: true, allDay: true, location: true },
    orderBy: { startsAt: "asc" },
    take: 300,
  });
  return rows.map((e) => ({ ...e, day: zurichParts(e.startsAt).dateStr, time: e.allDay ? null : zurichParts(e.startsAt).timeStr, endTime: e.endsAt && !e.allDay ? zurichParts(e.endsAt).timeStr : null }));
}
export type ShiftEventOption = Awaited<ReturnType<typeof shiftEventOptions>>[number];

/** Welche der Benutzer haben am Tag `day` eine gültige Qualifikation der Art `kind`? */
export async function qualifiedUsers(tenantId: string, kind: string, userIds: string[], days: string[]): Promise<Map<string, Array<{ validFrom: Date | null; validUntil: Date | null }>>> {
  const out = new Map<string, Array<{ validFrom: Date | null; validUntil: Date | null }>>();
  if (!userIds.length || !days.length) return out;
  const rows = await db.qualification.findMany({ where: { tenantId, kind, userId: { in: [...new Set(userIds)] } }, select: { userId: true, validFrom: true, validUntil: true } });
  for (const r of rows) {
    const list = out.get(r.userId) ?? [];
    list.push(r);
    out.set(r.userId, list);
  }
  return out;
}

const shiftSelect = {
  id: true, title: true, eventId: true, startsAt: true, endsAt: true, capacity: true, requiredQualification: true, hoursCredit: true, note: true, createdAt: true,
  event: { select: { id: true, title: true, kind: true, location: true, isCancelled: true } },
  assignments: {
    select: { id: true, userId: true, status: true, hours: true, confirmedById: true, createdAt: true, user: { select: { id: true, name: true, deletedAt: true } } },
    orderBy: { createdAt: "asc" as const },
  },
} as const;

type ShiftRow = Awaited<ReturnType<typeof loadShifts>>[number];

async function loadShifts(where: Prisma.ShiftWhereInput, order: "asc" | "desc", take: number) {
  return db.shift.findMany({ where, select: shiftSelect, orderBy: { startsAt: order }, take });
}

/** Ergänzt Einsätze um Besetzung und Qualifikationswarnung. */
async function decorate(tenantId: string, shifts: ShiftRow[]) {
  const byKind = new Map<string, { users: string[]; days: string[] }>();
  for (const s of shifts) {
    if (!s.requiredQualification) continue;
    const g = byKind.get(s.requiredQualification) ?? { users: [], days: [] };
    g.users.push(...s.assignments.map((a) => a.userId));
    g.days.push(zurichParts(s.startsAt).dateStr);
    byKind.set(s.requiredQualification, g);
  }
  const quals = new Map<string, Map<string, Array<{ validFrom: Date | null; validUntil: Date | null }>>>();
  for (const [kind, g] of byKind) quals.set(kind, await qualifiedUsers(tenantId, kind, g.users, g.days));
  return shifts.map((s) => {
    const day = zurichParts(s.startsAt).dateStr;
    const active = s.assignments.filter((a) => a.status !== "NO_SHOW");
    const qualifiedIds = new Set(
      s.requiredQualification
        ? active.filter((a) => (quals.get(s.requiredQualification!)?.get(a.userId) ?? []).some((q) => isValidOn(q, day))).map((a) => a.userId)
        : [],
    );
    return {
      ...s,
      day,
      staffing: staffing(s.capacity, s.assignments),
      defaultHours: defaultShiftHours(s),
      qualifiedIds,
      qualificationMissing: missingQualification(s.requiredQualification, active.map((a) => qualifiedIds.has(a.userId))),
    };
  });
}
export type ShiftView = Awaited<ReturnType<typeof decorate>>[number];

export type AdminShiftScope = "upcoming" | "past" | "open" | "confirm";

/** Einsätze für die Verwaltung. «confirm» = vorbei mit noch offenen Einteilungen. */
export async function listAdminShifts(tenantId: string, scope: AdminShiftScope, now: Date = new Date()) {
  const dayStart = zurichToUtc(zurichParts(now).dateStr, "00:00");
  if (scope === "past" || scope === "confirm") {
    const rows = await loadShifts(
      { tenantId, startsAt: { lt: now }, ...(scope === "confirm" ? { assignments: { some: { status: "ASSIGNED" } } } : {}) },
      "desc",
      scope === "confirm" ? 200 : 100,
    );
    return decorate(tenantId, rows);
  }
  const rows = await decorate(tenantId, await loadShifts({ tenantId, endsAt: { gte: dayStart } }, "asc", 300));
  return scope === "open" ? rows.filter((s) => s.staffing.understaffed || s.qualificationMissing) : rows;
}

export async function adminShiftCounts(tenantId: string, now: Date = new Date()) {
  const [toConfirm, pendingLogs] = await Promise.all([
    db.shift.count({ where: { tenantId, startsAt: { lt: now }, assignments: { some: { status: "ASSIGNED" } } } }),
    db.workLog.count({ where: { tenantId, approvedAt: null } }),
  ]);
  return { toConfirm, pendingLogs };
}

export async function getShiftView(tenantId: string, id: string) {
  const s = await db.shift.findFirst({ where: { id, tenantId }, select: shiftSelect });
  if (!s) return null;
  return (await decorate(tenantId, [s]))[0]!;
}

// ---------------------------------------------------------------------------
// Mitgliederansicht
// ---------------------------------------------------------------------------

/** Kommende Einsätze (noch nicht begonnen), mit eigener Einteilung. */
export async function listUpcomingShifts(tenantId: string, now: Date = new Date()) {
  const rows = await loadShifts({ tenantId, startsAt: { gt: now }, OR: [{ eventId: null }, { event: { isCancelled: false } }] }, "asc", 200);
  return decorate(tenantId, rows);
}

/** Eigene Einsätze im Jahr (kommende zuerst aufsteigend, dann vergangene). */
export async function listMyShifts(tenantId: string, userId: string, year: number, now: Date = new Date()) {
  const { start, end } = yearRange(year);
  const rows = await db.shift.findMany({
    where: { tenantId, assignments: { some: { userId } }, OR: [{ startsAt: { gte: start, lt: end } }, { startsAt: { gte: now } }] },
    select: shiftSelect,
    orderBy: { startsAt: "asc" },
    take: 300,
  });
  const views = await decorate(tenantId, rows);
  return {
    upcoming: views.filter((s) => s.endsAt >= now),
    past: views.filter((s) => s.endsAt < now).reverse(),
  };
}

export async function listMyWorkLogs(tenantId: string, userId: string, year: number) {
  const { dayStart, dayEnd } = yearRange(year);
  return db.workLog.findMany({
    where: { tenantId, userId, date: { gte: dayStart, lte: dayEnd } },
    select: { id: true, date: true, hours: true, description: true, approvedAt: true, approvedById: true, createdAt: true },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 200,
  });
}

/** Stunden aller Mitglieder im Jahr: Map userId → Saldo-Eingaben. */
async function hoursByUser(tenantId: string, year: number, userId?: string) {
  const { start, end, dayStart, dayEnd } = yearRange(year);
  const [assignments, logs] = await Promise.all([
    db.shiftAssignment.findMany({
      where: { status: "DONE", ...(userId ? { userId } : {}), shift: { tenantId, startsAt: { gte: start, lt: end } } },
      select: { userId: true, status: true, hours: true, shift: { select: { startsAt: true, endsAt: true, hoursCredit: true } } },
    }),
    db.workLog.findMany({ where: { tenantId, ...(userId ? { userId } : {}), date: { gte: dayStart, lte: dayEnd } }, select: { userId: true, hours: true, approvedAt: true } }),
  ]);
  const map = new Map<string, { assignments: typeof assignments; workLogs: typeof logs }>();
  const get = (id: string) => {
    let g = map.get(id);
    if (!g) map.set(id, (g = { assignments: [], workLogs: [] }));
    return g;
  };
  for (const a of assignments) get(a.userId).assignments.push(a);
  for (const l of logs) get(l.userId).workLogs.push(l);
  return new Map([...map].map(([id, g]) => [id, memberHours(g)]));
}

export async function myHoursSummary(tenantId: string, userId: string, year: number) {
  const [settings, membership, hours] = await Promise.all([
    getWorkSettings(tenantId),
    db.membership.findUnique({ where: { userId_tenantId: { userId, tenantId } }, select: { status: true, workHoursExempt: true } }),
    hoursByUser(tenantId, year, userId),
  ]);
  const h = hours.get(userId) ?? { shiftHours: 0, logHours: 0, total: 0, pendingLogHours: 0 };
  const balance = hoursBalance(membership ?? { status: "LEFT", workHoursExempt: true }, h.total, settings);
  return { settings, hours: h, balance, exempt: !!membership?.workHoursExempt };
}

// ---------------------------------------------------------------------------
// Stundenübersicht (Verwaltung)
// ---------------------------------------------------------------------------

/** Pro Mitglied: Stunden im Jahr, Soll, Fehlbetrag, Ersatzabgabe und bestehende Ersatzabgabe-Rechnung. */
export async function hoursOverview(tenantId: string, year: number) {
  const [settings, members, hours, invoices] = await Promise.all([
    getWorkSettings(tenantId),
    db.membership.findMany({
      where: { tenantId, status: { not: "LEFT" }, user: { deletedAt: null } },
      select: { id: true, status: true, workHoursExempt: true, memberNumber: true, user: { select: { id: true, name: true } } },
      orderBy: { user: { name: "asc" } },
    }),
    hoursByUser(tenantId, year),
    db.feeInvoice.findMany({
      where: { tenantId, year, categoryName: { startsWith: ersatzCategoryPrefix(year) }, status: { not: "CANCELLED" } },
      select: { id: true, userId: true, number: true, status: true, amountCents: true },
    }),
  ]);
  const invoiceByUser = new Map(invoices.filter((i) => i.userId).map((i) => [i.userId!, i]));
  const rows = members.map((m) => {
    const h = hours.get(m.user.id) ?? { shiftHours: 0, logHours: 0, total: 0, pendingLogHours: 0 };
    const b = hoursBalance(m, h.total, settings);
    return { membershipId: m.id, userId: m.user.id, name: m.user.name, memberNumber: m.memberNumber, status: m.status, exempt: m.workHoursExempt, ...h, ...b, invoice: invoiceByUser.get(m.user.id) ?? null };
  });
  return { settings, rows };
}
export type HoursOverviewRow = Awaited<ReturnType<typeof hoursOverview>>["rows"][number];

export async function listPendingWorkLogs(tenantId: string) {
  return db.workLog.findMany({
    where: { tenantId, approvedAt: null },
    select: { id: true, date: true, hours: true, description: true, createdAt: true, user: { select: { id: true, name: true } } },
    orderBy: { date: "asc" },
    take: 200,
  });
}

export async function listRecentApprovedWorkLogs(tenantId: string, year: number) {
  const { dayStart, dayEnd } = yearRange(year);
  return db.workLog.findMany({
    where: { tenantId, approvedAt: { not: null }, date: { gte: dayStart, lte: dayEnd } },
    select: { id: true, date: true, hours: true, description: true, approvedAt: true, user: { select: { id: true, name: true } } },
    orderBy: { approvedAt: "desc" },
    take: 50,
  });
}

/** «Jetzt» ausserhalb von Komponenten lesen (Seiten rufen diese Funktion auf). */
export function nowInstant() {
  return new Date();
}
