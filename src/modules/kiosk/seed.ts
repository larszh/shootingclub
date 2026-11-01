/**
 * Demo-Daten Schützenstube für den Seed (prisma/seed.ts).
 * Nur relative Imports und kein "server-only". Idempotent: legt nur etwas an, wenn der Verein
 * noch keine Produkte der Schützenstube hat.
 */
import type { PrismaClient } from "../../generated/prisma/client";

type Db = Pick<PrismaClient, "kioskProduct" | "kioskEntry">;

const DAY = 86_400_000;
const HOUR = 3_600_000;

const PRODUCTS = [
  { name: "Bier 3 dl", category: "Getränke", priceCents: 450, sortOrder: 1 },
  { name: "Mineral 5 dl", category: "Getränke", priceCents: 350, sortOrder: 2 },
  { name: "Süssgetränk 5 dl", category: "Getränke", priceCents: 400, sortOrder: 3 },
  { name: "Kaffee", category: "Warme Getränke", priceCents: 300, sortOrder: 10 },
  { name: "Kaffee Schnaps", category: "Warme Getränke", priceCents: 500, sortOrder: 11 },
  { name: "Bratwurst mit Brot", category: "Essen", priceCents: 800, sortOrder: 20 },
  { name: "Schützenplättli", category: "Essen", priceCents: 1400, sortOrder: 21 },
  { name: "Nussgipfel", category: "Snacks", priceCents: 250, sortOrder: 30 },
  { name: "Chips", category: "Snacks", priceCents: 300, sortOrder: 31 },
  { name: "Gehörschutz (Paar)", category: "Material", priceCents: 100, sortOrder: 40 },
];

export async function seedDemoKiosk(db: Db, tenantId: string, userIds: string[]) {
  if ((await db.kioskProduct.count({ where: { tenantId } })) > 0) return { created: 0, skipped: true };
  const sellerId = userIds[0] ?? null;
  const members = userIds.length ? userIds : [];

  const products: Array<{ id: string; name: string; priceCents: number }> = [];
  for (const p of PRODUCTS) products.push(await db.kioskProduct.create({ data: { tenantId, ...p, isActive: true } }));
  await db.kioskProduct.create({ data: { tenantId, name: "Glühwein (Winter)", category: "Warme Getränke", priceCents: 500, sortOrder: 12, isActive: false } });

  const pick = (i: number) => products[i % products.length]!;
  const now = Date.now();
  const rows: Array<{ userId: string | null; guestName: string | null; productIndex: number; quantity: number; at: Date; paidCash: boolean }> = [];
  // Auf Rechnung: verteilt über die letzten 40 Tage (ein Teil fällt in den Vormonat)
  members.forEach((userId, mi) => {
    for (let k = 0; k < 6; k++) {
      rows.push({ userId, guestName: null, productIndex: mi * 3 + k * 2, quantity: 1 + ((mi + k) % 3), at: new Date(now - (3 + k * 6 + mi) * DAY - 6 * HOUR), paidCash: false });
    }
  });
  // Bar: Gäste heute und gestern, dazu ein Mitglied bar
  rows.push({ userId: null, guestName: "Gastschütze Muster", productIndex: 0, quantity: 2, at: new Date(now - 2 * HOUR), paidCash: true });
  rows.push({ userId: null, guestName: null, productIndex: 5, quantity: 1, at: new Date(now - 90 * 60_000), paidCash: true });
  rows.push({ userId: null, guestName: null, productIndex: 3, quantity: 3, at: new Date(now - DAY - HOUR), paidCash: true });
  if (members[1]) rows.push({ userId: members[1], guestName: null, productIndex: 1, quantity: 1, at: new Date(now - DAY), paidCash: true });

  await db.kioskEntry.createMany({
    data: rows.map((r) => {
      const p = pick(r.productIndex);
      return {
        tenantId, userId: r.userId, guestName: r.guestName, productId: p.id, productName: p.name, quantity: r.quantity,
        unitPriceCents: p.priceCents, totalCents: p.priceCents * r.quantity, createdById: sellerId, clientId: null, paidCash: r.paidCash, createdAt: r.at,
      };
    }),
  });
  return { created: products.length + rows.length, skipped: false };
}
