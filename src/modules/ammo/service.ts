import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { createQrReference, isQrIban, numericPrefixFrom } from "@/lib/qr-reference";
import { zurichParts } from "@/lib/time";
import { tenantQrIban } from "@/modules/billing/reference";
import { dueDateInDays } from "@/modules/billing/dates";
import { AMMO_REFERENCE_KIND_DIGIT, DEFAULT_SETTINGS, OPEN_ORDER_STATUSES, type AmmoSettingsView } from "./types";

type Tx = Prisma.TransactionClient;

export class AmmoError extends Error {}

export function isUniqueViolation(e: unknown) {
  return typeof e === "object" && e !== null && (e as { code?: unknown }).code === "P2002";
}

/** Unique-Verletzung oder Schreibkonflikt/Deadlock (MariaDB) – beides lohnt einen neuen Versuch. */
function isRetryable(e: unknown) {
  const code = typeof e === "object" && e !== null ? (e as { code?: unknown }).code : undefined;
  return code === "P2002" || code === "P2034";
}

export async function getAmmoSettings(tenantId: string): Promise<AmmoSettingsView> {
  const s = await db.ammoSettings.findUnique({ where: { tenantId } });
  if (!s) return { ...DEFAULT_SETTINGS };
  return {
    onSiteOnly: s.onSiteOnly,
    requireIdCheck: s.requireIdCheck,
    approvalRequired: s.approvalRequired,
    invoicePrefix: s.invoicePrefix,
    invoiceDueDays: s.invoiceDueDays,
    maxRoundsPerOrder: s.maxRoundsPerOrder,
    note: s.note,
  };
}

/** Einheiten pro Produkt, die in offenen (noch nicht ausgegebenen) Bestellungen reserviert sind. */
export async function reservedUnits(tenantId: string, client: Tx | typeof db = db, exceptOrderId?: string) {
  const rows = await client.ammoOrderItem.groupBy({
    by: ["productId"],
    where: { productId: { not: null }, order: { tenantId, status: { in: OPEN_ORDER_STATUSES }, ...(exceptOrderId ? { NOT: { id: exceptOrderId } } : {}) } },
    _sum: { quantity: true },
  });
  const map = new Map<string, number>();
  for (const r of rows) if (r.productId) map.set(r.productId, r._sum.quantity ?? 0);
  return map;
}

// --- Rechnungsnummer ----------------------------------------------------------

/** Höchste laufende Nummer eines Jahres mit Präfix, z.B. «MU-2026-0042» → 42. */
async function highestSequence(tx: Tx, tenantId: string, stem: string) {
  const rows = await tx.ammoOrder.findMany({ where: { tenantId, invoiceNumber: { startsWith: stem } }, select: { invoiceNumber: true } });
  let max = 0;
  for (const r of rows) {
    const n = Number((r.invoiceNumber ?? "").slice(stem.length));
    if (Number.isInteger(n) && n > max) max = n;
  }
  return max;
}

export async function nextInvoiceNumber(tx: Tx, tenantId: string, prefix: string, at: Date, offset = 0) {
  const year = zurichParts(at).dateStr.slice(0, 4);
  const stem = `${prefix}${year}-`;
  const seq = (await highestSequence(tx, tenantId, stem)) + 1 + offset;
  return `${stem}${String(seq).padStart(4, "0")}`;
}

// --- QR-Referenz ----------------------------------------------------------------

/**
 * QR-Referenz einer Munitionsrechnung, gleich aufgebaut wie bei Reservationen und Beiträgen
 * (src/modules/billing/reference.ts), aber mit Art-Ziffer 3:
 *   6 Stellen Vereinskennzahl · «3» · Ausweichziffer · 18 Stellen Ziffern der Rechnungsnummer.
 */
export function ammoReferenceBase(tenantId: string, invoiceNumber: string, attempt = 0) {
  const digits = invoiceNumber.replace(/\D/g, "").slice(-18).padStart(18, "0");
  return `${numericPrefixFrom(tenantId, 6)}${AMMO_REFERENCE_KIND_DIGIT}${attempt % 10}${digits}`;
}

/**
 * Vergibt der Rechnung eine QR-Referenz, falls das Rechnungsprofil eine QR-IBAN hat und noch keine
 * vorhanden ist. Gibt die (bestehende oder neue) Referenz zurück, sonst null.
 */
