import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { addDays, todayZurich, zurichToUtc } from "@/lib/time";
import { AmmoError } from "./service";
import { yearSummary, type StockKind } from "./stock";

type Tx = Prisma.TransactionClient;

/**
 * Bucht eine Bestandsbewegung und passt AmmoProduct.stockUnits im selben Schritt an. Bedingte Updates
 * (nie unter null, kein Überschreiben paralleler Änderungen); immer innerhalb einer Transaktion aufrufen,
 * damit Bestand und Journal zusammen gelingen oder zusammen scheitern.
 * Ohne geführten Bestand (null): ein Zugang setzt den Bestand, ein Abgang wird abgelehnt.
 */
export async function bookStock(
  tx: Tx,
  m: {
    tenantId: string; productId: string; kind: StockKind; units: number; date?: Date; rangeDayId?: string | null; orderId?: string | null;
    source?: string | null; note?: string | null; createdById?: string | null;
  },
): Promise<{ stockUnits: number }> {
  if (!Number.isInteger(m.units) || Math.abs(m.units) > 10_000_000) throw new AmmoError("Ungültige Menge.");
  const p = await tx.ammoProduct.findFirst({ where: { id: m.productId, tenantId: m.tenantId }, select: { name: true, stockUnits: true, unitLabel: true } });
  if (!p) throw new AmmoError("Produkt nicht gefunden.");
  let applied = false;
  if (p.stockUnits === null) {
    if (m.units < 0) throw new AmmoError(`Für «${p.name}» wird kein Bestand geführt.`);
    const res = await tx.ammoProduct.updateMany({ where: { id: m.productId, tenantId: m.tenantId, stockUnits: null }, data: { stockUnits: m.units } });
    applied = res.count > 0;
  }
  if (!applied && m.units !== 0) {
    const res = await tx.ammoProduct.updateMany({
      where: { id: m.productId, tenantId: m.tenantId, stockUnits: m.units < 0 ? { gte: -m.units } : { not: null } },
      data: { stockUnits: { increment: m.units } },
    });
    if (res.count === 0) throw new AmmoError(`Zu wenig an Lager: «${p.name}» (Bestand ${p.stockUnits ?? 0} ${p.unitLabel}).`);
  }
  await tx.ammoStockMovement.create({
    data: {
      tenantId: m.tenantId, productId: m.productId, kind: m.kind, units: m.units, date: m.date ?? new Date(),
      rangeDayId: m.rangeDayId ?? null, orderId: m.orderId ?? null,
      source: m.source?.slice(0, 191) || null, note: m.note?.slice(0, 191) || null, createdById: m.createdById ?? null,
    },
  });
  const fresh = await tx.ammoProduct.findFirst({ where: { id: m.productId, tenantId: m.tenantId }, select: { stockUnits: true } });
  return { stockUnits: fresh?.stockUnits ?? 0 };
}

/** Datum einer Bewegung: heute = jetzt, sonst Mittag des gewählten Schweizer Kalendertags. */
export function movementDate(dayKey: string, now: Date = new Date()) {
  return dayKey === todayZurich() ? now : zurichToUtc(dayKey, "12:00");
}

export type MovementFilter = { productId?: string; kind?: string; from?: string; to?: string };

export async function listMovements(tenantId: string, f: MovementFilter, take = 300) {
  const rows = await db.ammoStockMovement.findMany({
    where: {
      tenantId,
      ...(f.productId ? { productId: f.productId } : {}),
      ...(f.kind ? { kind: f.kind } : {}),
      ...(f.from || f.to
        ? { date: { ...(f.from ? { gte: zurichToUtc(f.from, "00:00") } : {}), ...(f.to ? { lt: zurichToUtc(addDays(f.to, 1), "00:00") } : {}) } }
        : {}),
    },
    include: {
      product: { select: { name: true, caliber: true, unitLabel: true, roundsPerUnit: true, fundingType: true } },
      rangeDay: { select: { date: true, resource: { select: { name: true } } } },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take,
  });
  const userIds = [...new Set(rows.map((r) => r.createdById).filter((x): x is string => !!x))];
  const orderIds = [...new Set(rows.map((r) => r.orderId).filter((x): x is string => !!x))];
  const [users, orders] = await Promise.all([
    userIds.length ? db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }) : [],
    orderIds.length ? db.ammoOrder.findMany({ where: { tenantId, id: { in: orderIds } }, select: { id: true, invoiceNumber: true } }) : [],
  ]);
  const names = new Map(users.map((u) => [u.id, u.name]));
  const invoices = new Map(orders.map((o) => [o.id, o.invoiceNumber]));
  return rows.map((r) => ({ ...r, createdByName: r.createdById ? names.get(r.createdById) ?? null : null, invoiceNumber: r.orderId ? invoices.get(r.orderId) ?? null : null }));
}
export type MovementRow = Awaited<ReturnType<typeof listMovements>>[number];

