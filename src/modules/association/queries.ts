import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/lib/db";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { accessStatusWhere } from "@/lib/membership-access";
import { addDays, zurichToUtc } from "@/lib/time";
import { dbDateToDay } from "@/modules/federal/types";
import {
  associationAccess,
  hasAnyAssociationAccess,
  nameSharingClubIds,
  readableClubIds,
  type AssociationAccess,
  type MemberLinkLite,
} from "./access";
import {
  buildAssociationRanking,
  deadlineViews,
  fsStats,
  memberCounts,
  opStats,
  type ClubStatsRow,
  type RankingInput,
} from "./stats";

// ---------------------------------------------------------------------------
// Zugriff
// ---------------------------------------------------------------------------

/** AssociationAdmin-Zeilen eines Benutzers (pro Request gecacht). */
export const getAssociationAdminRows = cache(async (userId: string) => {
  return db.associationAdmin.findMany({ where: { userId }, select: { associationId: true, role: true } });
});

/**
 * Hat der Benutzer einen Verbandsbereich? Für den Navigationseintrag in der App-Shell:
 * Super-Admins oder Benutzer mit einer Rolle in einem nicht gelöschten Verband.
 */
export async function hasAssociationArea(user: Pick<CurrentUser, "id" | "isSuperAdmin">): Promise<boolean> {
  if (user.isSuperAdmin) return true;
  const rows = await db.associationAdmin.findMany({ where: { userId: user.id, association: { deletedAt: null } }, select: { associationId: true, role: true } });
  return hasAnyAssociationAccess(user, rows);
}

/** Verbände, die der Benutzer im Verbandsbereich öffnen darf (Super-Admin: alle nicht gelöschten). */
export async function listAccessibleAssociations(user: CurrentUser) {
  const rows = await getAssociationAdminRows(user.id);
  const associations = await db.association.findMany({
    where: user.isSuperAdmin ? { deletedAt: null } : { deletedAt: null, id: { in: rows.map((r) => r.associationId) } },
    select: { id: true, name: true, region: true, deletedAt: true, _count: { select: { members: { where: { status: "APPROVED", tenant: { deletedAt: null } } } } } },
    orderBy: { name: "asc" },
  });
  return associations
    .map((a) => ({ id: a.id, name: a.name, region: a.region, clubCount: a._count.members, access: associationAccess(user, a, rows) }))
    .filter((a): a is typeof a & { access: AssociationAccess } => a.access !== null);
}

export type AssociationContext = {
  user: CurrentUser;
  association: { id: string; name: string; code: string; region: string | null; deletedAt: Date | null };
  access: AssociationAccess;
};

/**
 * Verbandsbereich: angemeldeter Benutzer mit Rolle im Verband (unabhängig vom aktiven Verein).
 * Ohne Anmeldung → /login, ohne Zugang → 404 (verrät nicht, ob der Verband existiert).
 */
export async function requireAssociation(associationId: string): Promise<AssociationContext> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(associationId)) notFound();
  const [association, rows] = await Promise.all([
    db.association.findUnique({ where: { id: associationId }, select: { id: true, name: true, code: true, region: true, deletedAt: true } }),
    getAssociationAdminRows(user.id),
  ]);
  const access = associationAccess(user, association, rows);
  if (!association || !access) notFound();
  return { user, association, access };
}

/** Wie requireAssociation, aber für Server Actions und Routen: null statt Umleitung. */
export async function associationContextOrNull(associationId: string): Promise<AssociationContext | null> {
  const user = await getCurrentUser();
  if (!user || typeof associationId !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(associationId)) return null;
  const [association, rows] = await Promise.all([
    db.association.findUnique({ where: { id: associationId }, select: { id: true, name: true, code: true, region: true, deletedAt: true } }),
    getAssociationAdminRows(user.id),
  ]);
  const access = associationAccess(user, association, rows);
  if (!association || !access) return null;
  return { user, association, access };
}

// ---------------------------------------------------------------------------
// Vereine eines Verbands
// ---------------------------------------------------------------------------

/** Alle Verbindungen eines Verbands mit Vereinsname (keine weiteren Vereinsdaten). */
export async function listAssociationMembers(associationId: string) {
  const rows = await db.associationMember.findMany({
    where: { associationId },
    select: {
      id: true, tenantId: true, status: true, shareNames: true, consentAt: true, approvedAt: true, revokedAt: true, createdAt: true,
      tenant: { select: { name: true, city: true, canton: true, deletedAt: true } },
    },
    orderBy: [{ status: "asc" }, { tenant: { name: "asc" } }],
  });
  return rows.map((r) => ({
    id: r.id,
    tenantId: r.tenantId,
    clubName: r.tenant.name,
    city: r.tenant.city,
    canton: r.tenant.canton,
    status: r.status,
    shareNames: r.shareNames,
    consentAt: r.consentAt,
    approvedAt: r.approvedAt,
    revokedAt: r.revokedAt,
    createdAt: r.createdAt,
    tenantDeletedAt: r.tenant.deletedAt,
  }));
}
export type AssociationMemberRow = Awaited<ReturnType<typeof listAssociationMembers>>[number];

