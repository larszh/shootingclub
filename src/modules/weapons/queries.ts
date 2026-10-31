import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { todayZurich } from "@/lib/time";
import { blockReasonOf, isLoanOverdue, isMinorOn, minorReportState, serviceInfo, type ServiceInfo } from "./logic";
import { defaultMinorReportDays, shotsSinceServiceMap } from "./service";
import { MINOR_REPORT_WARN_DAYS, type WeaponStatus } from "./types";

export { defaultMinorReportDays };

export type WeaponFilter = { status?: WeaponStatus | "due" | "active" | "all"; discipline?: string; q?: string };

const openLoanSelect = {
  id: true, userId: true, borrowerName: true, isMinor: true, onSiteOnly: true, loanedAt: true, dueAt: true, reportDueAt: true, reportedAt: true,
  user: { select: { name: true } },
} satisfies Prisma.WeaponLoanSelect;

export type WeaponListItem = {
  id: string; name: string; discipline: string | null; manufacturer: string | null; model: string | null; caliber: string | null;
  serialNumber: string | null; status: string; shotCount: number; serviceEveryShots: number | null; nextServiceAt: Date | null;
  blockReason: string | null; service: ServiceInfo; shotsSinceService: number;
  openLoan: { id: string; borrower: string; loanedAt: Date; dueAt: Date | null; overdue: boolean; isMinor: boolean } | null;
};

/** Inventar mit Filter. Seriennummern nur mit `withSerial` (weapons.manage). */
export async function listWeapons(tenantId: string, filter: WeaponFilter, withSerial: boolean): Promise<WeaponListItem[]> {
  const q = filter.q?.trim();
  const where: Prisma.ClubWeaponWhereInput = {
    tenantId,
    ...(filter.status && filter.status !== "all" && filter.status !== "due" && filter.status !== "active" ? { status: filter.status } : {}),
    ...(filter.status === "active" || filter.status === "due" ? { status: { not: "RETIRED" } } : {}),
    ...(filter.discipline ? { discipline: filter.discipline } : {}),
    ...(q
      ? { OR: [{ name: { contains: q } }, { manufacturer: { contains: q } }, { model: { contains: q } }, { caliber: { contains: q } }, ...(withSerial ? [{ serialNumber: { contains: q } }] : [])] }
      : {}),
  };
  const rows = await db.clubWeapon.findMany({
    where,
    include: { loans: { where: { returnedAt: null }, select: openLoanSelect, orderBy: { loanedAt: "desc" }, take: 1 } },
    orderBy: [{ discipline: "asc" }, { name: "asc" }],
    take: 500,
  });
  const since = await shotsSinceServiceMap(tenantId, rows.map((r) => r.id));
  const today = todayZurich();
  const now = new Date();
  const list = rows.map((w): WeaponListItem => {
    const s = since.get(w.id) ?? 0;
    const l = w.loans[0];
    return {
      id: w.id, name: w.name, discipline: w.discipline, manufacturer: w.manufacturer, model: w.model, caliber: w.caliber,
      serialNumber: withSerial ? w.serialNumber : null, status: w.status, shotCount: w.shotCount, serviceEveryShots: w.serviceEveryShots,
      nextServiceAt: w.nextServiceAt, blockReason: blockReasonOf(w.notes), shotsSinceService: s,
      service: serviceInfo({ status: w.status, serviceEveryShots: w.serviceEveryShots, nextServiceAt: w.nextServiceAt, shotsSinceService: s }, today),
      openLoan: l ? { id: l.id, borrower: l.user?.name ?? l.borrowerName ?? "Unbekannt", loanedAt: l.loanedAt, dueAt: l.dueAt, overdue: isLoanOverdue({ dueAt: l.dueAt, returnedAt: null }, now), isMinor: l.isMinor } : null,
    };
  });
  return filter.status === "due" ? list.filter((w) => w.service.due) : list;
}

/** Kennzahlen für die Übersicht. */
export async function weaponStats(tenantId: string) {
  const all = await listWeapons(tenantId, { status: "active" }, false);
  const now = new Date();
  const minor = await db.weaponLoan.findMany({ where: { tenantId, isMinor: true, reportedAt: null }, select: { isMinor: true, reportDueAt: true, reportedAt: true } });
  return {
    total: all.length,
    available: all.filter((w) => w.status === "AVAILABLE").length,
    loaned: all.filter((w) => w.status === "LOANED").length,
    overdue: all.filter((w) => w.openLoan?.overdue).length,
    serviceDue: all.filter((w) => w.service.due).length,
    minorOpen: minor.filter((l) => ["soon", "overdue"].includes(minorReportState(l, now, MINOR_REPORT_WARN_DAYS).state)).length,
  };
}

export async function listDisciplines(tenantId: string) {
  const rows = await db.clubWeapon.findMany({ where: { tenantId, discipline: { not: null } }, select: { discipline: true }, distinct: ["discipline"], orderBy: { discipline: "asc" } });
  return rows.map((r) => r.discipline!).filter(Boolean);
}

async function userNames(ids: (string | null | undefined)[]) {
  const unique = [...new Set(ids.filter((x): x is string => !!x))];
  if (!unique.length) return new Map<string, string>();
  const users = await db.user.findMany({ where: { id: { in: unique } }, select: { id: true, name: true } });
  return new Map(users.map((u) => [u.id, u.name]));
}

