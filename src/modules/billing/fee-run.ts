import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getTenantLocale } from "@/lib/i18n";
import { isPlaceholderEmail } from "@/modules/members/types";
import { HOUSEHOLD_INVOICE_RE } from "@/modules/members/types";
import { householdCoverage, planFeeInvoices, type FeeCandidate, type FeeCandidateInvoice, type FeeHousehold, type FeeSnapshot } from "./fee-run-plan";

export type { FeeSnapshot } from "./fee-run-plan";

type Client = typeof db | Prisma.TransactionClient;

const invoiceSelect = { id: true, categoryName: true, number: true, issuedAt: true } as const;

/**
 * Audit-Einträge, die festhalten, welche Mitgliedschaften eine Haushaltsrechnung enthält
 * (ein Eintrag pro Mitgliedschaft; entityId = Rechnung, Mitgliedschaft am Ende von `detail`).
 * Sie werden in derselben Transaktion wie die Rechnung geschrieben und bestimmen später,
 * wer durch die Rechnung abgedeckt ist (siehe householdCoverage).
 */
export const HOUSEHOLD_MEMBER_ACTION = "billing.invoice.household-member";
const SEP = " · ";

export function householdMemberAuditRows(tenantId: string, invoice: { id: string; number: string }, covers: NonNullable<FeeSnapshot["covers"]>, actor?: { id: string; name: string } | null) {
  return covers.map((c) => ({
    tenantId, actorId: actor?.id ?? null, actorName: actor?.name ?? null, action: HOUSEHOLD_MEMBER_ACTION, entity: "FeeInvoice", entityId: invoice.id,
    detail: `${invoice.number}${SEP}${c.name.replaceAll(SEP, " ")}${SEP}${c.membershipId}`,
  }));
}

/** Ergänzt Haushaltsrechnungen um die festgehaltenen Mitgliedschaften (`members`). */
async function withHouseholdMembers<T extends FeeCandidateInvoice & { id: string }>(client: Client, tenantId: string, lists: T[][]): Promise<Array<Array<T & { members: string[] | null }>>> {
  const hh = lists.flat().filter((i) => HOUSEHOLD_INVOICE_RE.test(i.categoryName));
  const byInvoice = new Map<string, string[]>();
  if (hh.length) {
    // Einträge entstehen zusammen mit der Rechnung; ab dem frühesten Rechnungsdatum suchen (Index tenantId+createdAt).
    const from = hh.reduce<Date | null>((min, i) => (i.issuedAt && (!min || i.issuedAt < min) ? i.issuedAt : min), null);
    const rows = await client.auditLog.findMany({
      where: { tenantId, action: HOUSEHOLD_MEMBER_ACTION, entity: "FeeInvoice", entityId: { in: hh.map((i) => i.id) }, ...(from ? { createdAt: { gte: new Date(from.getTime() - 60_000) } } : {}) },
      select: { entityId: true, detail: true },
    });
    for (const r of rows) {
      const membershipId = r.detail?.split(SEP).pop();
      if (!r.entityId || !membershipId) continue;
      const g = byInvoice.get(r.entityId) ?? [];
      g.push(membershipId);
      byInvoice.set(r.entityId, g);
    }
  }
  return lists.map((l) => l.map((i) => ({ ...i, members: byInvoice.get(i.id) ?? null })));
}

/** Mitgliedschaften mit ihren Rechnungen (inkl. festgehaltener Haushaltsmitglieder) eines Jahres. */
export async function withInvoiceMembers<M extends { feeInvoices: Array<FeeCandidateInvoice & { id: string }> }>(client: Client, tenantId: string, members: M[]) {
  const lists = await withHouseholdMembers(client, tenantId, members.map((m) => m.feeInvoices));
  return members.map((m, i) => ({ ...m, feeInvoices: lists[i]! as Array<M["feeInvoices"][number] & { members: string[] | null }> }));
}

/** Alle Mitgliedschaften (auch ausgetretene) als Kandidaten plus Haushalte für die Planung. */
export async function loadFeeCandidates(client: Client, tenantId: string, year: number): Promise<{ candidates: FeeCandidate[]; households: FeeHousehold[] }> {
  const [rawMembers, households] = await Promise.all([
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
  const members = await withInvoiceMembers(client, tenantId, rawMembers);
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
  // Alle Mitgliedschaften des Vereins: die abdeckende Rechnung kann bei jemandem liegen, der den Haushalt verlassen hat.
  const members = await withInvoiceMembers(client, tenantId, await client.membership.findMany({
    where: { tenantId },
    select: { id: true, householdId: true, createdAt: true, feeInvoices: { where: { year, status: { not: "CANCELLED" } }, select: invoiceSelect } },
  }));
  return householdCoverage(members.map((x) => ({ membershipId: x.id, householdId: x.householdId, createdAt: x.createdAt, invoices: x.feeInvoices }))).get(membershipId) ?? null;
}
