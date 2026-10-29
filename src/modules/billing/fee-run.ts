import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { isPlaceholderEmail } from "@/modules/members/types";
import { planFeeInvoices, type FeeCandidate, type FeeSnapshot } from "./fee-run-plan";

export type { FeeSnapshot } from "./fee-run-plan";

/**
 * Mitglieder (bzw. Haushalte) mit Beitrag, die in diesem Jahr noch keine Rechnung haben.
 * Läuft innerhalb der Transaktion mit gesperrtem Jahreslauf (createInvoicesLocked).
 */
export async function feeInvoicesToCreate(tx: Prisma.TransactionClient, tenantId: string, year: number, combineHouseholds: boolean): Promise<FeeSnapshot[]> {
  const [members, households] = await Promise.all([
    tx.membership.findMany({
      where: { tenantId },
      select: {
        id: true, userId: true, status: true, householdId: true, feeCategoryId: true, feeAmountOverrideCents: true,
        user: { select: { name: true, email: true, street: true, zip: true, city: true } },
        feeCategory: { select: { name: true, amountCents: true } },
        feeInvoices: { where: { year, status: { not: "CANCELLED" } }, select: { categoryName: true } },
      },
    }),
    combineHouseholds ? tx.household.findMany({ where: { tenantId }, select: { id: true, name: true, payerUserId: true } }) : Promise.resolve([]),
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
    invoices: m.feeInvoices,
  }));
  return planFeeInvoices(candidates, households, combineHouseholds);
}