export async function ensureAmmoReference(order: { id: string; tenantId: string; invoiceNumber: string | null; reference: string | null }, qrIban?: string | null) {
  if (order.reference || !order.invoiceNumber) return order.reference;
  const iban = qrIban === undefined ? await tenantQrIban(order.tenantId) : qrIban && isQrIban(qrIban) ? qrIban : null;
  if (!iban) return null;
  for (let attempt = 0; attempt < 10; attempt++) {
    const reference = createQrReference(ammoReferenceBase(order.tenantId, order.invoiceNumber, attempt));
    const taken = await db.ammoOrder.findFirst({ where: { tenantId: order.tenantId, reference, NOT: { id: order.id } }, select: { id: true } });
    if (taken) continue;
    // Nur setzen, wenn noch keine Referenz da ist (parallele Aufrufe).
    await db.ammoOrder.updateMany({ where: { id: order.id, tenantId: order.tenantId, reference: null }, data: { reference } });
    const fresh = await db.ammoOrder.findUnique({ where: { id: order.id }, select: { reference: true } });
    return fresh?.reference ?? reference;
  }
  console.error("Munition: keine eindeutige QR-Referenz gefunden.");
  return null;
}

// --- Ausgabe ------------------------------------------------------------------------

/**
 * Gibt eine Bestellung aus: Status ISSUED, Bestand atomar abbuchen (nie unter null), Rechnung mit
 * fortlaufender Nummer anlegen (fällig nach invoiceDueDays). Alles in einer Transaktion; kollidiert die
 * Rechnungsnummer mit einer parallel vergebenen, wird die ganze Transaktion wiederholt.
 *
 * Entscheid: Die Rechnung entsteht bei der Ausgabe (nicht bei der Bestellung), weil erst dann feststeht,
 * dass die Ware tatsächlich abgegeben wurde. Stornierte Bestellungen erhalten so nie eine Nummer.
 */
export async function issueOrder(tenantId: string, orderId: string, issuedById: string, idChecked: boolean) {
  const settings = await getAmmoSettings(tenantId);
  if (settings.requireIdCheck && !idChecked) throw new AmmoError("Bitte zuerst die Berechtigung prüfen und bestätigen.");

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const done = await db.$transaction(async (tx) => {
        const order = await tx.ammoOrder.findFirst({ where: { id: orderId, tenantId }, include: { items: true } });
        if (!order) throw new AmmoError("Bestellung nicht gefunden.");
        if (!OPEN_ORDER_STATUSES.includes(order.status as (typeof OPEN_ORDER_STATUSES)[number])) {
          throw new AmmoError(order.status === "ISSUED" ? "Diese Bestellung wurde bereits ausgegeben." : "Diese Bestellung ist storniert.");
        }
        const now = new Date();
        const withInvoice = order.totalCents > 0;
        // Bei einer Kollision (parallel vergebene Nummer) liest der nächste Versuch die Nummern neu.
        const invoiceNumber = withInvoice ? await nextInvoiceNumber(tx, tenantId, settings.invoicePrefix, now) : null;

        // Statuswechsel nur, wenn die Bestellung noch offen ist (schützt vor doppelter Ausgabe).
        const claimed = await tx.ammoOrder.updateMany({
          where: { id: order.id, tenantId, status: { in: OPEN_ORDER_STATUSES } },
          data: {
            status: "ISSUED",
            issuedAt: now,
            issuedById,
            idChecked,
            ...(withInvoice ? { invoiceNumber, invoiceIssuedAt: now, dueAt: dueDateInDays(settings.invoiceDueDays), paymentStatus: "UNPAID" } : { paymentStatus: "PAID", paidAt: now, paymentNote: "Kein Betrag" }),
          },
        });
        if (claimed.count === 0) throw new AmmoError("Diese Bestellung wurde bereits bearbeitet.");

        // Bestand abbuchen: nur Produkte mit geführtem Bestand, nie unter null.
        const perProduct = new Map<string, number>();
        for (const it of order.items) if (it.productId) perProduct.set(it.productId, (perProduct.get(it.productId) ?? 0) + it.quantity);
        for (const [productId, qty] of perProduct) {
          const p = await tx.ammoProduct.findFirst({ where: { id: productId, tenantId }, select: { name: true, stockUnits: true } });
          if (!p || p.stockUnits === null) continue;
          const res = await tx.ammoProduct.updateMany({ where: { id: productId, tenantId, stockUnits: { gte: qty } }, data: { stockUnits: { decrement: qty } } });
          if (res.count === 0) throw new AmmoError(`Zu wenig an Lager: «${p.name}» (noch ${p.stockUnits}).`);
        }
        return { id: order.id, tenantId, invoiceNumber, reference: null as string | null };
      });
      if (done.invoiceNumber) {
        // Die Ausgabe ist gebucht; eine fehlende Referenz wird spätestens beim Rechnungsdruck nachgeholt.
        try {
          done.reference = await ensureAmmoReference(done);
        } catch (e) {
          console.error("Munition: QR-Referenz konnte nicht vergeben werden", e);
        }
      }
      return done;
    } catch (e) {
      if (e instanceof AmmoError) throw e;
      if (isRetryable(e) && attempt < 4) continue;
      throw e;
    }
  }
  throw new AmmoError("Die Rechnungsnummer konnte nicht vergeben werden. Bitte nochmals versuchen.");
}