/** Freigaben für die Auswertungen: lesbare Vereine und Vereine mit Namensfreigabe (immer über access.ts). */
export function sharingScope(access: AssociationAccess, members: readonly (MemberLinkLite & { clubName: string })[]) {
  const readable = readableClubIds(access, members);
  const named = nameSharingClubIds(access, members);
  const names = new Map(members.filter((m) => readable.includes(m.tenantId)).map((m) => [m.tenantId, m.clubName]));
  return { readable, named, names };
}

function yearRange(year: number) {
  return { from: zurichToUtc(`${year}-01-01`, "00:00"), to: zurichToUtc(`${year + 1}-01-01`, "00:00") };
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

/**
 * Kennzahlen pro Verein für ein Jahr. Erwartet ausschliesslich tenantIds aus sharingScope().
 * Gelesen werden nur Felder, die für Zahlen nötig sind (Status, Geburtsjahr, Bestanden-Flag);
 * nichts davon verlässt diese Funktion ausser als Anzahl.
 */
export async function loadClubStats(tenantIds: readonly string[], names: ReadonlyMap<string, string>, year: number, today: string): Promise<ClubStatsRow[]> {
  const ids = [...new Set(tenantIds)];
  if (!ids.length) return [];
  const { from, to } = yearRange(year);
  const [memberships, opRows, fsRows, unconfirmedRows, years] = await Promise.all([
    db.membership.findMany({
      where: { tenantId: { in: ids }, status: accessStatusWhere(), user: { deletedAt: null } },
      select: { tenantId: true, status: true, user: { select: { birthDate: true } } },
    }),
    db.matchParticipant.findMany({
      where: { isOfficial: true, userId: { not: null }, match: { tenantId: { in: ids }, date: { gte: from, lt: to }, program: { officialKind: "OP" } } },
      select: { userId: true, passed: true, attempt: true, match: { select: { tenantId: true, date: true } } },
      take: 50_000,
    }),
    db.matchParticipant.findMany({
      where: { total: { not: null }, match: { tenantId: { in: ids }, date: { gte: from, lt: to }, program: { officialKind: "FS" } } },
      select: { userId: true, isOfficial: true, match: { select: { tenantId: true } } },
      take: 50_000,
    }),
    db.matchParticipant.findMany({
      where: { isOfficial: false, total: { not: null }, match: { tenantId: { in: ids }, date: { gte: from, lt: to }, program: { officialKind: { in: ["OP", "FS"] } } } },
      select: { match: { select: { tenantId: true } } },
      take: 50_000,
    }),
    db.federalYear.findMany({
      where: { tenantId: { in: ids }, year },
      select: { tenantId: true, registrationDeadline: true, shootingDeadline: true, reportDeadline: true },
    }),
  ]);

  const group = <T,>(rows: T[], key: (r: T) => string) => {
    const m = new Map<string, T[]>();
    for (const r of rows) {
      const k = key(r);
      const list = m.get(k) ?? [];
      list.push(r);
      m.set(k, list);
    }
    return m;
  };
  const membersBy = group(memberships, (r) => r.tenantId);
  const opBy = group(opRows, (r) => r.match.tenantId);
  const fsBy = group(fsRows, (r) => r.match.tenantId);
  const unconfirmedBy = group(unconfirmedRows, (r) => r.match.tenantId);
  const yearBy = new Map(years.map((y) => [y.tenantId, y]));

  return ids
    .map((tenantId) => {
      const fy = yearBy.get(tenantId);
      return {
        tenantId,
        clubName: names.get(tenantId) ?? "–",
        members: memberCounts((membersBy.get(tenantId) ?? []).map((m) => ({ status: m.status, birthYear: m.user.birthDate ? m.user.birthDate.getUTCFullYear() : null })), year),
        op: opStats((opBy.get(tenantId) ?? []).map((r) => ({ userId: r.userId, passed: r.passed, attempt: r.attempt, date: r.match.date }))),
        fs: fsStats((fsBy.get(tenantId) ?? []).map((r) => ({ userId: r.userId, isOfficial: r.isOfficial }))),
        unconfirmed: (unconfirmedBy.get(tenantId) ?? []).length,
        deadlines: deadlineViews(
          { registrationDeadline: dbDateToDay(fy?.registrationDeadline), shootingDeadline: dbDateToDay(fy?.shootingDeadline), reportDeadline: dbDateToDay(fy?.reportDeadline) },
          today,
        ),
      };
    })
    .sort((a, b) => a.clubName.localeCompare(b.clubName, "de-CH"));
}

// ---------------------------------------------------------------------------
// Verbandsrangliste
// ---------------------------------------------------------------------------

/** Programme für Verbandsranglisten: nur globale Programme (in allen Vereinen gleich), nicht archiviert. */
export async function listRankingPrograms() {
  return db.program.findMany({
    where: { tenantId: null, isArchived: false },
    select: { id: true, name: true, officialKind: true, scoringMode: true },
    orderBy: [{ officialKind: "desc" }, { name: "asc" }],
  });
}

/**
 * Rangliste für ein globales Programm und einen Zeitraum (Schweizer Kalendertage, inkl. Enddatum).
 * Namen werden nur für Vereine mit Namensfreigabe gelesen; für alle anderen nur Anzahl.
 * Gezählt werden Resultate aktueller Mitglieder (keine Gäste, keine gelöschten Konten).
 */
export async function loadAssociationRanking(scope: { readable: string[]; named: string[]; names: ReadonlyMap<string, string> }, programId: string, fromDay: string, toDay: string, officialOnly: boolean) {
  const program = await db.program.findFirst({ where: { id: programId, tenantId: null }, select: { id: true, name: true, scoringMode: true } });
  if (!program || !scope.readable.length) return { program, ranking: buildAssociationRanking([], [], []) };
  const named = scope.named.filter((id) => scope.readable.includes(id));
  const anonymous = scope.readable.filter((id) => !named.includes(id));
  const from = zurichToUtc(fromDay, "00:00");
  const toDate = zurichToUtc(addDays(toDay, 1), "00:00");
  const baseWhere = (tenantIds: string[]) => ({
    userId: { not: null },
    total: { not: null },
    ...(officialOnly ? { isOfficial: true } : {}),
    user: { deletedAt: null },
    match: { tenantId: { in: tenantIds }, programId: program.id, date: { gte: from, lt: toDate } },
  });
  const [namedRows, anonRows, memberships] = await Promise.all([
    named.length
      ? db.matchParticipant.findMany({ where: baseWhere(named), select: { userId: true, total: true, zeros: true, user: { select: { name: true } }, match: { select: { tenantId: true } } }, take: 20_000 })
      : Promise.resolve([]),
    anonymous.length
      ? db.matchParticipant.findMany({ where: baseWhere(anonymous), select: { userId: true, total: true, zeros: true, match: { select: { tenantId: true } } }, take: 20_000 })
      : Promise.resolve([]),
    db.membership.findMany({ where: { tenantId: { in: scope.readable }, status: accessStatusWhere() }, select: { tenantId: true, userId: true } }),
  ]);
  const isMember = new Set(memberships.map((m) => `${m.tenantId}:${m.userId}`));
  const entries: RankingInput[] = [];
  for (const r of namedRows) {
    if (!r.userId || r.total === null || !isMember.has(`${r.match.tenantId}:${r.userId}`)) continue;
    entries.push({ tenantId: r.match.tenantId, clubName: scope.names.get(r.match.tenantId) ?? "–", userId: r.userId, name: r.user?.name ?? "–", total: r.total, zeros: r.zeros });
  }
  for (const r of anonRows) {
    if (!r.userId || r.total === null || !isMember.has(`${r.match.tenantId}:${r.userId}`)) continue;
    entries.push({ tenantId: r.match.tenantId, clubName: scope.names.get(r.match.tenantId) ?? "–", userId: r.userId, name: "", total: r.total, zeros: r.zeros });
  }
  return { program, ranking: buildAssociationRanking(entries, scope.readable, named) };
}

// ---------------------------------------------------------------------------
// Vereinsseite (/admin/association)
// ---------------------------------------------------------------------------

/**
 * Verbindungen eines Vereins mit Verbänden. Aufgelöste (soft-gelöschte) Verbände erscheinen mit
 * deletedAt, damit der Verein auch dort austreten kann (sonst flössen nach einer Wiederherstellung
 * wieder Daten, ohne dass der Verein es verhindern konnte).
 */
export async function listClubAssociations(tenantId: string) {
  const rows = await db.associationMember.findMany({
    where: { tenantId },
    select: { id: true, status: true, shareNames: true, consentAt: true, approvedAt: true, revokedAt: true, createdAt: true, association: { select: { id: true, name: true, region: true, deletedAt: true } } },
    orderBy: { createdAt: "asc" },
  });
  return rows;
}

// ---------------------------------------------------------------------------
// Super-Admin
// ---------------------------------------------------------------------------

export async function listAllAssociations() {
  return db.association.findMany({
    select: {
      id: true, name: true, code: true, region: true, createdAt: true, deletedAt: true,
      _count: { select: { admins: true, members: { where: { status: "APPROVED", tenant: { deletedAt: null } } } } },
    },
    orderBy: [{ deletedAt: "asc" }, { name: "asc" }],
  });
}

export async function getAssociationForSuper(id: string) {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
  return db.association.findUnique({
    where: { id },
    select: {
      id: true, name: true, code: true, region: true, createdAt: true, deletedAt: true,
      admins: { select: { id: true, role: true, createdAt: true, user: { select: { id: true, name: true, email: true, deletedAt: true } } }, orderBy: { createdAt: "asc" } },
    },
  });
}
