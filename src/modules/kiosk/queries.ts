import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { todayZurich, zurichToUtc, addDays } from "@/lib/time";
import { cashByDay, groupForBilling, periodToUtcRange, sumCents, type EntryStatusFilter, type Period } from "./logic";

export async function listProducts(tenantId: string, opts: { activeOnly?: boolean } = {}) {
  return db.kioskProduct.findMany({
    where: { tenantId, ...(opts.activeOnly ? { isActive: true } : {}) },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, category: true, priceCents: true, isActive: true, sortOrder: true },
  });
}
export type KioskProductRow = Awaited<ReturnType<typeof listProducts>>[number];

/** Mitglieder für die Theke (ohne Ausgetretene und gelöschte Konten); zuletzt aktive zuerst markiert. */
export async function counterMembers(tenantId: string) {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [members, recent] = await Promise.all([
    db.membership.findMany({
      where: { tenantId, status: { not: "LEFT" }, user: { deletedAt: null } },
      select: { memberNumber: true, user: { select: { id: true, name: true, avatarPath: true, updatedAt: true } } },
      orderBy: { user: { name: "asc" } },
    }),
    db.kioskEntry.groupBy({
      by: ["userId"],
      where: { tenantId, userId: { not: null }, createdAt: { gte: since } },
      _max: { createdAt: true },
      orderBy: { _max: { createdAt: "desc" } },
      take: 12,
    }),
  ]);
  return { members, recentIds: recent.map((r) => r.userId!).filter(Boolean) };
}

/** Letzte Erfassungen dieser Person an der Theke (heute), zusammengefasst pro Erfassung. */
export async function recentSellerBatches(tenantId: string, sellerId: string) {
  const start = zurichToUtc(todayZurich(), "00:00");
  const rows = await db.kioskEntry.findMany({
    where: { tenantId, createdById: sellerId, createdAt: { gte: start } },
    orderBy: { createdAt: "desc" },
    take: 120,
    select: { id: true, clientId: true, userId: true, guestName: true, productName: true, quantity: true, totalCents: true, paidCash: true, billedInvoiceId: true, createdAt: true },
  });
  const userIds = [...new Set(rows.map((r) => r.userId).filter((x): x is string => !!x))];
  const users = userIds.length ? await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }) : [];
  const names = new Map(users.map((u) => [u.id, u.name]));
  const batches = new Map<string, { batchId: string; who: string; paidCash: boolean; createdAt: Date; totalCents: number; billed: boolean; items: string[] }>();
  for (const r of rows) {
    const batchId = r.clientId?.split(":")[0] ?? `id-${r.id}`;
    let b = batches.get(batchId);
    if (!b) {
      b = { batchId, who: r.userId ? names.get(r.userId) ?? "Mitglied" : r.guestName ? `Gast: ${r.guestName}` : "Gast", paidCash: r.paidCash, createdAt: r.createdAt, totalCents: 0, billed: false, items: [] };
      batches.set(batchId, b);
    }
    b.totalCents += r.totalCents;
    b.billed ||= !!r.billedInvoiceId;
    b.items.push(`${r.quantity} × ${r.productName}`);
  }
  return [...batches.values()].slice(0, 15);
}

/** Vorschau der Abrechnung: unverrechnete, nicht bar bezahlte Einträge von Mitgliedern im Zeitraum. */
export async function billingPreview(tenantId: string, period: Period) {
  const { start, end } = periodToUtcRange(period);
  const entries = await db.kioskEntry.findMany({
    where: { tenantId, userId: { not: null }, billedInvoiceId: null, paidCash: false, createdAt: { gte: start, lt: end } },
    select: { id: true, userId: true, totalCents: true, paidCash: true, billedInvoiceId: true, createdAt: true },
  });
  const groups = groupForBilling(entries);
  const users = groups.length
    ? await db.user.findMany({ where: { id: { in: groups.map((g) => g.userId) } }, select: { id: true, name: true, deletedAt: true } })
    : [];
  const byId = new Map(users.map((u) => [u.id, u]));
  const rows = groups.map((g) => {
    const u = byId.get(g.userId);
    return { ...g, name: u?.name ?? "Unbekannt", billable: !!u && !u.deletedAt };
  }).sort((a, b) => a.name.localeCompare(b.name, "de"));
  return { rows, totalCents: sumCents(rows.filter((r) => r.billable)) };
}
export type BillingPreviewRow = Awaited<ReturnType<typeof billingPreview>>["rows"][number];

export type EntryFilters = { from: string; to: string; status: EntryStatusFilter; userId?: string | null; q?: string | null };

function entryWhere(tenantId: string, f: EntryFilters): Prisma.KioskEntryWhereInput {
  const { start, end } = periodToUtcRange({ from: f.from, to: f.to });
  const where: Prisma.KioskEntryWhereInput = { tenantId, createdAt: { gte: start, lt: end } };
  if (f.status === "open") Object.assign(where, { billedInvoiceId: null, paidCash: false });
  if (f.status === "billed") Object.assign(where, { billedInvoiceId: { not: null } });
  if (f.status === "cash") Object.assign(where, { paidCash: true });
  if (f.userId) where.userId = f.userId;
  if (f.q) where.OR = [{ productName: { contains: f.q } }, { guestName: { contains: f.q } }];
  return where;
}

