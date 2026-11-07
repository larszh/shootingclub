/**
 * Demo für den Kantonalverband (prisma/seed.ts). Bewusst nur relative Imports und kein "server-only",
 * damit tsx das Skript ausserhalb von Next.js ausführen kann.
 *
 * Legt den «Demo Kantonalverband» (Code KSVDEMO1) an, macht den ersten Benutzer zum Verbandsadmin
 * und verbindet den Demo-Verein (freigegeben, mit Namensfreigabe). Gibt es den Partnerverein aus
 * seedDemoSharing («demo-pistolenclub»), stellt er eine offene Beitrittsanfrage (nur Zahlen).
 * Idempotent: bestehende Zeilen werden nicht verändert.
 */
import type { PrismaClient } from "../../generated/prisma/client";

type Db = Pick<PrismaClient, "association" | "associationAdmin" | "associationMember" | "tenant">;

const DEMO_CODE = "KSVDEMO1";
const PARTNER_SLUG = "demo-pistolenclub";

export async function seedDemoAssociation(db: Db, tenantId: string, userIds: string[]) {
  const [adminId] = userIds;
  const association = await db.association.upsert({
    where: { code: DEMO_CODE },
    update: {},
    create: { name: "Demo Kantonalverband", code: DEMO_CODE, region: "ZH" },
  });
  if (adminId) {
    await db.associationAdmin.upsert({
      where: { associationId_userId: { associationId: association.id, userId: adminId } },
      update: {},
      create: { associationId: association.id, userId: adminId, role: "ADMIN" },
    });
  }
  const now = new Date();
  await db.associationMember.upsert({
    where: { associationId_tenantId: { associationId: association.id, tenantId } },
    update: {},
    create: { associationId: association.id, tenantId, status: "APPROVED", shareNames: true, consentAt: now, approvedAt: now },
  });
  const partner = await db.tenant.findUnique({ where: { slug: PARTNER_SLUG }, select: { id: true } });
  if (partner && partner.id !== tenantId) {
    await db.associationMember.upsert({
      where: { associationId_tenantId: { associationId: association.id, tenantId: partner.id } },
      update: {},
      create: { associationId: association.id, tenantId: partner.id, status: "PENDING", shareNames: false, consentAt: now },
    });
  }
  return { associationId: association.id, code: DEMO_CODE };
}
