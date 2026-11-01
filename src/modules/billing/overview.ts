import "server-only";
import { db } from "@/lib/db";
import type { AppContext, ActiveTenant } from "@/lib/tenant";
import { formatDateZurich, zurichParts } from "@/lib/time";
import { listAmmoInvoicesForUser } from "@/modules/ammo/queries";
import { ensureAmmoReference } from "@/modules/ammo/service";
import { getBillingProfile, type BillingProfileView } from "./profile";
import { ensureReference } from "./reference";
import { isOverdue } from "./dates";
import { feeInvoiceSourceLabel, feeInvoiceTitle, isStandaloneFeeInvoice } from "./fee-title";
import { getOnlineFeeProviderKey } from "./payments";
import { canPayFeeInvoiceOnline, feeInvoicePayPath, sourceAllowsOnlinePayment } from "@/lib/payments/logic";
import { providerLabel as paymentProviderLabel, providerMethods } from "@/lib/payments/catalog";

/**
 * Zahlungsübersicht über alle Quellen: Mitgliederbeiträge (FeeInvoice), Reservations-Rechnungen
 * (Invoice), Online-Zahlungen von Reservationen (Payment) und Munitionsrechnungen (AmmoOrder).
 * Jede Quelle erscheint nur, wenn ihr Modul im Verein aktiv ist (sonst führen die Links ins Leere).
 */

type TenantCtx = AppContext & { tenant: ActiveTenant };

export type PaymentSource = "FEE" | "BOOKING" | "ONLINE" | "AMMO";

/** Bezeichnung eines Bereichs (Filter, Gruppen). FEE umfasst auch Einzelrechnungen wie die Ersatzabgabe. */
export const PAYMENT_SOURCE_LABEL: Record<PaymentSource, string> = {
  FEE: "Beiträge & Abgaben",
  BOOKING: "Reservation",
  ONLINE: "Online-Zahlung",
  AMMO: "Munition",
};

/** Gruppen für die Filter: offen = zu bezahlen, bezahlt, sonst (storniert, erstattet). */
export type PaymentGroup = "open" | "paid" | "other";

export type PaymentItem = {
  key: string;
  source: PaymentSource;
  /** Bezeichnung des einzelnen Postens (z.B. «Mitgliederbeitrag» oder «Vereinsrechnung»); fehlt sie, gilt die des Bereichs. */
  sourceLabel?: string;
  id: string;
  number: string;
  title: string;
  detail: string | null;
  memberName: string | null;
  amountCents: number;
  currency: string;
  /** Rohstatus für die Anzeige: OPEN | PAID | CANCELLED | REFUNDED */
  status: "OPEN" | "PAID" | "CANCELLED" | "REFUNDED";
  group: PaymentGroup;
  issuedAt: Date | null;
  dueAt: Date | null;
  paidAt: Date | null;
  overdue: boolean;
  reference: string | null;
  href: string;
  /** Druckansicht in neuem Tab öffnen (Rechnungen), Detailseite in der App sonst */
  external: boolean;
  /** «Online bezahlen» (nur Beitragsrechnungen, nie Munition); null = nicht online bezahlbar */
  payOnlineHref?: string | null;
};

/** Bezeichnung eines einzelnen Postens für Listen und Exporte. */
export function paymentItemSourceLabel(item: Pick<PaymentItem, "source" | "sourceLabel">): string {
  return item.sourceLabel ?? PAYMENT_SOURCE_LABEL[item.source];
}

export const PAYMENT_STATUS_LABEL: Record<PaymentItem["status"], { label: string; tone: "warn" | "ok" | "outline" | "neutral" | "danger" }> = {
  OPEN: { label: "Offen", tone: "warn" },
  PAID: { label: "Bezahlt", tone: "ok" },
  CANCELLED: { label: "Storniert", tone: "outline" },
  REFUNDED: { label: "Erstattet", tone: "neutral" },
};

function groupOf(status: PaymentItem["status"]): PaymentGroup {
  return status === "OPEN" ? "open" : status === "PAID" ? "paid" : "other";
}

function normalizeInvoiceStatus(s: string): PaymentItem["status"] {
  return s === "PAID" ? "PAID" : s === "CANCELLED" ? "CANCELLED" : "OPEN";
}

