/**
 * Reine Regeln der Online-Zahlung (ohne DB, getestet in logic.test.ts).
 *
 * Wichtig: Munition (AmmoOrder) ist nie online bezahlbar (AGB der Zahlungsanbieter verbieten
 * Munitions- und Waffenverkäufe). Online bezahlbar sind nur Reservationen und Rechnungen aus
 * FeeInvoice (Mitgliederbeiträge, Ersatzabgabe, Schützenstube und weitere Vereinsrechnungen).
 */

export const ONLINE_PAYABLE_KINDS = ["BOOKING", "FEE_INVOICE"] as const;
export type OnlinePayableKind = (typeof ONLINE_PAYABLE_KINDS)[number];

export class NotOnlinePayableError extends Error {
  constructor(kind: string) {
    super(kind === "AMMO" ? "Munition kann nicht online bezahlt werden (nur per Rechnung)." : `Online-Zahlung für «${kind}» nicht möglich.`);
    this.name = "NotOnlinePayableError";
  }
}

export function isOnlinePayableKind(kind: unknown): kind is OnlinePayableKind {
  return typeof kind === "string" && (ONLINE_PAYABLE_KINDS as readonly string[]).includes(kind);
}

/** Wirft für alles ausser Reservation und Beitragsrechnung – insbesondere für Munition. */
export function assertOnlinePayable(kind: string): asserts kind is OnlinePayableKind {
  if (!isOnlinePayableKind(kind)) throw new NotOnlinePayableError(kind);
}

/** Quellen der Zahlungsübersicht, die einen «Online bezahlen»-Knopf erhalten dürfen. */
export function sourceAllowsOnlinePayment(source: string): boolean {
  return source === "FEE";
}

/** Betrag und Währung, die der Anbieter meldet, müssen exakt passen (null = unbekannt = nein). */
export function amountMatches(expected: { amountCents: number; currency: string }, reported: { amountCents?: number | null; currency?: string | null }): boolean {
  if (reported.amountCents == null || !reported.currency) return false;
  return reported.amountCents === expected.amountCents && reported.currency.trim().toUpperCase() === expected.currency.trim().toUpperCase();
}

export type SettlementDecision = "MARK_PAID" | "ALREADY_PAID" | "MISMATCH";

/** Soll eine Zahlung als bezahlt verbucht werden? Idempotent: bereits bezahlt → nichts tun. */
export function settlementDecision(
  payment: { status: string; amountCents: number; currency: string },
  reported: { amountCents?: number | null; currency?: string | null },
): SettlementDecision {
  if (payment.status === "PAID") return "ALREADY_PAID";
  if (!amountMatches(payment, reported)) return "MISMATCH";
  return "MARK_PAID";
}

export type FeeInvoiceSettlement = { action: "MARK_PAID" } | { action: "NOTE_ONLY"; note: string };

/**
 * Was mit der Beitragsrechnung geschieht, wenn eine Online-Zahlung eingeht: offen → bezahlt;
 * bereits bezahlt (z.B. zusätzlich per Bank) oder storniert → nur ein Hinweis zur Rückerstattung.
 */
export function feeInvoiceSettlement(invoice: { status: string }, providerName: string): FeeInvoiceSettlement {
  if (invoice.status === "OPEN") return { action: "MARK_PAID" };
  if (invoice.status === "PAID") return { action: "NOTE_ONLY", note: `Doppelt bezahlt: Online (${providerName}) – Rückerstattung prüfen` };
  return { action: "NOTE_ONLY", note: `Online (${providerName}) nach Storno bezahlt – Rückerstattung prüfen` };
}

/** Zahlungsnotiz für eine online bezahlte Rechnung. */
export function onlinePaymentNote(providerName: string) {
  return `Online (${providerName})`;
}

/** Kann ein Mitglied diese Beitragsrechnung online bezahlen? */
export function canPayFeeInvoiceOnline(
  invoice: { status: string; amountCents: number; currency: string },
  providerKey: string | null | undefined,
): boolean {
  if (!providerKey || providerKey === "NONE") return false;
  if (invoice.status !== "OPEN") return false;
  if (!Number.isInteger(invoice.amountCents) || invoice.amountCents <= 0) return false;
  return ["CHF", "EUR"].includes(invoice.currency.toUpperCase());
}

export function feeInvoicePayPath(invoiceId: string) {
  return `/billing/invoices/${invoiceId}/pay`;
}

export function feeInvoiceReturnPath(invoiceId: string) {
  return `/billing/invoices/${invoiceId}/return`;
}

/** Eine laufende Zahlung gilt nach dieser Zeit als verwaist (neuer Checkout erlaubt, Admin-Liste). */
export const PENDING_STALE_MINUTES = 60;

/**
 * Prüfhinweis an einer Zahlung (im `detailsJson` der Payment-Zeile, neben den Anbieterdaten):
 * - REFUND: Geld ist eingegangen, die Rechnung/Reservation war aber schon bezahlt oder storniert.
 * - AMOUNT_MISMATCH: der Anbieter meldet einen anderen Betrag/eine andere Währung (Zahlung bleibt offen).
 */
export type PaymentReview = { kind: "REFUND" | "AMOUNT_MISMATCH"; note: string };

const REVIEW_KEY = "standchefReview";

/** detailsJson schreiben: Anbieterdaten, bei Bedarf mit Prüfhinweis umhüllt. */
export function paymentDetailsJson(details: unknown, review?: PaymentReview | null): string {
  return JSON.stringify(review ? { [REVIEW_KEY]: review, details: details ?? null } : (details ?? null));
}

/** Prüfhinweis aus detailsJson lesen (null, wenn keiner da oder unlesbar). */
export function paymentReviewFromDetails(detailsJson: string | null | undefined): PaymentReview | null {
  if (!detailsJson) return null;
  try {
    const v: unknown = JSON.parse(detailsJson);
    if (!v || typeof v !== "object" || !(REVIEW_KEY in v)) return null;
    const r = (v as Record<string, unknown>)[REVIEW_KEY];
    if (!r || typeof r !== "object") return null;
    const { kind, note } = r as Record<string, unknown>;
    if ((kind !== "REFUND" && kind !== "AMOUNT_MISMATCH") || typeof note !== "string") return null;
    return { kind, note };
  } catch {
    return null;
  }
}

/** Hinweis für die Zahlungslisten: Rückerstattung prüfen (bezahlt) bzw. Betrag weicht ab (offen). */
export function paymentReviewBadge(payment: { status: string; detailsJson?: string | null }): { label: string; tone: "warn" | "accent" } | null {
  const r = paymentReviewFromDetails(payment.detailsJson);
  if (!r) return null;
  if (r.kind === "REFUND" && payment.status === "PAID") return { label: "Rückerstattung prüfen", tone: "accent" };
  if (r.kind === "AMOUNT_MISMATCH" && payment.status === "PENDING") return { label: "Betrag weicht ab", tone: "warn" };
  return null;
}
