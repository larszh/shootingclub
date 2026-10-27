import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PROGRAM_PRESETS } from "../src/modules/scores/presets";
import { TARGET_PRESETS } from "../src/modules/targets/presets";

const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" }) });

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

  // Demo-Verein mit zwei Mitgliedern (nur in Entwicklung)
  if (process.env.NODE_ENV !== "production") {
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
    console.log("Demo-Verein: Beitrittscode DEMO42 · anna@example.ch / beat@example.ch (Passwort demo1234)");
  }

  console.log(`Super-Admin: ${email} (Passwort aus SEED_ADMIN_PASSWORD)`);
}

main().finally(() => db.$disconnect());
