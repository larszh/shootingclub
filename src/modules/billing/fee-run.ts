import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getTenantLocale } from "@/lib/i18n";
import { isPlaceholderEmail } from "@/modules/members/types";
import { householdCoverage, planFeeInvoices, type FeeCandidate, type FeeHousehold, type FeeSnapshot } from "./fee-run-plan";

export type { FeeSnapshot } from "./fee-run-plan";

type Client = typeof db | Prisma.TransactionClient;

const invoiceSelect = { categoryName: true, number: true, issuedAt: true } as const;

/** Alle Mitgliedschaften (auch ausgetretene) als Kandidaten plus Haushalte für die Planung. */
export async function loadFeeCandidates(client: Client, tenantId: string, year: number): Promise<{ candidates: FeeCandidate[]; households: FeeHousehold[] }> {
  const [members, households] = await Promise.all([
    client.membership.findMany({
      where: { tenantId },
      select: {
        id: true, userId: true, status: true, householdId: true, feeCategoryId: true, feeAmountOverrideCents: true, createdAt: true,
        user: { select: { name: true, email: true, street: true, zip: true, city: true } },
        feeCategory: { select: { name: true, amountCents: true } },
        feeInvoices: { where: { year, status: { not: "CANCELLED" } }, select: invoiceSelect },
      },
    }),
    client.household.findMany({ where: { tenantId }, select: { id: true, name: true, payerUserId: true } }),
  ]);
  const candidates: FeeCandidate[] = members.map((m) => ({
    membershipId: m.id,
    userId: m.userId,
    name: m.user.name,
    // Platzhalter-Adressen (Mitglieder ohne E-Mail) nicht auf die Rechnung übernehmen
    email: isPlaceholderEmail(m.user.email) ? "" : m.user.email,
    address: [m.user.street, [m.user.zip, m.user.city].filter(Boolean).join(" ")].filter(Boolean).join("\n") || null,
    status: m.status,
    categoryId: m.feeCategoryId,
    categoryName: m.feeCategory?.name ?? null,
    amountCents: m.feeAmountOverrideCents ?? m.feeCategory?.amountCents ?? null,
    householdId: m.householdId,
    createdAt: m.createdAt,
    invoices: m.feeInvoices,
  }));
  return { candidates, households };
}

/**
 * Mitglieder (bzw. Haushalte) mit Beitrag, die in diesem Jahr noch keine Rechnung haben.
 * Läuft innerhalb der Transaktion mit gesperrtem Jahreslauf (createInvoicesLocked).
 */
export async function feeInvoicesToCreate(tx: Prisma.TransactionClient, tenantId: string, year: number, combineHouseholds: boolean): Promise<FeeSnapshot[]> {
  const [{ candidates, households }, locale] = await Promise.all([loadFeeCandidates(tx, tenantId, year), getTenantLocale(tenantId)]);
  return planFeeInvoices(candidates, combineHouseholds ? households : [], combineHouseholds, locale);
}

/**
 * Deckt eine Haushaltsrechnung dieses Jahres die Mitgliedschaft bereits ab (Rechnung liegt bei einem
 * anderen Haushaltsmitglied)? Liefert die Rechnungsnummer oder null.
 */
export async function householdInvoiceCovering(client: Client, tenantId: string, membershipId: string, year: number): Promise<{ number: string | null } | null> {
  const m = await client.membership.findFirst({ where: { id: membershipId, tenantId }, select: { householdId: true } });
  if (!m?.householdId) return null;
  const members = await client.membership.findMany({
    where: { tenantId, householdId: m.householdId },
    select: { id: true, householdId: true, createdAt: true, feeInvoices: { where: { year, status: { not: "CANCELLED" } }, select: invoiceSelect } },
  });
  return householdCoverage(members.map((x) => ({ membershipId: x.id, householdId: x.householdId, createdAt: x.createdAt, invoices: x.feeInvoices }))).get(membershipId) ?? null;
}
