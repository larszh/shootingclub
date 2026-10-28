import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { getAmmoSettings, reservedUnits } from "./service";
import { invoiceTitle, OPEN_ORDER_STATUSES, type ShopProduct } from "./types";

export { getAmmoSettings };

/** Aktive Produkte für Shop und Ausgabe, mit verfügbarem Bestand (Lager minus offene Bestellungen). */
export async function listShopProducts(tenantId: string): Promise<ShopProduct[]> {
  const [products, reserved] = await Promise.all([
    db.ammoProduct.findMany({ where: { tenantId, isActive: true }, orderBy: [{ caliber: "asc" }, { sortOrder: "asc" }, { name: "asc" }] }),
    reservedUnits(tenantId),
  ]);
  return products.map((p) => ({
    id: p.id, name: p.name, caliber: p.caliber, manufacturer: p.manufacturer, description: p.description, unitLabel: p.unitLabel,
    roundsPerUnit: p.roundsPerUnit, priceCents: p.priceCents,
    available: p.stockUnits === null ? null : Math.max(0, p.stockUnits - (reserved.get(p.id) ?? 0)),
  }));
}

/** Alle Produkte (Verwaltung), mit reservierten Einheiten. */
export async function listAllProducts(tenantId: string) {
  const [products, reserved] = await Promise.all([
    db.ammoProduct.findMany({ where: { tenantId }, orderBy: [{ isActive: "desc" }, { caliber: "asc" }, { sortOrder: "asc" }, { name: "asc" }] }),
    reservedUnits(tenantId),
  ]);
  return products.map((p) => ({ ...p, reserved: reserved.get(p.id) ?? 0 }));
}

const orderInclude = {
  items: { orderBy: { caliber: "asc" } },
  user: { select: { id: true, name: true, email: true, avatarPath: true, updatedAt: true } },
  issuedBy: { select: { name: true } },
} satisfies Prisma.AmmoOrderInclude;

export type AmmoOrderWithItems = Prisma.AmmoOrderGetPayload<{ include: typeof orderInclude }>;

export async function listMyOrders(tenantId: string, userId: string) {
  return db.ammoOrder.findMany({ where: { tenantId, userId }, include: orderInclude, orderBy: { createdAt: "desc" }, take: 50 });
}

export type OrderFilter = "open" | "approved" | "issued" | "cancelled" | "unpaid" | "all";

export function filterWhere(filter: OrderFilter): Prisma.AmmoOrderWhereInput {
  switch (filter) {
    case "open": return { status: "ORDERED" };
    case "approved": return { status: "APPROVED" };
    case "issued": return { status: "ISSUED" };
    case "cancelled": return { status: "CANCELLED" };
    case "unpaid": return { status: "ISSUED", paymentStatus: "UNPAID", invoiceNumber: { not: null } };
    default: return {};
  }
}

export async function listOrders(tenantId: string, filter: OrderFilter, q?: string) {
  const search = q?.trim();
  return db.ammoOrder.findMany({
    where: {
      tenantId,
      ...filterWhere(filter),
      ...(search ? { OR: [{ invoiceNumber: { contains: search } }, { user: { name: { contains: search } } }, { user: { email: { contains: search } } }] } : {}),
    },
    include: orderInclude,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function orderCounts(tenantId: string) {
  const [byStatus, unpaid] = await Promise.all([
    db.ammoOrder.groupBy({ by: ["status"], where: { tenantId }, _count: { _all: true } }),
    db.ammoOrder.aggregate({ where: { tenantId, ...filterWhere("unpaid") }, _count: { _all: true }, _sum: { totalCents: true } }),
  ]);
  const c = (s: string) => byStatus.find((b) => b.status === s)?._count._all ?? 0;
  return {
    open: c("ORDERED"), approved: c("APPROVED"), issued: c("ISSUED"), cancelled: c("CANCELLED"),
    all: byStatus.reduce((a, b) => a + b._count._all, 0),
    unpaid: unpaid._count._all, unpaidCents: unpaid._sum.totalCents ?? 0,
  };
}

export async function getOrder(tenantId: string, id: string) {
  return db.ammoOrder.findFirst({ where: { id, tenantId }, include: orderInclude });
}

/** Mitglieder des Vereins für die Ausgabe (Suche), mit ihren offenen Bestellungen. */
export async function counterData(tenantId: string) {
  const [members, open] = await Promise.all([
    db.membership.findMany({
      where: { tenantId },
      select: { memberNumber: true, user: { select: { id: true, name: true, email: true, avatarPath: true, updatedAt: true } } },
      orderBy: { user: { name: "asc" } },
    }),
    db.ammoOrder.findMany({ where: { tenantId, status: { in: OPEN_ORDER_STATUSES }, userId: { not: null } }, include: { items: true }, orderBy: { createdAt: "asc" } }),
  ]);
  return { members, open };
}

// --- Exporte für Zahlungsübersicht und Bankimport ----------------------------------------

export type AmmoInvoiceSummary = {
  id: string;
  number: string;
  reference: string | null;
  amountCents: number;
  currency: string;
  dueAt: Date | null;
  /** OPEN (unbezahlt) | PAID | CANCELLED – gleiche Werte wie bei Beitragsrechnungen */
  status: "OPEN" | "PAID" | "CANCELLED";
  paidAt: Date | null;
  issuedAt: Date | null;
  title: string;
};

type InvoiceRow = { id: string; invoiceNumber: string | null; reference: string | null; totalCents: number; currency: string; dueAt: Date | null; paymentStatus: string; paidAt: Date | null; invoiceIssuedAt: Date | null };

const invoiceSelect = { id: true, invoiceNumber: true, reference: true, totalCents: true, currency: true, dueAt: true, paymentStatus: true, paidAt: true, invoiceIssuedAt: true } satisfies Prisma.AmmoOrderSelect;

function toSummary(o: InvoiceRow): AmmoInvoiceSummary {
  return {
    id: o.id,
    number: o.invoiceNumber ?? "",
    reference: o.reference,
    amountCents: o.totalCents,
    currency: o.currency,
    dueAt: o.dueAt,
    status: o.paymentStatus === "PAID" ? "PAID" : o.paymentStatus === "CANCELLED" ? "CANCELLED" : "OPEN",
    paidAt: o.paidAt,
    issuedAt: o.invoiceIssuedAt,
    title: invoiceTitle(o.invoiceNumber),
  };
}

/** Alle Munitionsrechnungen eines Mitglieds im Verein (neueste zuerst). */
export async function listAmmoInvoicesForUser(userId: string, tenantId: string): Promise<AmmoInvoiceSummary[]> {
  const rows = await db.ammoOrder.findMany({
    where: { tenantId, userId, invoiceNumber: { not: null } },
    select: invoiceSelect,
    orderBy: { invoiceIssuedAt: "desc" },
  });
  return rows.map(toSummary);
}

/** Alle offenen (unbezahlten) Munitionsrechnungen des Vereins, z.B. für den camt-Bankimport. */
export async function listOpenAmmoInvoices(tenantId: string): Promise<AmmoInvoiceSummary[]> {
  const rows = await db.ammoOrder.findMany({
    where: { tenantId, status: "ISSUED", paymentStatus: "UNPAID", invoiceNumber: { not: null } },
    select: invoiceSelect,
    orderBy: { invoiceIssuedAt: "asc" },
  });
  return rows.map(toSummary);
}