/** Sortierdatum: offene nach Fälligkeit, sonst nach Zahlung bzw. Ausstellung. */
function sortKey(i: PaymentItem) {
  return (i.paidAt ?? i.issuedAt ?? i.dueAt ?? new Date(0)).getTime();
}

export function sortPaymentItems(items: PaymentItem[]) {
  const open = items.filter((i) => i.group === "open").sort((a, b) => (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity));
  const rest = items.filter((i) => i.group !== "open").sort((a, b) => sortKey(b) - sortKey(a));
  return [...open, ...rest];
}

/** Summen pro Währung (in der Regel nur CHF). */
export function sumByCurrency(items: Array<{ amountCents: number; currency: string }>) {
  const map = new Map<string, number>();
  for (const i of items) map.set(i.currency, (map.get(i.currency) ?? 0) + i.amountCents);
  const list = [...map.entries()].map(([currency, cents]) => ({ currency, cents }));
  return list.length ? list : [{ currency: "CHF", cents: 0 }];
}

function currentZurichYear(now: Date) {
  return zurichParts(now).dateStr.slice(0, 4);
}

/** Welche Quellen im Verein aktiv sind. */
export function enabledSources(ctx: Pick<AppContext, "hasModule">) {
  return {
    fee: ctx.hasModule("billing"),
    booking: ctx.hasModule("bookings"),
    ammo: ctx.hasModule("ammo"),
  };
}

export function anyPaymentModule(ctx: Pick<AppContext, "hasModule">) {
  const s = enabledSources(ctx);
  return s.fee || s.booking || s.ammo;
}

/* ------------------------------------------------------------------ Mitglied */

export type MyPayments = {
  items: PaymentItem[];
  profile: BillingProfileView;
  openTotals: Array<{ currency: string; cents: number }>;
  paidThisYear: Array<{ currency: string; cents: number }>;
  openCount: number;
  overdueCount: number;
  year: string;
  /** Bezeichnung des Anbieters für Online-Zahlung von Beiträgen, null = nicht eingerichtet */
  onlineFeeProvider: string | null;
  /** Zahlarten des Anbieters für Hinweistexte, z.B. «TWINT, PostFinance, Karte» */
  onlineFeeMethods: string | null;
};

