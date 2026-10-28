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
