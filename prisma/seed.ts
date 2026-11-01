import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PROGRAM_PRESETS, presetNames, presetOfficialUpdate } from "../src/modules/scores/presets";
import { recomputeProgramPasses } from "../src/modules/scores/pass-recompute";
import { TARGET_PRESETS } from "../src/modules/targets/presets";
import { seedDemoEvents } from "../src/modules/events/seed";
import { seedDemoFiles } from "../src/modules/files/seed";
import { seedDemoChat } from "../src/modules/chat/seed";
import { seedDemoAmmo, seedDemoAmmoStock } from "../src/modules/ammo/seed";
import { seedDemoFederal } from "../src/modules/federal/seed";
import { seedDemoRange } from "../src/modules/range/seed";
import { seedDemoWeapons } from "../src/modules/weapons/seed";
import { seedDemoShifts } from "../src/modules/shifts/seed";
import { seedDemoCourses } from "../src/modules/courses/seed";
import { seedDemoChampionship } from "../src/modules/championship/seed";
import { seedDemoAccounting } from "../src/modules/accounting/seed";
import { seedDemoEmbed } from "../src/modules/embed/seed";
import { seedDemoSharing } from "../src/modules/sharing/seed";
import { seedDemoKiosk } from "../src/modules/kiosk/seed";
import { seedDemoScoreImport } from "../src/modules/scores/import/seed";

const u = new URL(process.env.DATABASE_URL ?? "mysql://standchef:standchef@127.0.0.1:3306/standchef");
const db = new PrismaClient({
  adapter: new PrismaMariaDb({ host: u.hostname, port: Number(u.port || 3306), user: decodeURIComponent(u.username), password: decodeURIComponent(u.password), database: u.pathname.slice(1), connectionLimit: 2 }),
});

/**
 * Globale Programme und Scheiben anlegen, die noch fehlen (Abgleich über den Namen bzw. frühere Namen).
 * Idempotent: bestehende Einträge, auch von Admins geänderte, bleiben unverändert. Einzige Ausnahme:
 * Vorlagen mit amtlicher Art (Obligatorisch, Feldschiessen) setzen die Art bei bestehenden globalen
 * Programmen, solange diese noch keine haben, und entfernen eine früher vorbelegte, unveränderte
 * Bestehensgrenze bzw. Beschreibung (siehe presetOfficialUpdate) und bewerten danach die amtlichen
 * Resultate neu. Eigene Grenzwerte und Beschreibungen bleiben unverändert.
 */
async function seedPresets(createdById: string | null) {
  let programs = 0;
  let updated = 0;
  for (const p of PROGRAM_PRESETS) {
    const exists = await db.program.findFirst({ where: { tenantId: null, name: { in: presetNames(p) } }, orderBy: { createdAt: "asc" } });
    if (exists) {
      const patch = presetOfficialUpdate(exists, p);
      if (patch) {
        const saved = await db.program.update({ where: { id: exists.id }, data: patch });
        updated++;
        // Bestehensgrenze entfernt: bereits bestätigte Resultate dürfen nicht weiter als «bestanden» gelten.
        if ("passMinScore" in patch || "passMaxZeros" in patch) {
          const n = await recomputeProgramPasses(db, saved.id, saved);
          if (n) console.log(`Vorlagen: ${n} amtliche Resultate von «${saved.name}» neu bewertet.`);
        }
      }
      continue;
    }
    await db.program.create({
      data: {
        tenantId: null, createdById, name: p.name, description: p.description ?? null, discipline: p.discipline, weaponNote: p.weaponNote ?? null, scoringMode: p.scoringMode, stagesJson: JSON.stringify(p.stages),
        officialKind: p.officialKind ?? null, passMinScore: p.passMinScore ?? null, passMaxZeros: p.passMaxZeros ?? null,
      },
    });
    programs++;
  }
  if (updated) console.log(`Vorlagen: ${updated} globale Programme abgeglichen (amtliche Art / Bestehensgrenze / Beschreibung).`);

  let targets = 0;
  for (const t of TARGET_PRESETS) {
    const exists = await db.targetTemplate.findFirst({ where: { tenantId: null, ownerUserId: null, name: t.name } });
    if (exists) continue;
    await db.targetTemplate.create({
      data: { tenantId: null, ownerUserId: null, name: t.name, description: t.description ?? null, subject: t.subject, paperSizes: t.paperSizes.join(","), paramsJson: JSON.stringify(t.params ?? {}) },
    });
    targets++;
  }
  console.log(`Vorlagen: ${programs} neue globale Programme, ${targets} neue globale Scheiben.`);
}