// --- Bestellung anlegen -----------------------------------------------------------

export type NewOrderLine = { productId: string; quantity: number };

/**
 * Prüft Positionen (aktive Produkte des Vereins, Limit pro Bestellung, verfügbarer Bestand) und legt
 * die Bestellung mit Preis-Snapshot an.
 */
export async function createOrder(tenantId: string, userId: string, lines: NewOrderLine[], note: string | null, opts?: { status?: "ORDERED" | "APPROVED" }) {
  const wanted = new Map<string, number>();
  for (const l of lines) if (l.quantity > 0) wanted.set(l.productId, (wanted.get(l.productId) ?? 0) + l.quantity);
  if (wanted.size === 0) throw new AmmoError("Bitte mindestens eine Position wählen.");

  const settings = await getAmmoSettings(tenantId);
  const [products, billing] = await Promise.all([
    db.ammoProduct.findMany({ where: { tenantId, id: { in: [...wanted.keys()] } } }),
    db.billingProfile.findUnique({ where: { tenantId }, select: { currency: true } }),
  ]);
  const byId = new Map(products.map((p) => [p.id, p]));

  let rounds = 0;
  let total = 0;
  const items: Prisma.AmmoOrderItemCreateWithoutOrderInput[] = [];
  for (const [productId, qty] of wanted) {
    const p = byId.get(productId);
    if (!p || !p.isActive) throw new AmmoError("Ein Produkt ist nicht mehr erhältlich. Bitte Seite neu laden.");
    rounds += qty * p.roundsPerUnit;
    total += qty * p.priceCents;
    items.push({
      product: { connect: { id: p.id } },
      productName: p.name,
      caliber: p.caliber,
      unitLabel: p.unitLabel,
      roundsPerUnit: p.roundsPerUnit,
      quantity: qty,
      unitPriceCents: p.priceCents,
      totalCents: qty * p.priceCents,
    });
  }
  if (settings.maxRoundsPerOrder && rounds > settings.maxRoundsPerOrder) {
    throw new AmmoError(`Höchstens ${settings.maxRoundsPerOrder} Schuss pro Bestellung (gewählt: ${rounds}).`);
  }

  const reserved = await reservedUnits(tenantId);
  for (const [productId, qty] of wanted) {
    const p = byId.get(productId)!;
    if (p.stockUnits === null) continue;
    const available = p.stockUnits - (reserved.get(productId) ?? 0);
    if (qty > available) throw new AmmoError(`«${p.name}»: nur noch ${Math.max(0, available)} ${p.unitLabel} verfügbar.`);
  }

  // Mit Freigabe-Pflicht wartet die Bestellung auf ORDERED, bis ein Admin sie freigibt; ohne geht sie
  // direkt an die Ausgabe (ORDERED → ISSUED).
  const status = opts?.status ?? "ORDERED";
  return db.ammoOrder.create({
    data: { tenantId, userId, status, totalCents: total, currency: billing?.currency ?? "CHF", note, items: { create: items } },
    select: { id: true },
  });
}
