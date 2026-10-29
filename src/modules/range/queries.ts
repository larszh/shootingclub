import "server-only";
import { db } from "@/lib/db";
import { todayZurich } from "@/lib/time";
import { userAvatarUrl } from "@/components/avatar";
import {
  daysForQuota, dayKeyToDbDate, dbDateKey, halfDayFlagsFromVisits, halfDaysByMonth, mergeHalfDaysByDate, quotaStatus, zurichDayKey,
  type HalfDayFlags, type QuotaDay,
} from "./logic";

// --- Vertrag für andere Module ---------------------------------------------------------

/**
 * Verschiedene Schweizer Kalendertage, an denen die Person im Standbuch eingecheckt war
 * (RangeVisit), zwischen den Kalendertagen von `from` und `to` (beide inklusive).
 * Rückgabe als UTC-Mitternacht des Schweizer Tages (wie @db.Date), aufsteigend.
 */
export async function listShootingDaysFromVisits(tenantId: string, userId: string, from: Date, to: Date): Promise<Date[]> {
  const fromKey = zurichDayKey(from);
  const toKey = zurichDayKey(to);
  if (fromKey > toKey) return [];
  const visits = await db.rangeVisit.findMany({
    where: {
      tenantId,
      userId,
      checkedInAt: { gte: new Date(from.getTime() - 36 * 3600_000), lte: new Date(to.getTime() + 36 * 3600_000) },
    },
    select: { checkedInAt: true },
    orderBy: { checkedInAt: "asc" },
  });
  const keys = new Set<string>();
  for (const v of visits) {
    const k = zurichDayKey(v.checkedInAt);
    if (k >= fromKey && k <= toKey) keys.add(k);
  }
  return [...keys].sort().map(dayKeyToDbDate);
}

// --- Auswahllisten -----------------------------------------------------------------------

