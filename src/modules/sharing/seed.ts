/**
 * Demo für gemeinsame Anlagen (prisma/seed.ts). Bewusst nur relative Imports und kein "server-only",
 * damit tsx das Skript ausserhalb von Next.js ausführen kann.
 *
 * Legt einen Partnerverein «Demo Pistolenclub» an (Beat als Mitglied, Anna als Admin), teilt die
 * erste Anlage des Demo-Vereins mit 120 % Tarif und erfasst zwei Partnerbuchungen (eine vergangene,
 * bezahlte und eine offene Anfrage). Idempotent.
 */
import type { PrismaClient } from "../../generated/prisma/client";
import { addDays, todayZurich, zurichParts, zurichToUtc } from "../../lib/time";

type Db = Pick<PrismaClient, "tenant" | "membership" | "tenantModule" | "resource" | "resourceShare" | "booking">;

const PARTNER_SLUG = "demo-pistolenclub";

export async function seedDemoSharing(db: Db, tenantId: string, userIds: string[]) {
  const [adminId, memberId] = userIds;
  if (!adminId || !memberId) return { created: 0, skipped: true };
  const resource = await db.resource.findFirst({ where: { tenantId, isActive: true }, orderBy: [{ kind: "asc" }, { sortOrder: "asc" }] });
  if (!resource) return { created: 0, skipped: true };

  const partner = await db.tenant.upsert({
    where: { slug: PARTNER_SLUG },
    update: {},
    create: { slug: PARTNER_SLUG, name: "Demo Pistolenclub", kind: "CLUB", city: "Beispielwil", canton: "ZH", joinCode: "PARTNER7" },
  });
  for (const [userId, role] of [[adminId, "ADMIN"], [memberId, "MEMBER"]] as const) {
    await db.membership.upsert({ where: { userId_tenantId: { userId, tenantId: partner.id } }, update: {}, create: { userId, tenantId: partner.id, role } });
  }
  await db.tenantModule.upsert({ where: { tenantId_moduleKey: { tenantId: partner.id, moduleKey: "bookings" } }, update: { enabled: true }, create: { tenantId: partner.id, moduleKey: "bookings", enabled: true } });

  await db.resourceShare.upsert({
    where: { resourceId_guestTenantId: { resourceId: resource.id, guestTenantId: partner.id } },
    update: {},
    create: { resourceId: resource.id, guestTenantId: partner.id, canBook: true, priceFactorPercent: 120, note: "Schlüssel beim Standwart abholen" },
  });

  if ((await db.booking.count({ where: { tenantId, viaTenantId: partner.id } })) > 0) return { created: 0, skipped: true };

  const today = todayZurich();
  // Letzter Samstag (vergangen) und übernächster Samstag (Anfrage)
  let past = addDays(today, -1);
  while (zurichParts(zurichToUtc(past, "12:00")).weekday !== 6) past = addDays(past, -1);
  const future = addDays(past, 14);
  const base = { tenantId, resourceId: resource.id, userId: memberId, viaTenantId: partner.id, durationMinutes: 60, persons: 2, units: 1, currency: "CHF", basePriceCents: 2160, discountCents: 0, totalCents: 2160 };
  await db.booking.create({
    data: {
      ...base, startsAt: zurichToUtc(past, "10:00"), endsAt: zurichToUtc(past, "11:00"),
      status: "CONFIRMED", paymentMethod: "CASH", paymentStatus: "PAID", confirmedAt: zurichToUtc(past, "09:00"), paidAt: zurichToUtc(past, "11:00"),
    },
  });
  await db.booking.create({
    data: {
      ...base, startsAt: zurichToUtc(future, "10:00"), endsAt: zurichToUtc(future, "11:00"),
      status: "PENDING", paymentMethod: "INVOICE", paymentStatus: "UNPAID", note: "Training Pistolenclub",
    },
  });
  return { created: 2, skipped: false };
}
