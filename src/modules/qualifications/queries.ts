import "server-only";
import { db } from "@/lib/db";
import { addDays, todayZurich } from "@/lib/time";
import { dayToDbDate, EXPIRY_WARN_DAYS, qualificationState } from "./types";

export type QualificationFilter = { kind?: string; expiring?: boolean; userId?: string; q?: string };

const select = {
  id: true, userId: true, kind: true, label: true, number: true, validFrom: true, validUntil: true, verifiedById: true, sourceParticipantId: true, note: true, createdAt: true,
  user: { select: { id: true, name: true, deletedAt: true } },
} as const;

/** Qualifikationen im Verein (ohne gelöschte Konten), mit Ablaufstatus. «läuft ab» = abgelaufen oder in ≤ 60 Tagen. */
export async function listQualifications(tenantId: string, f: QualificationFilter) {
  const today = todayZurich();
  const rows = await db.qualification.findMany({
    where: {
      tenantId,
      user: { deletedAt: null, ...(f.q ? { name: { contains: f.q } } : {}), memberships: { some: { tenantId, status: { not: "LEFT" } } } },
      ...(f.kind ? { kind: f.kind } : {}),
      ...(f.userId ? { userId: f.userId } : {}),
      ...(f.expiring ? { validUntil: { not: null, lte: dayToDbDate(addDays(today, EXPIRY_WARN_DAYS)) } } : {}),
    },
    select,
    orderBy: [{ user: { name: "asc" } }, { kind: "asc" }, { validUntil: "desc" }],
    take: 1000,
  });
  const verifierIds = [...new Set(rows.map((r) => r.verifiedById).filter((x): x is string => !!x))];
  const verifiers = verifierIds.length ? await db.user.findMany({ where: { id: { in: verifierIds } }, select: { id: true, name: true } }) : [];
  const vName = new Map(verifiers.map((v) => [v.id, v.name]));
  return rows.map((r) => ({ ...r, verifiedByName: r.verifiedById ? vName.get(r.verifiedById) ?? null : null, ...qualificationState(r, today) }));
}
export type QualificationRow = Awaited<ReturnType<typeof listQualifications>>[number];

export async function qualificationCounts(tenantId: string) {
  const today = todayZurich();
  const base = { tenantId, user: { deletedAt: null, memberships: { some: { tenantId, status: { not: "LEFT" } } } } };
  const [total, expired, expiring] = await Promise.all([
    db.qualification.count({ where: base }),
    db.qualification.count({ where: { ...base, validUntil: { lt: dayToDbDate(today) } } }),
    db.qualification.count({ where: { ...base, validUntil: { gte: dayToDbDate(today), lte: dayToDbDate(addDays(today, EXPIRY_WARN_DAYS)) } } }),
  ]);
  return { total, expired, expiring };
}

/** Eigene Qualifikationen im Verein. */
export async function myQualifications(tenantId: string, userId: string) {
  const today = todayZurich();
  const rows = await db.qualification.findMany({ where: { tenantId, userId }, select, orderBy: [{ kind: "asc" }, { validUntil: "desc" }] });
  return rows.map((r) => ({ ...r, ...qualificationState(r, today) }));
}
