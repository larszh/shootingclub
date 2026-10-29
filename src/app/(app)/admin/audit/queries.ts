import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export const AUDIT_PAGE_SIZE = 50;
/** Obergrenze für den CSV-Export (ein Export soll den Server nicht blockieren). */
export const AUDIT_EXPORT_MAX = 20_000;

export type AuditFilter = {
  /** undefined = alle Vereine (nur Super-Admin), null = nur Plattform-Einträge ohne Verein */
  tenantId?: string | null;
  /** Präfix der Aktion, z.B. "member." oder "tenant.delete" */
  action?: string;
  /** Teil des Namens oder exakte ID der handelnden Person */
  actor?: string;
};

export function auditWhere(f: AuditFilter): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};
  if (f.tenantId !== undefined) where.tenantId = f.tenantId;
  if (f.action) where.action = { startsWith: f.action };
  if (f.actor) where.OR = [{ actorId: f.actor }, { actorName: { contains: f.actor } }];
  return where;
}

export async function listAudit(f: AuditFilter, page: number) {
  const where = auditWhere(f);
  const [total, rows] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * AUDIT_PAGE_SIZE, take: AUDIT_PAGE_SIZE }),
  ]);
  return { total, rows };
}

/** Häufige Aktionsgruppen für den Filter (aus den vorhandenen Einträgen, max. 40). */
export async function auditActionPrefixes(tenantId?: string | null): Promise<string[]> {
  const rows = await db.auditLog.groupBy({
    by: ["action"],
    where: tenantId === undefined ? {} : { tenantId },
    _count: { _all: true },
    orderBy: { _count: { action: "desc" } },
    take: 200,
  });
  const prefixes = new Set<string>();
  for (const r of rows) {
    const first = r.action.split(".")[0];
    if (first) prefixes.add(first + ".");
  }
  return [...prefixes].sort().slice(0, 40);
}

/** Namen der Vereine zu den Einträgen (für die Super-Ansicht), ohne N+1. */
export async function tenantNames(ids: Array<string | null>): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((x): x is string => !!x))];
  if (!unique.length) return new Map();
  const ts = await db.tenant.findMany({ where: { id: { in: unique } }, select: { id: true, name: true } });
  return new Map(ts.map((t) => [t.id, t.name]));
}

export async function exportAuditRows(f: AuditFilter) {
  return db.auditLog.findMany({ where: auditWhere(f), orderBy: { createdAt: "desc" }, take: AUDIT_EXPORT_MAX });
}
