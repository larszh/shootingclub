/**
 * Demo-Vereinswaffen für den Seed (prisma/seed.ts). Nur relative Imports und kein "server-only".
 * Idempotent: legt nur etwas an, wenn der Verein noch keine Vereinswaffen hat. Die Einstellungen
 * (WeaponSettings) werden nur angelegt, wenn sie fehlen; ein alter Sperrgrund in den Notizen wird ins
 * eigene Feld übernommen.
 */
import type { PrismaClient } from "../../generated/prisma/client";

type Db = Pick<PrismaClient, "clubWeapon" | "weaponLoan" | "weaponService" | "weaponSettings">;

const DAY = 86_400_000;

function dbDate(daysFromToday: number) {
  const d = new Date(Date.now() + daysFromToday * DAY);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

const LEGACY_PREFIX = "Sperrgrund: ";

export async function seedDemoWeapons(db: Db, tenantId: string, userIds: string[]) {
  // Beispielwerte, bitte beim Kanton bzw. Hersteller prüfen.
  await db.weaponSettings.upsert({ where: { tenantId }, create: { tenantId, minorReportDays: 30, serviceEveryShotsDefault: 2000 }, update: {} });
  // Demo-Daten aus früheren Versionen: Sperrgrund aus der ersten Notizzeile ins eigene Feld übernehmen.
  const legacy = await db.clubWeapon.findMany({ where: { tenantId, status: "BLOCKED", blockReason: null, notes: { startsWith: LEGACY_PREFIX } }, select: { id: true, notes: true } });
  for (const w of legacy) {
    const [first = "", ...rest] = (w.notes ?? "").split("\n");
    await db.clubWeapon.update({ where: { id: w.id }, data: { blockReason: first.slice(LEGACY_PREFIX.length).trim().slice(0, 191) || null, notes: rest.join("\n").trim() || null } });
  }
  if ((await db.clubWeapon.count({ where: { tenantId } })) > 0) return { created: 0, skipped: true };
  const [adminId, memberId] = [userIds[0] ?? null, userIds[1] ?? userIds[0] ?? null];

  const stgw = await db.clubWeapon.create({
    data: { tenantId, name: "Stgw 90 Nr. 1", discipline: "Gewehr 300 m", manufacturer: "SIG", model: "Stgw 90", caliber: "5.6 × 45", serialNumber: "DEMO-90-001", shotCount: 1840, serviceEveryShots: 2000, nextServiceAt: dbDate(120) },
  });
  const stgw2 = await db.clubWeapon.create({
    data: { tenantId, name: "Stgw 90 Nr. 2", discipline: "Gewehr 300 m", manufacturer: "SIG", model: "Stgw 90", caliber: "5.6 × 45", serialNumber: "DEMO-90-002", shotCount: 2310, serviceEveryShots: 2000, status: "SERVICE" },
  });
  const pistol = await db.clubWeapon.create({
    data: { tenantId, name: "Sportpistole SP 1", discipline: "Pistole 25 m", manufacturer: "Walther", model: "GSP", caliber: ".22 lr", serialNumber: "DEMO-SP-001", shotCount: 5400, serviceEveryShots: 10000, status: "LOANED" },
  });
  await db.clubWeapon.create({
    data: { tenantId, name: "Luftgewehr LG 1", discipline: "Gewehr 10 m", manufacturer: "Feinwerkbau", model: "800", caliber: "4.5 mm", serialNumber: "DEMO-LG-001", shotCount: 12000, nextServiceAt: dbDate(-3) },
  });
  await db.clubWeapon.create({
    data: { tenantId, name: "Karabiner K31", discipline: "Gewehr 300 m", manufacturer: "W+F Bern", model: "K31", caliber: "7.5 × 55", serialNumber: "DEMO-K31-001", shotCount: 800, status: "BLOCKED", blockReason: "Abzug klemmt, beim Büchsenmacher", notes: "Erbstück, Schenkung 2019" },
  });

  await db.weaponService.createMany({
    data: [
      { weaponId: stgw.id, date: dbDate(-200), kind: "SERVICE", note: "Gereinigt, Verschluss kontrolliert", costCents: null, byName: "Waffenwart" },
      { weaponId: stgw2.id, date: dbDate(-400), kind: "INSPECTION", note: "Jahreskontrolle", costCents: 4500, byName: "Büchsenmacher" },
    ],
  });

  const now = Date.now();
  await db.weaponLoan.create({
    data: { tenantId, weaponId: stgw.id, userId: memberId, borrowerName: null, isMinor: false, onSiteOnly: true, loanedAt: new Date(now - 10 * DAY), returnedAt: new Date(now - 10 * DAY + 3 * 3_600_000), shots: 60, issuedById: adminId, note: "Training" },
  });
  await db.weaponLoan.create({
    data: { tenantId, weaponId: pistol.id, userId: null, borrowerName: "Lea Muster (Jungschützin)", isMinor: true, onSiteOnly: true, loanedAt: new Date(now - 27 * DAY), dueAt: new Date(now - DAY), issuedById: adminId, reportDueAt: new Date(now + 3 * DAY), note: "Jungschützenkurs" },
  });
  return { created: 5, skipped: false };
}