/** Alle Rechnungen und Zahlungen des angemeldeten Mitglieds im aktiven Verein. */
export async function listMyPayments(ctx: TenantCtx, now: Date): Promise<MyPayments> {
  const tenantId = ctx.tenant.id;
  const userId = ctx.user.id;
  const src = enabledSources(ctx);

  const [profile, fees, invoices, online, ammo, feeProvider] = await Promise.all([
    getBillingProfile(tenantId, ctx.tenant.name),
    src.fee
      ? db.feeInvoice.findMany({
          where: { tenantId, userId },
          select: { id: true, tenantId: true, number: true, year: true, categoryName: true, amountCents: true, currency: true, status: true, issuedAt: true, dueAt: true, paidAt: true, reference: true, runId: true, membershipId: true, run: { select: { title: true } } },
          orderBy: { issuedAt: "desc" },
          take: 200,
        })
      : Promise.resolve([]),
    src.booking
      ? db.invoice.findMany({
          where: { tenantId, booking: { userId } },
          select: { id: true, tenantId: true, number: true, amountCents: true, currency: true, status: true, issuedAt: true, dueAt: true, paidAt: true, reference: true, bookingId: true, booking: { select: { startsAt: true, resource: { select: { name: true } } } } },
          orderBy: { issuedAt: "desc" },
          take: 200,
        })
      : Promise.resolve([]),
    src.booking
      ? db.payment.findMany({
          where: { status: { in: ["PAID", "REFUNDED"] }, bookingId: { not: null }, booking: { tenantId, userId } },
          select: { id: true, provider: true, status: true, amountCents: true, currency: true, createdAt: true, updatedAt: true, bookingId: true, booking: { select: { paidAt: true, startsAt: true, resource: { select: { name: true } } } } },
          orderBy: { createdAt: "desc" },
          take: 200,
        })
      : Promise.resolve([]),
    src.ammo ? listAmmoInvoicesForUser(userId, tenantId) : Promise.resolve([]),
    src.fee ? getOnlineFeeProviderKey(tenantId) : Promise.resolve(null),
  ]);

  const qrIban = profile.qrIban ? profile.iban : null;
  const items: PaymentItem[] = [];

  for (const f of fees) {
    const status = normalizeInvoiceStatus(f.status);
    // QR-Referenzen gelten nur mit QR-IBAN (wie auf der QR-Rechnung); offene werden dann nachgeführt.
    // Ohne QR-IBAN keine (veraltete) Referenz zeigen, die Bank würde sie zurückweisen.
    const reference = !qrIban ? null : status === "OPEN" ? await ensureReference("FEE", f, qrIban) : f.reference;
    items.push({
      key: `FEE:${f.id}`, source: "FEE", sourceLabel: feeInvoiceSourceLabel(f), id: f.id, number: f.number,
      title: feeInvoiceTitle(f, `Mitgliederbeitrag ${f.year}`), detail: isStandaloneFeeInvoice(f) ? null : f.categoryName, memberName: null,
      amountCents: f.amountCents, currency: f.currency, status, group: groupOf(status),
      issuedAt: f.issuedAt, dueAt: f.dueAt, paidAt: f.paidAt,
      overdue: status === "OPEN" && isOverdue(f.dueAt, now), reference,
      href: `/billing/invoices/${f.id}/print`, external: true,
      payOnlineHref: sourceAllowsOnlinePayment("FEE") && canPayFeeInvoiceOnline(f, feeProvider) ? feeInvoicePayPath(f.id) : null,
    });
  }

  for (const i of invoices) {
    const status = normalizeInvoiceStatus(i.status);
    const reference = !qrIban ? null : status === "OPEN" ? await ensureReference("BOOKING", i, qrIban) : i.reference;
    items.push({
      key: `BOOKING:${i.id}`, source: "BOOKING", id: i.id, number: i.number,
      title: `Reservation ${i.booking.resource.name}`, detail: `Termin ${formatDateZurich(i.booking.startsAt, { weekday: undefined })}`, memberName: null,
      amountCents: i.amountCents, currency: i.currency, status, group: groupOf(status),
      issuedAt: i.issuedAt, dueAt: i.dueAt, paidAt: i.paidAt,
      overdue: status === "OPEN" && isOverdue(i.dueAt, now), reference,
      href: `/bookings/${i.bookingId}/invoice`, external: true,
    });
  }

  for (const p of online) {
    // Nur Online-Zahlungen von Reservationen; online bezahlte Beiträge erscheinen als bezahlte Rechnung (FEE).
    if (!p.booking || !p.bookingId) continue;
    const status: PaymentItem["status"] = p.status === "REFUNDED" ? "REFUNDED" : "PAID";
    items.push({
      key: `ONLINE:${p.id}`, source: "ONLINE", id: p.id, number: "Online",
      title: `Reservation ${p.booking.resource.name}`, detail: `Termin ${formatDateZurich(p.booking.startsAt, { weekday: undefined })} · ${providerLabel(p.provider)}`, memberName: null,
      amountCents: p.amountCents, currency: p.currency, status, group: groupOf(status),
      issuedAt: p.createdAt, dueAt: null, paidAt: status === "PAID" ? p.booking.paidAt ?? p.updatedAt : null,
      overdue: false, reference: null,
      href: `/bookings/${p.bookingId}`, external: false,
    });
  }

  for (const a of ammo) {
    const reference = !qrIban ? null : a.status === "OPEN" ? await ensureAmmoReference({ id: a.id, tenantId, invoiceNumber: a.number || null, reference: a.reference }, qrIban) : a.reference;
    items.push({
      key: `AMMO:${a.id}`, source: "AMMO", id: a.id, number: a.number,
      // Nummer steht separat in `number` (sonst doppelt im Zahlungszweck).
      title: "Munition", detail: null, memberName: null,
      amountCents: a.amountCents, currency: a.currency, status: a.status, group: groupOf(a.status),
      issuedAt: a.issuedAt, dueAt: a.dueAt, paidAt: a.paidAt,
      overdue: a.status === "OPEN" && !!a.dueAt && isOverdue(a.dueAt, now), reference,
      href: `/ammo/${a.id}/invoice`, external: true,
    });
  }

  const year = currentZurichYear(now);
  const open = items.filter((i) => i.group === "open");
  const paidThisYear = items.filter((i) => i.status === "PAID" && i.paidAt && zurichParts(i.paidAt).dateStr.startsWith(year));
  return {
    items: sortPaymentItems(items),
    profile,
    openTotals: sumByCurrency(open),
    paidThisYear: sumByCurrency(paidThisYear),
    openCount: open.length,
    overdueCount: open.filter((i) => i.overdue).length,
    year,
    onlineFeeProvider: feeProvider ? paymentProviderLabel(feeProvider) : null,
    onlineFeeMethods: feeProvider ? providerMethods(feeProvider) : null,
  };
}