/** Detail einer Waffe mit Leih- und Wartungshistorie. */
export async function getWeapon(tenantId: string, id: string, withSerial: boolean) {
  const w = await db.clubWeapon.findFirst({
    where: { id, tenantId },
    include: {
      loans: { orderBy: { loanedAt: "desc" }, take: 100, include: { user: { select: { name: true } } } },
      services: { orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 100 },
    },
  });
  if (!w) return null;
  const since = (await shotsSinceServiceMap(tenantId, [w.id])).get(w.id) ?? 0;
  const names = await userNames(w.loans.map((l) => l.issuedById));
  const now = new Date();
  return {
    ...w,
    serialNumber: withSerial ? w.serialNumber : null,
    blockReason: blockReasonOf(w.notes),
    shotsSinceService: since,
    service: serviceInfo({ status: w.status, serviceEveryShots: w.serviceEveryShots, nextServiceAt: w.nextServiceAt, shotsSinceService: since }, todayZurich()),
    loans: w.loans.map((l) => ({
      ...l,
      borrower: l.user?.name ?? l.borrowerName ?? "Unbekannt",
      issuedByName: l.issuedById ? names.get(l.issuedById) ?? null : null,
      overdue: isLoanOverdue(l, now),
      report: minorReportState(l, now, MINOR_REPORT_WARN_DAYS),
    })),
  };
}
export type WeaponDetail = NonNullable<Awaited<ReturnType<typeof getWeapon>>>;

export type LoanRow = {
  id: string; weaponId: string; weaponName: string; caliber: string | null; borrower: string; userId: string | null;
  isMinor: boolean; onSiteOnly: boolean; loanedAt: Date; dueAt: Date | null; returnedAt: Date | null; shots: number | null;
  reportDueAt: Date | null; reportedAt: Date | null; overdue: boolean; report: ReturnType<typeof minorReportState>; issuedByName: string | null; note: string | null;
};

async function toLoanRows(loans: Prisma.WeaponLoanGetPayload<{ include: { user: { select: { name: true } }; weapon: { select: { name: true; caliber: true } } } }>[]) {
  const names = await userNames(loans.map((l) => l.issuedById));
  const now = new Date();
  return loans.map((l): LoanRow => ({
    id: l.id, weaponId: l.weaponId, weaponName: l.weapon.name, caliber: l.weapon.caliber, borrower: l.user?.name ?? l.borrowerName ?? "Unbekannt",
    userId: l.userId, isMinor: l.isMinor, onSiteOnly: l.onSiteOnly, loanedAt: l.loanedAt, dueAt: l.dueAt, returnedAt: l.returnedAt, shots: l.shots,
    reportDueAt: l.reportDueAt, reportedAt: l.reportedAt, overdue: isLoanOverdue(l, now), report: minorReportState(l, now, MINOR_REPORT_WARN_DAYS),
    issuedByName: l.issuedById ? names.get(l.issuedById) ?? null : null, note: l.note,
  }));
}

const loanInclude = { user: { select: { name: true } }, weapon: { select: { name: true, caliber: true } } } as const;

/** Offene Leihen (überfällige zuerst), Leihen an Minderjährige mit offener Meldung und die letzten Rückgaben. */
export async function loansOverview(tenantId: string) {
  const [open, minors, recent] = await Promise.all([
    db.weaponLoan.findMany({ where: { tenantId, returnedAt: null }, include: loanInclude, orderBy: { loanedAt: "asc" } }),
    db.weaponLoan.findMany({ where: { tenantId, isMinor: true, OR: [{ reportedAt: null }, { reportedAt: { gte: new Date(Date.now() - 90 * 86_400_000) } }] }, include: loanInclude, orderBy: { loanedAt: "desc" }, take: 100 }),
    db.weaponLoan.findMany({ where: { tenantId, returnedAt: { not: null } }, include: loanInclude, orderBy: { returnedAt: "desc" }, take: 30 }),
  ]);
  const openRows = await toLoanRows(open);
  openRows.sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.loanedAt.getTime() - b.loanedAt.getTime());
  return { open: openRows, minors: await toLoanRows(minors), recent: await toLoanRows(recent) };
}

export async function getLoan(tenantId: string, id: string) {
  const l = await db.weaponLoan.findFirst({
    where: { id, tenantId },
    include: { user: { select: { name: true, street: true, zip: true, city: true, phone: true } }, weapon: true },
  });
  if (!l) return null;
  const names = await userNames([l.issuedById]);
  return { ...l, borrower: l.user?.name ?? l.borrowerName ?? "Unbekannt", issuedByName: l.issuedById ? names.get(l.issuedById) ?? null : null };
}

/** Mitglieder für die Ausleihe (ohne ausgetretene und gelöschte Konten), mit Minderjährigkeit heute. */
export async function memberOptions(tenantId: string) {
  const today = todayZurich();
  const rows = await db.membership.findMany({
    where: { tenantId, status: { not: "LEFT" }, user: { deletedAt: null } },
    select: { memberNumber: true, user: { select: { id: true, name: true, birthDate: true } } },
    orderBy: { user: { name: "asc" } },
  });
  return rows.map((m) => ({ userId: m.user.id, name: m.user.name, memberNumber: m.memberNumber, minor: isMinorOn(m.user.birthDate, today) }));
}
export type MemberOption = Awaited<ReturnType<typeof memberOptions>>[number];