export async function listRangeResources(tenantId: string) {
  return db.resource.findMany({ where: { tenantId, isActive: true }, select: { id: true, name: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
}

export async function listAllResources(tenantId: string) {
  return db.resource.findMany({ where: { tenantId }, select: { id: true, name: true, isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
}

export type MemberOption = { userId: string; name: string; memberNumber: string | null; avatarUrl: string | null; birthKey: string | null };

/** Aktive Mitglieder (ohne ausgetretene und gelöschte Konten) für Check-in und Gastgeber. */
export async function listMemberOptions(tenantId: string): Promise<MemberOption[]> {
  const rows = await db.membership.findMany({
    where: { tenantId, status: { not: "LEFT" }, user: { deletedAt: null } },
    select: { memberNumber: true, user: { select: { id: true, name: true, avatarPath: true, updatedAt: true, birthDate: true } } },
    orderBy: { user: { name: "asc" } },
  });
  return rows.map((r) => ({
    userId: r.user.id,
    name: r.user.name,
    memberNumber: r.memberNumber,
    avatarUrl: userAvatarUrl(r.user),
    birthKey: r.user.birthDate ? dbDateKey(r.user.birthDate) : null,
  }));
}

// --- Schiesstage ---------------------------------------------------------------------------

/** Nicht abgeschlossene Standbücher (auch von Vortagen, damit sie nicht vergessen gehen). */
export async function listOpenDays(tenantId: string) {
  return db.rangeDay.findMany({
    where: { tenantId, closedAt: null },
    include: { resource: { select: { name: true } }, _count: { select: { visits: true } } },
    orderBy: [{ date: "desc" }, { openedAt: "asc" }],
  });
}

export type OpenDay = Awaited<ReturnType<typeof listOpenDays>>[number];

/** Heutiges Datum als @db.Date-Wert. */
export function todayDbDate() {
  return dayKeyToDbDate(todayZurich());
}

export async function getDayBoard(tenantId: string, dayId: string) {
  const day = await db.rangeDay.findFirst({
    where: { id: dayId, tenantId },
    include: {
      resource: { select: { name: true } },
      visits: {
        include: { user: { select: { id: true, name: true, avatarPath: true, updatedAt: true, birthDate: true } } },
        orderBy: { checkedInAt: "asc" },
      },
    },
  });
  if (!day) return null;
  const weaponIds = [...new Set(day.visits.map((v) => v.clubWeaponId).filter((x): x is string => !!x))];
  const hostIds = [...new Set(day.visits.map((v) => v.hostUserId).filter((x): x is string => !!x))];
  const [weapons, hosts, openLoans] = await Promise.all([
    weaponIds.length ? db.clubWeapon.findMany({ where: { tenantId, id: { in: weaponIds } }, select: { id: true, name: true, caliber: true } }) : [],
    hostIds.length ? db.user.findMany({ where: { id: { in: hostIds } }, select: { id: true, name: true } }) : [],
    weaponIds.length ? db.weaponLoan.findMany({ where: { tenantId, weaponId: { in: weaponIds }, returnedAt: null }, select: { id: true, weaponId: true } }) : [],
  ]);
  return { day, weapons, hosts, openLoans };
}

/** Offene Leihe einer Vereinswaffe (für Rückgabe beim Auschecken). */
export async function findOpenLoanForWeapon(tenantId: string, weaponId: string) {
  return db.weaponLoan.findFirst({ where: { tenantId, weaponId, returnedAt: null }, orderBy: { loanedAt: "desc" }, select: { id: true } });
}

/** Vorschlag für die Halbtage beim Abschliessen (offene Besuche zählen bis jetzt). */
export function suggestFlags(day: { date: Date; visits: Array<{ checkedInAt: Date; checkedOutAt: Date | null }> }, now: Date = new Date()): HalfDayFlags {
  return halfDayFlagsFromVisits(dbDateKey(day.date), day.visits, now);
}

/** Eigener offener Besuch (für Selbst-Check-in). */
export async function getMyOpenVisit(tenantId: string, userId: string) {
  return db.rangeVisit.findFirst({
    where: { tenantId, userId, checkedOutAt: null, rangeDay: { closedAt: null } },
    include: { rangeDay: { select: { id: true, date: true, resource: { select: { name: true } } } } },
    orderBy: { checkedInAt: "desc" },
  });
}

// --- Standbuch-Archiv -------------------------------------------------------------------

export async function listRangeDays(tenantId: string, opts: { year: number; resourceId?: string | null; take?: number }) {
  const from = dayKeyToDbDate(`${opts.year}-01-01`);
  const to = dayKeyToDbDate(`${opts.year}-12-31`);
  const days = await db.rangeDay.findMany({
    where: { tenantId, date: { gte: from, lte: to }, ...(opts.resourceId ? { resourceId: opts.resourceId } : {}) },
    include: { resource: { select: { name: true } }, visits: { select: { userId: true } } },
    orderBy: [{ date: "desc" }, { openedAt: "desc" }],
    take: opts.take ?? 500,
  });
  return days.map(({ visits, ...d }) => ({ ...d, visitCount: visits.length, guestCount: visits.filter((v) => !v.userId).length }));
}

export async function getRangeDayDetail(tenantId: string, id: string) {
  return getDayBoard(tenantId, id);
}

// --- Standordnung -------------------------------------------------------------------------

export async function getActiveRules(tenantId: string) {
  return db.rangeRules.findFirst({ where: { tenantId, isActive: true }, orderBy: { version: "desc" } });
}

export async function hasAcceptedRules(rulesId: string, userId: string) {
  return (await db.rulesAcceptance.count({ where: { rulesId, userId } })) > 0;
}

export async function listRulesVersions(tenantId: string) {
  return db.rangeRules.findMany({ where: { tenantId }, include: { _count: { select: { acceptances: true } } }, orderBy: { version: "desc" } });
}

export async function getRules(tenantId: string, id: string) {
  return db.rangeRules.findFirst({ where: { id, tenantId } });
}

/** Wer hat die aktuelle Version bestätigt, wer (noch) nicht. Nur aktive Mitglieder. */
export async function rulesAcceptanceStats(tenantId: string, rulesId: string) {
  const [members, acceptances] = await Promise.all([
    db.membership.findMany({
      where: { tenantId, status: { not: "LEFT" }, user: { deletedAt: null } },
      select: { user: { select: { id: true, name: true } } },
      orderBy: { user: { name: "asc" } },
    }),
    db.rulesAcceptance.findMany({ where: { rulesId, rules: { tenantId } }, select: { userId: true, acceptedAt: true } }),
  ]);
  const accepted = new Map(acceptances.map((a) => [a.userId, a.acceptedAt]));
  const done = members.filter((m) => accepted.has(m.user.id)).map((m) => ({ id: m.user.id, name: m.user.name, acceptedAt: accepted.get(m.user.id)! }));
  const missing = members.filter((m) => !accepted.has(m.user.id)).map((m) => ({ id: m.user.id, name: m.user.name }));
  return { total: members.length, done, missing };
}

// --- Schiesszeiten und Kontingent ---------------------------------------------------------

export async function listWindows(tenantId: string) {
  return db.shootingWindow.findMany({
    where: { tenantId },
    include: { resource: { select: { name: true } } },
    orderBy: [{ weekday: "asc" }, { startMinute: "asc" }],
  });
}

export async function listQuotas(tenantId: string, year?: number) {
  return db.shootingQuota.findMany({
    where: { tenantId, ...(year ? { year } : {}) },
    include: { resource: { select: { name: true } } },
    orderBy: [{ year: "desc" }],
  });
}

/** Abgeschlossene Schiesstage eines Jahres als Kontingent-Tage. */
export async function closedQuotaDays(tenantId: string, year: number) {
  const days = await db.rangeDay.findMany({
    where: { tenantId, closedAt: { not: null }, date: { gte: dayKeyToDbDate(`${year}-01-01`), lte: dayKeyToDbDate(`${year}-12-31`) } },
    select: { id: true, date: true, resourceId: true, usedAm: true, usedPm: true, usedEvening: true, dutyName: true, notes: true, resource: { select: { name: true } }, _count: { select: { visits: true } } },
    orderBy: { date: "asc" },
  });
  return days;
}

export type QuotaOverview = {
  key: string;
  quotaId: string | null;
  resourceId: string | null;
  resourceName: string;
  max: number | null;
  note: string | null;
  used: number;
  status: ReturnType<typeof quotaStatus> | null;
  months: ReturnType<typeof halfDaysByMonth>;
  merged: ReturnType<typeof mergeHalfDaysByDate>;
};

/**
 * Kontingente eines Jahres mit Verbrauch. Ohne erfasstes Kontingent gibt es eine Zeile
 * «Ganze Anlage» ohne Höchstwert, damit der Verbrauch trotzdem sichtbar ist.
 */
export async function quotaOverview(tenantId: string, year: number) {
  const [quotas, days] = await Promise.all([listQuotas(tenantId, year), closedQuotaDays(tenantId, year)]);
  const quotaDays: Array<QuotaDay & { id: string }> = days.map((d) => ({ id: d.id, date: d.date, resourceId: d.resourceId, usedAm: d.usedAm, usedPm: d.usedPm, usedEvening: d.usedEvening }));
  const build = (quotaId: string | null, resourceId: string | null, resourceName: string, max: number | null, note: string | null): QuotaOverview => {
    const merged = mergeHalfDaysByDate(daysForQuota(quotaDays, resourceId));
    const used = merged.reduce((a, d) => a + d.count, 0);
    return { key: quotaId ?? `none-${resourceId ?? "all"}`, quotaId, resourceId, resourceName, max, note, used, status: max === null ? null : quotaStatus(max, used), months: halfDaysByMonth(merged), merged };
  };
  const rows = quotas.map((q) => build(q.id, q.resourceId, q.resource?.name ?? "Ganze Anlage", q.maxHalfDays, q.note));
  if (!rows.some((r) => r.resourceId === null)) rows.unshift(build(null, null, "Ganze Anlage", null, null));
  return { rows, days };
}

// --- Vorfälle -----------------------------------------------------------------------------

export async function listIncidents(tenantId: string, opts: { reportedById?: string; status?: "OPEN" | "CLOSED" }) {
  const rows = await db.incident.findMany({
    where: { tenantId, ...(opts.reportedById ? { reportedById: opts.reportedById } : {}), ...(opts.status ? { status: opts.status } : {}) },
    orderBy: { occurredAt: "desc" },
    take: 300,
  });
  return withReporterNames(rows);
}

export async function getIncident(tenantId: string, id: string) {
  const row = await db.incident.findFirst({ where: { id, tenantId } });
  if (!row) return null;
  return (await withReporterNames([row]))[0]!;
}

async function withReporterNames<T extends { reportedById: string | null }>(rows: T[]) {
  const ids = [...new Set(rows.map((r) => r.reportedById).filter((x): x is string => !!x))];
  const users = ids.length ? await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
  const names = new Map(users.map((u) => [u.id, u.name]));
  return rows.map((r) => ({ ...r, reporterName: r.reportedById ? (names.get(r.reportedById) ?? "Gelöschtes Konto") : null }));
}

export async function incidentCounts(tenantId: string) {
  const [open, high] = await Promise.all([
    db.incident.count({ where: { tenantId, status: "OPEN" } }),
    db.incident.count({ where: { tenantId, status: "OPEN", severity: "HIGH" } }),
  ]);
  return { open, high };
}

/** Datum gestern/heute für Hinweise «Standbuch vom Vortag noch offen». */
export function isBeforeToday(date: Date) {
  return dbDateKey(date) < todayZurich();
}