/** Kurzfassung für das Dashboard: Anzahl und Summe offener Posten über alle Quellen. */
export async function summarizeMyOpenPayments(ctx: TenantCtx, now: Date) {
  const tenantId = ctx.tenant.id;
  const userId = ctx.user.id;
  const src = enabledSources(ctx);
  const [fees, invoices, ammo] = await Promise.all([
    src.fee ? db.feeInvoice.findMany({ where: { tenantId, userId, status: "OPEN" }, select: { id: true, status: true, amountCents: true, currency: true, dueAt: true }, orderBy: { dueAt: "asc" } }) : Promise.resolve([]),
    src.booking ? db.invoice.findMany({ where: { tenantId, status: "OPEN", booking: { userId } }, select: { amountCents: true, currency: true, dueAt: true } }) : Promise.resolve([]),
    src.ammo
      ? db.ammoOrder.findMany({ where: { tenantId, userId, status: "ISSUED", paymentStatus: "UNPAID", invoiceNumber: { not: null } }, select: { totalCents: true, currency: true, dueAt: true } })
      : Promise.resolve([]),
  ]);
  const rows = [
    ...fees,
    ...invoices,
    ...ammo.map((a) => ({ amountCents: a.totalCents, currency: a.currency, dueAt: a.dueAt })),
  ];
  const dues = rows.map((r) => r.dueAt).filter((d): d is Date => !!d).sort((a, b) => a.getTime() - b.getTime());
  // «Online bezahlen» nur für Beitragsrechnungen (nie Munition): eine Rechnung → direkt zur Zahlseite, sonst Übersicht.
  const feeProvider = fees.length ? await getOnlineFeeProviderKey(tenantId) : null;
  const payable = sourceAllowsOnlinePayment("FEE") ? fees.filter((f) => canPayFeeInvoiceOnline(f, feeProvider)) : [];
  const onlinePay = feeProvider && payable.length
    ? { href: payable.length === 1 ? feeInvoicePayPath(payable[0]!.id) : "/payments", count: payable.length, provider: paymentProviderLabel(feeProvider), methods: providerMethods(feeProvider) }
    : null;
  return {
    count: rows.length,
    totals: sumByCurrency(rows),
    overdue: rows.filter((r) => r.dueAt && isOverdue(r.dueAt, now)).length,
    nextDue: dues[0] ?? null,
    onlinePay,
  };
}

function providerLabel(p: string) {
  return p === "WORLDLINE" ? "Worldline" : paymentProviderLabel(p);
}

/* ------------------------------------------------------------------ Verwaltung */

export type OpenItemsOverview = {
  items: PaymentItem[];
  bySource: Array<{ source: PaymentSource; count: number; overdue: number; totals: Array<{ currency: string; cents: number }> }>;
  totals: Array<{ currency: string; cents: number }>;
  overdueTotals: Array<{ currency: string; cents: number }>;
  overdueCount: number;
};

