/**
 * Einzelrechnungen (FeeInvoice ohne Jahreslauf): Art und Hinweise für die Verwaltung. Rein (ohne DB).
 * Einzelrechnungen entstehen aus der Schützenstube (Konsumationen) und der Ersatzabgabe für
 * Arbeitsstunden; Rückerstattungen erfolgen von Hand (Bank oder Backoffice des Zahlungsanbieters).
 */
import { isKioskInvoiceName, isKioskReleasedNote } from "../kiosk/logic";

export type StandaloneKind = "kiosk" | "workfee" | "other";

export const STANDALONE_KIND_LABEL: Record<StandaloneKind, string> = {
  kiosk: "Schützenstube",
  workfee: "Ersatzabgabe",
  other: "Vereinsrechnung",
};

/** Art: Schützenstube an verknüpften Einträgen oder der Bezeichnung, Ersatzabgabe an der Bezeichnung. */
export function standaloneKind(categoryName: string, linkedKioskEntries: number): StandaloneKind {
  if (linkedKioskEntries > 0 || isKioskInvoiceName(categoryName)) return "kiosk";
  if (categoryName.trim().toLowerCase().startsWith("ersatzabgabe")) return "workfee";
  return "other";
}

export type StandalonePayment = { status: string; provider: string; amountCents: number; review: { kind: "REFUND" | "AMOUNT_MISMATCH"; note: string } | null };

export type StandaloneHintInput = {
  status: string;
  amountCents: number;
  paymentNote: string | null;
  /** Online-Zahlungen mit Status PAID oder REFUNDED */
  payments: StandalonePayment[];
  kind: StandaloneKind;
  /** Stornierte Rechnung darf nicht mehr reaktiviert werden (Schützenstube-Einträge freigegeben) */
  reopenBlocked: boolean;
};

/** `text` deutsch (Protokoll, Tests); `key`/`vars` für die Anzeige in der Sprache der Verwaltung (Wörterbuch adm1). */
export type StandaloneHint = { tone: "warn" | "info"; text: string; key?: string; vars?: Record<string, string | number> };

/** Hinweise zu Rückerstattung und Doppelverrechnung, wichtigste zuerst. */
export function standaloneInvoiceHints(i: StandaloneHintInput): StandaloneHint[] {
  const out: StandaloneHint[] = [];
  const paidOnline = i.payments.filter((p) => p.status === "PAID");
  const refunded = i.payments.filter((p) => p.status === "REFUNDED");
  const reviewed = paidOnline.filter((p) => p.review?.kind === "REFUND");

  if (i.status === "CANCELLED" && paidOnline.length) {
    out.push({ tone: "warn", text: "Storniert, aber online bezahlt: Betrag im Backoffice des Zahlungsanbieters zurückerstatten.", key: "adm1.hint.cancelledPaidOnline" });
  } else if (reviewed.length) {
    out.push({ tone: "warn", text: `Rückerstattung prüfen: ${reviewed[0]!.review!.note}`, key: "adm1.hint.checkRefund", vars: { note: reviewed[0]!.review!.note } });
  } else if (paidOnline.length > 1 || (paidOnline.length === 1 && /Bankimport/.test(i.paymentNote ?? ""))) {
    out.push({ tone: "warn", text: "Mehrfach bezahlt (online und per Bank oder zweimal online): Rückerstattung prüfen.", key: "adm1.hint.paidTwice" });
  } else if (i.status === "CANCELLED" && /Bankimport/.test(i.paymentNote ?? "")) {
    out.push({ tone: "warn", text: "Storniert, aber per Bank bezahlt: Betrag zurücküberweisen.", key: "adm1.hint.cancelledPaidBank" });
  }
  if (refunded.length) out.push({ tone: "info", text: `${refunded.length === 1 ? "Eine Online-Zahlung wurde" : `${refunded.length} Online-Zahlungen wurden`} erstattet.`, key: refunded.length === 1 ? "adm1.hint.refunded.one" : "adm1.hint.refunded.other", vars: { n: refunded.length } });
  if (i.reopenBlocked || (i.kind === "kiosk" && isKioskReleasedNote(i.paymentNote))) {
    out.push({ tone: "info", text: "Die Konsumationen wurden freigegeben (wieder offen bzw. neu verrechnet). Diese Rechnung bleibt storniert.", key: "adm1.hint.released" });
  } else if (i.kind === "kiosk" && i.status === "CANCELLED") {
    out.push({ tone: "info", text: "Die Konsumationen sind noch mit dieser Rechnung verknüpft. Unter «Schützenstube» freigeben, um sie neu zu verrechnen.", key: "adm1.hint.linked" });
  }
  return out;
}

export type StandaloneStatusFilter = "all" | "open" | "paid" | "cancelled" | "attention";

export function parseStandaloneFilter(s: string | undefined): StandaloneStatusFilter {
  return s === "open" || s === "paid" || s === "cancelled" || s === "attention" ? s : "all";
}

export function matchesStandaloneFilter(f: StandaloneStatusFilter, inv: { status: string; hints: StandaloneHint[] }) {
  switch (f) {
    case "open": return inv.status === "OPEN";
    case "paid": return inv.status === "PAID";
    case "cancelled": return inv.status === "CANCELLED";
    case "attention": return inv.hints.some((h) => h.tone === "warn");
    default: return true;
  }
}
