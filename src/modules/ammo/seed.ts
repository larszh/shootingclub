/**
 * Demo-Munition für den Seed (prisma/seed.ts). Bewusst nur relative Imports und kein
 * "server-only", damit tsx das Skript ausserhalb von Next.js ausführen kann. Idempotent:
 * Einstellungen nur anlegen, wenn keine existieren; Produkte nur, wenn der Verein noch keine hat.
 */
import type { PrismaClient } from "../../generated/prisma/client";

type Db = Pick<PrismaClient, "ammoSettings" | "ammoProduct">;

const PRODUCTS = [
  { name: "GP 11 Ordonnanz", caliber: "7.5 × 55 GP 11", manufacturer: "RUAG Ammotec", unitLabel: "Schachtel", roundsPerUnit: 60, priceCents: 3000, stockUnits: 40, sortOrder: 1, description: "Ordonnanzmunition für Karabiner und Stgw 57." },
  { name: "GP 90 Ordonnanz", caliber: "5.6 × 45 GP 90", manufacturer: "RUAG Ammotec", unitLabel: "Packung", roundsPerUnit: 20, priceCents: 700, stockUnits: 120, sortOrder: 1, description: "Für Stgw 90." },
  { name: "Pistolenmunition FMJ", caliber: "9 mm Luger", manufacturer: "Geco", unitLabel: "Schachtel", roundsPerUnit: 50, priceCents: 2200, stockUnits: 30, sortOrder: 1, description: null },
  { name: "Kleinkaliber Standard", caliber: ".22 lr", manufacturer: "SK", unitLabel: "Schachtel", roundsPerUnit: 50, priceCents: 900, stockUnits: 60, sortOrder: 1, description: null },
  { name: "Luftgewehr-Diabolos", caliber: "4.5 mm Diabolo", manufacturer: "RWS", unitLabel: "Dose", roundsPerUnit: 500, priceCents: 1400, stockUnits: null, sortOrder: 1, description: "Für Luftgewehr und Luftpistole 10 m." },
];

export async function seedDemoAmmo(db: Db, tenantId: string) {
  const existingSettings = await db.ammoSettings.findUnique({ where: { tenantId } });
  if (!existingSettings) {
    await db.ammoSettings.create({
      data: {
        tenantId,
        onSiteOnly: true,
        requireIdCheck: true,
        approvalRequired: false,
        invoicePrefix: "MU-",
        invoiceDueDays: 30,
        maxRoundsPerOrder: 600,
        note: "Bestellte Munition liegt beim nächsten Training im Schützenhaus bereit. Bitte amtlichen Ausweis mitnehmen.",
      },
    });
  }
  if ((await db.ammoProduct.count({ where: { tenantId } })) > 0) return { created: 0, skipped: true };
  await db.ammoProduct.createMany({ data: PRODUCTS.map((p) => ({ ...p, tenantId, isActive: true })) });
  return { created: PRODUCTS.length, skipped: false };
}

type StockDb = Pick<PrismaClient, "ammoProduct" | "ammoStockMovement">;

/**
 * Demo-Munitionskontrolle: Finanzierungsart der Ordonnanzmunition und ein paar Journalbuchungen
 * (Anfangsbestand, Wareneingang Bund, Abgabe am Stand). Idempotent: nur, wenn der Verein noch keine
 * Bestandsbewegungen hat. Der Bestand bleibt unverändert, die Buchungen sind so gewählt, dass sie zum
 * aktuellen Bestand passen (Anfangsbestand + Eingang − Abgabe = Bestand).
 */
export async function seedDemoAmmoStock(db: StockDb, tenantId: string, userIds: string[] = []) {
  if ((await db.ammoStockMovement.count({ where: { tenantId } })) > 0) return { created: 0, skipped: true };
  const products = await db.ammoProduct.findMany({ where: { tenantId }, select: { id: true, caliber: true, stockUnits: true } });
  const by = userIds[0] ?? null;
  const now = Date.now();
  const DAY = 86_400_000;
  let created = 0;
  for (const p of products) {
    const funding = p.caliber.includes("GP 90") ? "SUBSIDIZED" : p.caliber.includes("GP 11") ? "FEDERAL_FREE" : null;
    if (funding) await db.ammoProduct.updateMany({ where: { id: p.id, tenantId }, data: { fundingType: funding } });
    if (p.stockUnits === null || p.stockUnits <= 0) continue;
    const stock = p.stockUnits;
    const receipt = funding ? Math.max(1, Math.floor(stock / 2)) : 0;
    const issue = funding ? Math.min(receipt, Math.floor(stock / 4)) : 0;
    const opening = stock - receipt + issue;
    const rows = [
      { kind: "CORRECTION", units: opening, date: new Date(now - 90 * DAY), source: null, note: "Anfangsbestand" },
      ...(receipt ? [{ kind: "RECEIPT", units: receipt, date: new Date(now - 40 * DAY), source: funding === "FEDERAL_FREE" ? "Bund, Lieferschein DEMO-1" : "Bund (verbilligt), Lieferschein DEMO-2", note: null }] : []),
      ...(issue ? [{ kind: "ISSUE", units: -issue, date: new Date(now - 20 * DAY), source: "Obligatorisch (Demo)", note: null }] : []),
    ];
    await db.ammoStockMovement.createMany({ data: rows.map((r) => ({ ...r, tenantId, productId: p.id, createdById: by })) });
    created += rows.length;
  }
  return { created, skipped: false };
}
