/**
 * Demo-Ordner für den Seed (prisma/seed.ts). Bewusst nur relative Imports und
 * kein "server-only", damit tsx das Skript ausserhalb von Next.js ausführen kann.
 * Legt keine Dateien an (keine Schreibzugriffe auf den Speicher). Idempotent.
 */
import type { PrismaClient } from "../../generated/prisma/client";

type Db = Pick<PrismaClient, "fileFolder">;

const DEMO_FOLDERS = [
  { name: "Reglemente", minRole: "MEMBER" },
  { name: "Protokolle", minRole: "TRAINER" },
  { name: "Formulare", minRole: "MEMBER" },
] as const;

export async function seedDemoFiles(db: Db, tenantId: string, userId: string) {
  let created = 0;
  for (const f of DEMO_FOLDERS) {
    const exists = await db.fileFolder.findFirst({ where: { tenantId, parentId: null, name: f.name }, select: { id: true } });
    if (exists) continue;
    await db.fileFolder.create({ data: { tenantId, parentId: null, name: f.name, minRole: f.minRole, createdById: userId } });
    created++;
  }
  return { created, skipped: created === 0 };
}
