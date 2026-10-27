import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PROGRAM_PRESETS } from "../src/modules/scores/presets";
import { TARGET_PRESETS } from "../src/modules/targets/presets";
import { seedDemoEvents } from "../src/modules/events/seed";

const u = new URL(process.env.DATABASE_URL ?? "mysql://standchef:standchef@127.0.0.1:3306/standchef");
const db = new PrismaClient({
  adapter: new PrismaMariaDb({ host: u.hostname, port: Number(u.port || 3306), user: decodeURIComponent(u.username), password: decodeURIComponent(u.password), database: u.pathname.slice(1), connectionLimit: 2 }),
});

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@example.ch").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "admin1234";

  const admin = await db.user.upsert({
    where: { email },
    update: { isSuperAdmin: true },
    create: { email, name: "Super Admin", passwordHash: await bcrypt.hash(password, 10), isSuperAdmin: true },
  });

  // Globale Programme (nur anlegen, wenn Name noch nicht existiert)
  for (const p of PROGRAM_PRESETS) {
    const exists = await db.program.findFirst({ where: { tenantId: null, name: p.name } });
    if (exists) continue;
    await db.program.create({
      data: { tenantId: null, createdById: admin.id, name: p.name, description: p.description ?? null, discipline: p.discipline, weaponNote: p.weaponNote ?? null, scoringMode: p.scoringMode, stagesJson: JSON.stringify(p.stages) },
    });
  }

  // Globale Scheiben
  for (const t of TARGET_PRESETS) {
    const exists = await db.targetTemplate.findFirst({ where: { tenantId: null, ownerUserId: null, name: t.name } });
    if (exists) continue;
    await db.targetTemplate.create({
      data: { tenantId: null, ownerUserId: null, name: t.name, description: t.description ?? null, subject: t.subject, paperSizes: t.paperSizes.join(","), paramsJson: JSON.stringify(t.params ?? {}) },
    });
  }

  // Demo-Verein mit zwei Mitgliedern (nur wenn SEED_DEMO=1, nie in Produktion)
  if (process.env.SEED_DEMO === "1" && process.env.NODE_ENV !== "production") {
    const demo = await db.tenant.upsert({
      where: { slug: "demo-schuetzen" },
      update: {},
      create: { slug: "demo-schuetzen", name: "Demo Schützengesellschaft", kind: "CLUB", city: "Musterhausen", canton: "ZH", joinCode: "DEMO42" },
    });
    const pw = await bcrypt.hash("demo1234", 10);
    const anna = await db.user.upsert({ where: { email: "anna@example.ch" }, update: {}, create: { email: "anna@example.ch", name: "Anna Muster", passwordHash: pw } });
    const beat = await db.user.upsert({ where: { email: "beat@example.ch" }, update: {}, create: { email: "beat@example.ch", name: "Beat Beispiel", passwordHash: pw } });
    for (const [u, role] of [[anna, "ADMIN"], [beat, "MEMBER"], [admin, "OWNER"]] as const) {
      await db.membership.upsert({ where: { userId_tenantId: { userId: u.id, tenantId: demo.id } }, update: {}, create: { userId: u.id, tenantId: demo.id, role } });
    }
    await db.tenantModule.upsert({ where: { tenantId_moduleKey: { tenantId: demo.id, moduleKey: "bookings" } }, update: { enabled: true }, create: { tenantId: demo.id, moduleKey: "bookings", enabled: true } });
    await db.bookingSettings.upsert({
      where: { tenantId: demo.id },
      update: {},
      create: {
        tenantId: demo.id,
        durationOptionsJson: JSON.stringify([{ minutes: 30, priceCents: 1000 }, { minutes: 60, priceCents: 1800 }, { minutes: 90, priceCents: 2500 }]),
        openingHoursJson: JSON.stringify({ "0": [], "1": [["08:00", "22:00"]], "2": [["08:00", "22:00"]], "3": [["08:00", "22:00"]], "4": [["08:00", "22:00"]], "5": [["08:00", "22:00"]], "6": [["08:00", "18:00"]] }),
        lastMinuteDiscountPercent: 20,
        lastMinuteWindowHours: 24,
        minLeadMinutes: 0,
      },
    });
    if ((await db.resource.count({ where: { tenantId: demo.id } })) === 0) {
      await db.resource.createMany({
        data: [
          { tenantId: demo.id, name: "25 m Stand", kind: "RANGE", capacity: 4, description: "4 Scheiben, Pistole", sortOrder: 0 },
          { tenantId: demo.id, name: "Indoor Bahn 1", kind: "LANE", capacity: 1, description: "1–20 m, Hindernisse möglich", sortOrder: 1 },
          { tenantId: demo.id, name: "Indoor Bahn 2", kind: "LANE", capacity: 1, sortOrder: 2 },
        ],
      });
    }
    await db.tenantModule.upsert({ where: { tenantId_moduleKey: { tenantId: demo.id, moduleKey: "billing" } }, update: { enabled: true }, create: { tenantId: demo.id, moduleKey: "billing", enabled: true } });
    await db.billingProfile.upsert({
      where: { tenantId: demo.id },
      update: {},
      create: { tenantId: demo.id, payeeName: "Demo Schützengesellschaft", payeeStreet: "Schützenstrasse 1", payeeZip: "8000", payeeCity: "Musterhausen", iban: "CH9300762011623852957" },
    });
    if ((await db.feeCategory.count({ where: { tenantId: demo.id } })) === 0) {
      const [aktiv, passiv] = await Promise.all([
        db.feeCategory.create({ data: { tenantId: demo.id, name: "Aktivmitglied", amountCents: 15000, sortOrder: 0 } }),
        db.feeCategory.create({ data: { tenantId: demo.id, name: "Passivmitglied", amountCents: 5000, sortOrder: 1 } }),
      ]);
      await db.feeCategory.create({ data: { tenantId: demo.id, name: "Jungschütze", amountCents: 0, description: "beitragsfrei", sortOrder: 2 } });
      await db.membership.updateMany({ where: { tenantId: demo.id, userId: anna.id }, data: { feeCategoryId: aktiv.id, memberNumber: "1001" } });
      await db.membership.updateMany({ where: { tenantId: demo.id, userId: beat.id }, data: { feeCategoryId: passiv.id, memberNumber: "1002" } });
      await db.user.update({ where: { id: beat.id }, data: { street: "Bahnhofstrasse 12", zip: "8001", city: "Zürich" } });
    }
    await seedDemoEvents(db, demo.id, anna.id, [anna.id, beat.id, admin.id]);
    console.log("Demo-Verein: Beitrittscode DEMO42 · anna@example.ch / beat@example.ch (Passwort demo1234)");
  }

  console.log(`Super-Admin: ${email} (Passwort aus SEED_ADMIN_PASSWORD)`);
}

main().finally(() => db.$disconnect());