async function main() {
  // Nur Vorlagen (für Updates, siehe scripts/deploy.sh): legt kein Konto an und braucht keine SEED_ADMIN_*-Variablen.
  if (process.argv.includes("--presets-only") || process.env.SEED_PRESETS_ONLY === "1") {
    const superAdmin = await db.user.findFirst({ where: { isSuperAdmin: true }, orderBy: { createdAt: "asc" }, select: { id: true } });
    await seedPresets(superAdmin?.id ?? null);
    return;
  }

  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@example.ch").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "admin1234";

  const admin = await db.user.upsert({
    where: { email },
    update: { isSuperAdmin: true },
    create: { email, name: "Super Admin", passwordHash: await bcrypt.hash(password, 10), passwordSetAt: new Date(), isSuperAdmin: true },
  });

  await seedPresets(admin.id);

  // Demo-Verein mit zwei Mitgliedern (nur wenn SEED_DEMO=1, nie in Produktion)
  if (process.env.SEED_DEMO === "1" && process.env.NODE_ENV !== "production") {
    const demo = await db.tenant.upsert({
      where: { slug: "demo-schuetzen" },
      update: {},
      create: { slug: "demo-schuetzen", name: "Demo Schützengesellschaft", kind: "CLUB", city: "Musterhausen", canton: "ZH", joinCode: "DEMO42" },
    });
    const pw = await bcrypt.hash("demo1234", 10);
    const anna = await db.user.upsert({ where: { email: "anna@example.ch" }, update: {}, create: { email: "anna@example.ch", name: "Anna Muster", passwordHash: pw, passwordSetAt: new Date() } });
    const beat = await db.user.upsert({ where: { email: "beat@example.ch" }, update: {}, create: { email: "beat@example.ch", name: "Beat Beispiel", passwordHash: pw, passwordSetAt: new Date() } });
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

    // Dateiablage, Chat und Munition im Demo-Verein einschalten und mit Beispieldaten füllen (idempotent)
    for (const moduleKey of ["files", "chat", "ammo"] as const) {
      await db.tenantModule.upsert({ where: { tenantId_moduleKey: { tenantId: demo.id, moduleKey } }, update: { enabled: true }, create: { tenantId: demo.id, moduleKey, enabled: true } });
    }
    await seedDemoFiles(db, demo.id, anna.id);
    await seedDemoChat(db, demo.id, [anna.id, beat.id, admin.id]);
    await seedDemoAmmo(db, demo.id);

    // Welle B: Bundesübungen, Standbetrieb, Vereinswaffen, Helfereinsätze, Kurse, Jahresmeisterschaft (idempotent)
    for (const moduleKey of ["federal", "range", "weapons", "shifts", "courses", "championship"] as const) {
      await db.tenantModule.upsert({ where: { tenantId_moduleKey: { tenantId: demo.id, moduleKey } }, update: { enabled: true }, create: { tenantId: demo.id, moduleKey, enabled: true } });
    }
    const demoUsers = [anna.id, beat.id, admin.id]; // erste Person = Standchef / Kursleitung
    await seedDemoFederal(db, demo.id, demoUsers);
    await seedDemoShifts(db, demo.id, demoUsers);
    await seedDemoRange(db, demo.id, demoUsers);
    await seedDemoWeapons(db, demo.id, demoUsers);
    await seedDemoAmmoStock(db, demo.id, [anna.id]);
    await seedDemoCourses(db, demo.id, demoUsers);
    await seedDemoChampionship(db, demo.id, demoUsers);

    // Welle C: Schützenstube, Partner-Anlagen, Website-Widgets, Buchhaltung, Resultat-Import (idempotent)
    await db.tenantModule.upsert({ where: { tenantId_moduleKey: { tenantId: demo.id, moduleKey: "kiosk" } }, update: { enabled: true }, create: { tenantId: demo.id, moduleKey: "kiosk", enabled: true } });
    await seedDemoKiosk(db, demo.id, demoUsers);
    await seedDemoSharing(db, demo.id, [anna.id, beat.id]); // Anna Admin, Beat Mitglied im Partnerverein
    await seedDemoEmbed(db, demo.id, demoUsers);
    await seedDemoAccounting(db, demo.id, demoUsers);
    await seedDemoScoreImport(db, demo.id, demoUsers); // nach seedPresets (braucht ein globales Programm)
    console.log("Demo-Verein: Beitrittscode DEMO42 · anna@example.ch / beat@example.ch (Passwort demo1234)");
  }

  console.log(`Super-Admin: ${email} (Passwort aus SEED_ADMIN_PASSWORD)`);
}

main().finally(() => db.$disconnect());