/** Alle offenen Posten des Vereins über alle aktiven Quellen (für /admin/payments und CSV). */
export async function listOpenItems(ctx: TenantCtx, now: Date): Promise<OpenItemsOverview> {
  const tenantId = ctx.tenant.id;
  const src = enabledSources(ctx);
  const [profile, fees, invoices, ammo] = await Promise.all([
    getBillingProfile(tenantId, ctx.tenant.name),
    src.fee
      ? db.feeInvoice.findMany({
          where: { tenantId, status: "OPEN" },
          select: { id: true, number: true, year: true, memberName: true, categoryName: true, amountCents: true, currency: true, issuedAt: true, dueAt: true, reference: true, runId: true, membershipId: true, run: { select: { title: true } } },
          orderBy: { dueAt: "asc" },
          take: 5000,
        })
      : Promise.resolve([]),
    src.booking
      ? db.invoice.findMany({
          where: { tenantId, status: "OPEN" },
          select: { id: true, number: true, amountCents: true, currency: true, issuedAt: true, dueAt: true, reference: true, bookingId: true, booking: { select: { user: { select: { name: true } }, resource: { select: { name: true } } } } },
          orderBy: { dueAt: "asc" },
          take: 5000,
        })
      : Promise.resolve([]),
    src.ammo
      ? db.ammoOrder.findMany({
          where: { tenantId, status: "ISSUED", paymentStatus: "UNPAID", invoiceNumber: { not: null } },
          select: { id: true, invoiceNumber: true, totalCents: true, currency: true, invoiceIssuedAt: true, dueAt: true, reference: true, user: { select: { name: true } } },
          orderBy: { dueAt: "asc" },
          take: 5000,
        })
      : Promise.resolve([]),
  ]);

  // QR-Referenzen nur mit QR-IBAN ausweisen (wie auf der QR-Rechnung).
  const ref = (r: string | null) => (profile.qrIban ? r : null);
  const items: PaymentItem[] = [
    ...fees.map<PaymentItem>((f) => ({
      key: `FEE:${f.id}`, source: "FEE", sourceLabel: feeInvoiceSourceLabel(f), id: f.id, number: f.number,
      title: feeInvoiceTitle(f, `Mitgliederbeitrag ${f.year}`), detail: isStandaloneFeeInvoice(f) ? null : f.categoryName, memberName: f.memberName,
      amountCents: f.amountCents, currency: f.currency, status: "OPEN", group: "open",
      issuedAt: f.issuedAt, dueAt: f.dueAt, paidAt: null, overdue: isOverdue(f.dueAt, now), reference: ref(f.reference),
      href: `/billing/invoices/${f.id}/print`, external: true,
    })),
    ...invoices.map<PaymentItem>((i) => ({
      key: `BOOKING:${i.id}`, source: "BOOKING", id: i.id, number: i.number,
      title: `Reservation ${i.booking.resource.name}`, detail: null, memberName: i.booking.user?.name ?? "Gast",
      amountCents: i.amountCents, currency: i.currency, status: "OPEN", group: "open",
      issuedAt: i.issuedAt, dueAt: i.dueAt, paidAt: null, overdue: isOverdue(i.dueAt, now), reference: ref(i.reference),
      href: `/bookings/${i.bookingId}/invoice`, external: true,
    })),
    ...ammo.map<PaymentItem>((a) => ({
      key: `AMMO:${a.id}`, source: "AMMO", id: a.id, number: a.invoiceNumber ?? "",
      title: "Munition", detail: null, memberName: a.user?.name ?? "Ehemaliges Mitglied",
      amountCents: a.totalCents, currency: a.currency, status: "OPEN", group: "open",
      issuedAt: a.invoiceIssuedAt, dueAt: a.dueAt, paidAt: null, overdue: !!a.dueAt && isOverdue(a.dueAt, now), reference: ref(a.reference),
      href: `/ammo/${a.id}/invoice`, external: true,
    })),
  ];

  const sorted = sortPaymentItems(items);
  const sources: PaymentSource[] = [...(src.fee ? (["FEE"] as const) : []), ...(src.booking ? (["BOOKING"] as const) : []), ...(src.ammo ? (["AMMO"] as const) : [])];
  const overdue = items.filter((i) => i.overdue);
  return {
    items: sorted,
    bySource: sources.map((s) => {
      const list = items.filter((i) => i.source === s);
      return { source: s, count: list.length, overdue: list.filter((i) => i.overdue).length, totals: sumByCurrency(list) };
    }),
    totals: sumByCurrency(items),
    overdueTotals: sumByCurrency(overdue),
    overdueCount: overdue.length,
  };
}