/** Einträge für die Liste und den CSV-Export (inkl. Namen und Rechnungsnummer). */
export async function listEntries(tenantId: string, f: EntryFilters, take = 300) {
  const where = entryWhere(tenantId, f);
  const [rows, agg] = await Promise.all([
    db.kioskEntry.findMany({
      where, orderBy: { createdAt: "desc" }, take,
      select: { id: true, userId: true, guestName: true, productName: true, quantity: true, unitPriceCents: true, totalCents: true, paidCash: true, billedInvoiceId: true, createdById: true, createdAt: true },
    }),
    db.kioskEntry.aggregate({ where, _sum: { totalCents: true }, _count: { _all: true } }),
  ]);
  const userIds = [...new Set(rows.flatMap((r) => [r.userId, r.createdById]).filter((x): x is string => !!x))];
  const invoiceIds = [...new Set(rows.map((r) => r.billedInvoiceId).filter((x): x is string => !!x))];
  const [users, invoices] = await Promise.all([
    userIds.length ? db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }) : [],
    invoiceIds.length ? db.feeInvoice.findMany({ where: { tenantId, id: { in: invoiceIds } }, select: { id: true, number: true, status: true } }) : [],
  ]);
  const names = new Map(users.map((u) => [u.id, u.name]));
  const inv = new Map(invoices.map((i) => [i.id, i]));
  return {
    rows: rows.map((r) => ({
      ...r,
      memberName: r.userId ? names.get(r.userId) ?? "Unbekannt" : null,
      sellerName: r.createdById ? names.get(r.createdById) ?? null : null,
      invoice: r.billedInvoiceId ? inv.get(r.billedInvoiceId) ?? null : null,
    })),
    count: agg._count._all,
    totalCents: agg._sum.totalCents ?? 0,
  };
}
export type EntryRow = Awaited<ReturnType<typeof listEntries>>["rows"][number];

/** Personen, die im Verein Einträge haben (für den Filter); ohne gelöschte Konten. */
export async function entryMemberOptions(tenantId: string) {
  const rows = await db.membership.findMany({
    where: { tenantId, status: { not: "LEFT" }, user: { deletedAt: null } },
    select: { user: { select: { id: true, name: true } } },
    orderBy: { user: { name: "asc" } },
  });
  return rows.map((r) => ({ userId: r.user.id, name: r.user.name }));
}

/** Barverkäufe der letzten `days` Tage, pro Tag zusammengefasst. */
export async function cashSummary(tenantId: string, days = 14) {
  const today = todayZurich();
  const start = zurichToUtc(addDays(today, -(days - 1)), "00:00");
  const rows = await db.kioskEntry.findMany({
    where: { tenantId, paidCash: true, createdAt: { gte: start } },
    select: { createdAt: true, totalCents: true, quantity: true, productName: true },
    orderBy: { createdAt: "desc" },
    take: 20_000,
  });
  return { today, days: cashByDay(rows) };
}

/** Kennzahlen für die Übersicht. */
export async function kioskStats(tenantId: string) {
  const start = zurichToUtc(todayZurich(), "00:00");
  const [open, openMembers, cashToday, billedIds] = await Promise.all([
    db.kioskEntry.aggregate({ where: { tenantId, userId: { not: null }, billedInvoiceId: null, paidCash: false }, _sum: { totalCents: true }, _count: { _all: true } }),
    db.kioskEntry.groupBy({ by: ["userId"], where: { tenantId, userId: { not: null }, billedInvoiceId: null, paidCash: false } }),
    db.kioskEntry.aggregate({ where: { tenantId, paidCash: true, createdAt: { gte: start } }, _sum: { totalCents: true }, _count: { _all: true } }),
    db.kioskEntry.findMany({ where: { tenantId, billedInvoiceId: { not: null } }, distinct: ["billedInvoiceId"], select: { billedInvoiceId: true } }),
  ]);
  const ids = billedIds.map((b) => b.billedInvoiceId!);
  const cancelled = ids.length ? await db.feeInvoice.findMany({ where: { tenantId, id: { in: ids }, status: "CANCELLED" }, select: { id: true } }) : [];
  const releasable = cancelled.length ? await db.kioskEntry.count({ where: { tenantId, billedInvoiceId: { in: cancelled.map((c) => c.id) } } }) : 0;
  return {
    openCents: open._sum.totalCents ?? 0,
    openCount: open._count._all,
    openMembers: openMembers.length,
    cashTodayCents: cashToday._sum.totalCents ?? 0,
    cashTodayCount: cashToday._count._all,
    releasable,
  };
}

/** Eigene Konsumationen: offene Einträge und verrechnete Rechnungen. */
export async function myKiosk(tenantId: string, userId: string) {
  const [open, billedIds, recentCash] = await Promise.all([
    db.kioskEntry.findMany({
      where: { tenantId, userId, billedInvoiceId: null, paidCash: false },
      orderBy: { createdAt: "desc" }, take: 500,
      select: { id: true, productName: true, quantity: true, unitPriceCents: true, totalCents: true, createdAt: true },
    }),
    db.kioskEntry.findMany({ where: { tenantId, userId, billedInvoiceId: { not: null } }, distinct: ["billedInvoiceId"], select: { billedInvoiceId: true } }),
    db.kioskEntry.findMany({
      where: { tenantId, userId, paidCash: true, createdAt: { gte: new Date(Date.now() - 90 * 86_400_000) } },
      orderBy: { createdAt: "desc" }, take: 50,
      select: { id: true, productName: true, quantity: true, totalCents: true, createdAt: true },
    }),
  ]);
  const ids = billedIds.map((b) => b.billedInvoiceId!);
  const invoices = ids.length
    ? await db.feeInvoice.findMany({
      where: { tenantId, userId, id: { in: ids } },
      orderBy: { issuedAt: "desc" },
      select: { id: true, number: true, categoryName: true, amountCents: true, currency: true, status: true, issuedAt: true, dueAt: true },
    })
    : [];
  return { open, openCents: sumCents(open), invoices, recentCash };
}