/** Standbücher der letzten Tage (für die Verknüpfung einer Abgabe am Stand). */
export async function recentRangeDays(tenantId: string, days = 60) {
  const from = new Date(`${addDays(todayZurich(), -days)}T00:00:00.000Z`);
  const rows = await db.rangeDay.findMany({
    where: { tenantId, date: { gte: from } },
    select: { id: true, date: true, closedAt: true, dutyName: true, resource: { select: { name: true } } },
    orderBy: [{ date: "desc" }, { openedAt: "desc" }],
    take: 200,
  });
  return rows.map((r) => ({ id: r.id, dayKey: r.date.toISOString().slice(0, 10), closed: !!r.closedAt, label: `${r.resource?.name ?? "Ganze Anlage"}${r.dutyName ? ` · ${r.dutyName}` : ""}${r.closedAt ? " · abgeschlossen" : " · offen"}` }));
}

/** Jahresübersicht pro Finanzierungsart (Schweizer Kalenderjahr). */
export async function stockYearOverview(tenantId: string, year: number) {
  const start = zurichToUtc(`${year}-01-01`, "00:00");
  const end = zurichToUtc(`${year + 1}-01-01`, "00:00");
  const [products, inYear, afterYear] = await Promise.all([
    db.ammoProduct.findMany({
      where: { tenantId },
      select: { id: true, name: true, caliber: true, unitLabel: true, roundsPerUnit: true, fundingType: true, stockUnits: true, isActive: true, _count: { select: { movements: true } } },
      orderBy: [{ caliber: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    }),
    db.ammoStockMovement.findMany({ where: { tenantId, date: { gte: start, lt: end } }, select: { productId: true, kind: true, units: true } }),
    db.ammoStockMovement.findMany({ where: { tenantId, date: { gte: end } }, select: { productId: true, kind: true, units: true } }),
  ]);
  // Nur Produkte mit Bestand oder Bewegungen (ausgeblendete ohne Bewegung weglassen).
  const relevant = products.filter((p) => p.stockUnits !== null || p._count.movements > 0);
  return yearSummary(relevant, inYear, afterYear);
}

/** Inventur-Bewegungen eines Durchgangs (gleicher Zeitpunkt) für den Differenzbericht. */
export async function inventoryRun(tenantId: string, at: Date) {
  const rows = await db.ammoStockMovement.findMany({
    where: { tenantId, kind: "INVENTORY", date: at },
    include: { product: { select: { name: true, caliber: true, unitLabel: true, roundsPerUnit: true, fundingType: true, priceCents: true } } },
    orderBy: [{ product: { caliber: "asc" } }, { product: { name: "asc" } }],
  });
  const createdBy = rows[0]?.createdById ? await db.user.findUnique({ where: { id: rows[0].createdById }, select: { name: true } }) : null;
  return { rows, createdByName: createdBy?.name ?? null, note: rows[0]?.note ?? null };
}

/** Letzte Inventuren (Zeitpunkte) für die Liste. */
export async function recentInventories(tenantId: string) {
  const rows = await db.ammoStockMovement.groupBy({
    by: ["date"],
    where: { tenantId, kind: "INVENTORY" },
    _count: { _all: true },
    _sum: { units: true },
    orderBy: { date: "desc" },
    take: 12,
  });
  return rows.map((r) => ({ at: r.date, count: r._count._all, net: r._sum.units ?? 0 }));
}
