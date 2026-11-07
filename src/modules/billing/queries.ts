import "server-only";
import { db } from "@/lib/db";
import type { AppContext } from "@/lib/tenant";
import { zurichParts } from "@/lib/time";
import { isOverdue } from "./dates";
import { accessStatusWhere, hasTenantAccess } from "@/lib/membership-access";
import { feeCoverageStats, householdCoverage, planFeeInvoices } from "./fee-run-plan";
import { loadFeeCandidates, withInvoiceMembers } from "./fee-run";
import { userAvatarUrl } from "@/components/avatar";
import { paymentReviewFromDetails } from "@/lib/payments/logic";
import { kioskReopenBlockedIds } from "@/modules/kiosk/invoice-guard";
import { standaloneInvoiceHints, standaloneKind } from "./standalone-hints";
import { reminderCount, visiblePaymentNote } from "./types";

type TenantCtx = AppContext & { tenant: NonNullable<AppContext["tenant"]> };

export function currentYear() {
  return Number(zurichParts(new Date()).dateStr.slice(0, 4));
}

export async function listCategories(tenantId: string, opts?: { includeInactive?: boolean }) {
  return db.feeCategory.findMany({
    where: { tenantId, ...(opts?.includeInactive ? {} : { isActive: true }) },
    include: { _count: { select: { memberships: true } } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

/** Mitglieder mit Kategorie, Beitrag und Rechnungsstatus für ein Jahr. */
export async function listMembersForBilling(tenantId: string, year: number) {
  const members = await withInvoiceMembers(db, tenantId, await db.membership.findMany({
    // Wartende Beitritte (PENDING) erhalten noch keine Rechnung
    where: { tenantId, status: { not: "PENDING" } },
    include: {
      user: { select: { id: true, name: true, email: true, street: true, zip: true, city: true, avatarPath: true, updatedAt: true } },
      feeCategory: true,
      feeInvoices: { where: { year, status: { not: "CANCELLED" } }, select: { id: true, number: true, status: true, amountCents: true, categoryName: true, issuedAt: true } },
    },
    orderBy: { user: { name: "asc" } },
  }));
  // Mitglieder, die eine Haushaltsrechnung eines anderen Haushaltsmitglieds schon abdeckt
  const covered = householdCoverage(members.map((m) => ({ membershipId: m.id, householdId: m.householdId, createdAt: m.createdAt, invoices: m.feeInvoices })));
  return members.map((m) => ({
    membershipId: m.id,
    userId: m.user.id,
    name: m.user.name,
    email: m.user.email,
    avatarUrl: userAvatarUrl(m.user),
    address: [m.user.street, [m.user.zip, m.user.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || null,
    role: m.role,
    status: m.status,
    memberNumber: m.memberNumber,
    category: m.feeCategory ? { id: m.feeCategory.id, name: m.feeCategory.name, amountCents: m.feeCategory.amountCents } : null,
    overrideCents: m.feeAmountOverrideCents,
    effectiveCents: m.feeAmountOverrideCents ?? m.feeCategory?.amountCents ?? null,
    invoice: m.feeInvoices[0] ? { id: m.feeInvoices[0].id, number: m.feeInvoices[0].number, status: m.feeInvoices[0].status, amountCents: m.feeInvoices[0].amountCents } : null,
    /** In der Haushaltsrechnung (Nummer) eines anderen Haushaltsmitglieds enthalten */
    coveredBy: covered.get(m.id) ?? null,
  }));
}

export async function listRuns(tenantId: string) {
  const runs = await db.feeRun.findMany({ where: { tenantId }, include: { invoices: { select: { status: true, amountCents: true } } }, orderBy: { year: "desc" } });
  return runs.map((r) => ({
    id: r.id, year: r.year, title: r.title, dueAt: r.dueAt, createdAt: r.createdAt, invoicePrefix: r.invoicePrefix, dueDays: r.dueDays, note: r.note,
    count: r.invoices.length,
    open: r.invoices.filter((i) => i.status === "OPEN").length,
    paid: r.invoices.filter((i) => i.status === "PAID").length,
    totalCents: r.invoices.filter((i) => i.status !== "CANCELLED").reduce((a, i) => a + i.amountCents, 0),
    paidCents: r.invoices.filter((i) => i.status === "PAID").reduce((a, i) => a + i.amountCents, 0),
  }));
}
export type RunRow = Awaited<ReturnType<typeof listRuns>>[number];

export async function getRun(tenantId: string, id: string) {
  const r = await db.feeRun.findUnique({ where: { id } });
  return r && r.tenantId === tenantId ? r : null;
}

export async function listInvoices(tenantId: string, opts?: { year?: number; status?: string; runId?: string; limit?: number }) {
  return db.feeInvoice.findMany({
    where: { tenantId, ...(opts?.year ? { year: opts.year } : {}), ...(opts?.status ? { status: opts.status } : {}), ...(opts?.runId ? { runId: opts.runId } : {}) },
    orderBy: [{ status: "asc" }, { memberName: "asc" }],
    take: opts?.limit ?? 1000,
  });
}
export type FeeInvoiceRow = Awaited<ReturnType<typeof listInvoices>>[number];

export async function listMyFeeInvoices(ctx: TenantCtx) {
  return db.feeInvoice.findMany({ where: { tenantId: ctx.tenant.id, userId: ctx.user.id }, include: { run: { select: { title: true } } }, orderBy: { year: "desc" } });
}

export async function getFeeInvoice(ctx: TenantCtx, id: string) {
  const inv = await db.feeInvoice.findUnique({ where: { id }, include: { run: true, user: { select: { street: true, zip: true, city: true, email: true } } } });
  if (!inv || inv.tenantId !== ctx.tenant.id) return null;
  if (inv.userId !== ctx.user.id && !ctx.can("tenant.manage")) return null;
  return inv;
}

export async function feeStats(tenantId: string, year: number) {
  const [invoices, members, withCategory, { candidates }] = await Promise.all([
    db.feeInvoice.findMany({ where: { tenantId, year }, select: { status: true, amountCents: true, dueAt: true } }),
    // Ausgetretene und wartende Beitritte zählen nicht mit (erhalten keine Rechnung)
    db.membership.count({ where: { tenantId, status: accessStatusWhere() } }),
    db.membership.count({ where: { tenantId, status: accessStatusWhere(), OR: [{ feeCategoryId: { not: null } }, { feeAmountOverrideCents: { not: null } }] } }),
    loadFeeCandidates(db, tenantId, year),
  ]);
  const now = new Date();
  const open = invoices.filter((i) => i.status === "OPEN");
  return {
    members, withCategory,
    invoiced: invoices.filter((i) => i.status !== "CANCELLED").length,
    open: open.length,
    overdue: open.filter((i) => isOverdue(i.dueAt, now)).length,
    paid: invoices.filter((i) => i.status === "PAID").length,
    openCents: open.reduce((a, i) => a + i.amountCents, 0),
    paidCents: invoices.filter((i) => i.status === "PAID").reduce((a, i) => a + i.amountCents, 0),
    /** Mitglieder mit Beitrag: eigene Rechnung, in einer Haushaltsrechnung enthalten, noch nicht verrechnet */
    coverage: feeCoverageStats(candidates),
  };
}

/**
 * Vorschau für den Jahreslauf (Trockenlauf mit derselben Planung wie createRunAction): wie viele
 * Mitglieder noch offen sind und wie viele Rechnungen mit bzw. ohne «Haushalte zusammenfassen» entstehen.
 */
export async function feeRunPreview(tenantId: string, year: number) {
  const { candidates, households } = await loadFeeCandidates(db, tenantId, year);
  const separate = planFeeInvoices(candidates, [], false).length;
  const combined = planFeeInvoices(candidates, households, true).length;
  const covered = householdCoverage(candidates);
  const alreadyInvoiced = candidates.filter((c) => hasTenantAccess(c.status) && (c.invoices.length > 0 || covered.has(c.membershipId))).length;
  return { members: separate, invoicesCombined: combined, invoicesSeparate: separate, alreadyInvoiced };
}

/**
 * Einzelrechnungen (ohne Jahreslauf: Schützenstube, Ersatzabgabe) eines Jahres für die Verwaltung,
 * mit Art, verknüpften Konsumationen, Online-Zahlungen und Hinweisen (Rückerstattung, Doppelverrechnung).
 */
export async function listStandaloneInvoices(tenantId: string, year: number) {
  const rows = await db.feeInvoice.findMany({
    where: { tenantId, year, runId: null },
    orderBy: [{ issuedAt: "desc" }, { number: "desc" }],
    take: 2000,
    select: {
      id: true, number: true, memberName: true, categoryName: true, amountCents: true, currency: true, status: true, issuedAt: true, dueAt: true,
      paidAt: true, cancelledAt: true, paymentNote: true, remindedAt: true, runId: true, reference: true,
      payments: { where: { status: { in: ["PAID", "REFUNDED"] } }, select: { status: true, provider: true, amountCents: true, detailsJson: true }, orderBy: { createdAt: "asc" } },
    },
  });
  const ids = rows.map((r) => r.id);
  const [groups, blocked] = await Promise.all([
    ids.length ? db.kioskEntry.groupBy({ by: ["billedInvoiceId"], where: { tenantId, billedInvoiceId: { in: ids } }, _count: { _all: true } }) : Promise.resolve([]),
    kioskReopenBlockedIds(db, tenantId, rows),
  ]);
  const entries = new Map(groups.map((g) => [g.billedInvoiceId!, g._count._all]));
  return rows.map((r) => {
    const kioskEntries = entries.get(r.id) ?? 0;
    const kind = standaloneKind(r.categoryName, kioskEntries);
    const payments = r.payments.map((p) => ({ status: p.status, provider: p.provider, amountCents: p.amountCents, review: paymentReviewFromDetails(p.detailsJson) }));
    const reopenBlocked = blocked.has(r.id);
    const now = new Date();
    return {
      id: r.id, number: r.number, memberName: r.memberName, categoryName: r.categoryName, amountCents: r.amountCents, currency: r.currency,
      status: r.status, issuedAt: r.issuedAt, dueAt: r.dueAt, paidAt: r.paidAt, cancelledAt: r.cancelledAt,
      overdue: r.status === "OPEN" && isOverdue(r.dueAt, now),
      reminders: reminderCount(r.paymentNote, r.remindedAt),
      note: visiblePaymentNote(r.paymentNote),
      kind, kioskEntries, reopenBlocked,
      onlinePaid: payments.filter((p) => p.status === "PAID").length,
      hints: standaloneInvoiceHints({ status: r.status, amountCents: r.amountCents, paymentNote: r.paymentNote, payments, kind, reopenBlocked }),
    };
  });
}
export type StandaloneInvoiceRow = Awaited<ReturnType<typeof listStandaloneInvoices>>[number];

/** Jahre mit Einzelrechnungen (neueste zuerst). */
export async function standaloneInvoiceYears(tenantId: string) {
  const rows = await db.feeInvoice.groupBy({ by: ["year"], where: { tenantId, runId: null }, orderBy: { year: "desc" } });
  return rows.map((r) => r.year);
}
