import { zurichParts } from "@/lib/time";
import type { AccountKey, AccountPlan } from "./types";

/**
 * Journal (doppelte Buchhaltung) aus normalisierten Belegen. Rein, ohne DB.
 *
 * Regeln (Buchungssatz «Soll / Haben»):
 * - Rechnung ausgestellt (issuedAt): Debitoren / Ertragskonto
 * - Rechnung bezahlt (paidAt): Bank / Debitoren
 *   Wurde die Rechnung online bezahlt (Payment), entsteht die Zahlungsbuchung aus jeder Online-Zahlung
 *   am Zahlungsdatum; das Bezahlt-Datum der Rechnung wird dann nicht zusätzlich gebucht (sonst doppelt).
 *   Online-Zahlung erstattet: Debitoren / Bank am Erstattungsdatum.
 * - Rechnung nach Ausstellung storniert (cancelledAt): Ertragskonto / Debitoren (Gegenbuchung)
 * - Online-Zahlung ohne Rechnung (Reservation direkt bezahlt): Bank / Ertragskonto,
 *   Rückerstattung: Ertragskonto / Bank
 *
 * Ertragskonto nach Art: Mitgliederbeitrag und Vereinsrechnung → feeAccount, Ersatzabgabe →
 * workFeeAccount, Schützenstube (Kiosk) → feeAccount (der Kontenplan hat kein eigenes Kiosk-Konto),
 * Reservation → bookingAccount, Munition → ammoAccount.
 *
 * Das Journal bildet den aktuellen Stand der Belege ab: Wird eine Zahlung zurückgesetzt, verschwindet
 * ihre Buchung auch aus früher exportierten Perioden. Deshalb nur abgeschlossene Perioden exportieren.
 */

export type RevenueKind = "fee" | "workfee" | "kiosk" | "booking" | "ammo";
export type DocSource = "FEE" | "BOOKING" | "AMMO" | "ONLINE";
export type EntryType = "issue" | "payment" | "reversal" | "refund";

export const REVENUE_ACCOUNT: Record<RevenueKind, AccountKey> = {
  fee: "feeAccount",
  workfee: "workFeeAccount",
  kiosk: "feeAccount",
  booking: "bookingAccount",
  ammo: "ammoAccount",
};

export const KIND_LABEL: Record<RevenueKind, string> = {
  fee: "Beitrag",
  workfee: "Ersatzabgabe",
  kiosk: "Schützenstube",
  booking: "Reservation",
  ammo: "Munition",
};

export const ENTRY_TYPE_LABEL: Record<EntryType, string> = {
  issue: "Rechnung",
  payment: "Zahlung",
  reversal: "Storno",
  refund: "Rückerstattung",
};

export const SOURCE_LABEL: Record<DocSource, string> = {
  FEE: "Beiträge & Abgaben",
  BOOKING: "Reservationen",
  AMMO: "Munition",
  ONLINE: "Online-Zahlungen",
};

export type OnlinePayment = {
  id: string;
  provider: string;
  amountCents: number;
  currency: string;
  paidAt: Date;
  /** Gesetzt, wenn die Zahlung erstattet wurde */
  refundedAt: Date | null;
};

export type InvoiceDoc = {
  type: "invoice";
  source: Exclude<DocSource, "ONLINE">;
  id: string;
  number: string;
  kind: RevenueKind;
  /** Kurzbeschreibung ohne Personendaten, z.B. «Mitgliederbeitrag 2026 Aktiv» */
  label: string;
  amountCents: number;
  currency: string;
  issuedAt: Date | null;
  status: "OPEN" | "PAID" | "CANCELLED";
  paidAt: Date | null;
  cancelledAt: Date | null;
  onlinePayments: OnlinePayment[];
};

export type PaymentDoc = {
  type: "payment";
  source: "ONLINE";
  id: string;
  /** Belegnummer (Online-Zahlungen ohne Rechnung haben keine eigene Nummer) */
  number: string;
  kind: RevenueKind;
  label: string;
  payment: OnlinePayment;
};

export type JournalDocument = InvoiceDoc | PaymentDoc;

export type JournalEntry = {
  /** Kalendertag in Schweizer Zeit, YYYY-MM-DD */
  date: string;
  doc: string;
  text: string;
  debit: string;
  credit: string;
  amountCents: number;
  currency: string;
  source: DocSource;
  kind: RevenueKind;
  type: EntryType;
  docId: string;
};

const TYPE_ORDER: Record<EntryType, number> = { issue: 0, payment: 1, refund: 2, reversal: 3 };
const TEXT_MAX = 191;

/** Belegtext: Leerräume zusammenfassen, Tabs/Zeilenumbrüche entfernen, Länge begrenzen. */
export function cleanText(s: string, max = TEXT_MAX) {
  const printable = Array.from(s, (ch) => (ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127 ? " " : ch)).join("");
  const t = printable.replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + "…" : t;
}

export function providerLabel(p: string) {
  const map: Record<string, string> = { STRIPE: "Stripe", WORLDLINE: "Worldline", SUMUP: "SumUp", PAYREXX: "Payrexx" };
  return map[p.toUpperCase()] ?? p;
}

/** Art einer Beitragsrechnung: Ersatzabgabe an der Bezeichnung, Kiosk an der Verknüpfung mit Konsumationen. */
export function feeInvoiceKind(categoryName: string, isKiosk: boolean): RevenueKind {
  if (isKiosk) return "kiosk";
  if (categoryName.trim().toLowerCase().startsWith("ersatzabgabe")) return "workfee";
  return "fee";
}

const day = (d: Date) => zurichParts(d).dateStr;

export type JournalOptions = { from: string; to: string };

/** Alle Buchungen der Belege im Zeitraum [from, to] (inklusive), sortiert nach Datum und Beleg. */
export function buildJournal(docs: JournalDocument[], accounts: AccountPlan, opts: JournalOptions): JournalEntry[] {
  const out: JournalEntry[] = [];
  const push = (e: Omit<JournalEntry, "text"> & { text: string }) => {
    if (e.amountCents <= 0 || e.date < opts.from || e.date > opts.to) return;
    out.push({ ...e, text: cleanText(e.text) });
  };

  for (const d of docs) {
    const revenue = accounts[REVENUE_ACCOUNT[d.kind]];
    const bank = accounts.bankAccount;
    const debtors = accounts.receivableAccount;
    const base = { doc: cleanText(d.number, 64), source: d.source, kind: d.kind, docId: d.id };

    if (d.type === "payment") {
      const p = d.payment;
      const via = `Online-Zahlung ${providerLabel(p.provider)}`;
      push({ ...base, type: "payment", date: day(p.paidAt), text: `${via} ${d.label}`, debit: bank, credit: revenue, amountCents: p.amountCents, currency: p.currency });
      if (p.refundedAt) {
        push({ ...base, type: "refund", date: day(p.refundedAt), text: `Rückerstattung ${via} ${d.label}`, debit: revenue, credit: bank, amountCents: p.amountCents, currency: p.currency });
      }
      continue;
    }

    if (d.amountCents <= 0 || !d.issuedAt) continue;
    const label = `${d.number} ${d.label}`;
    const money = { amountCents: d.amountCents, currency: d.currency };

    push({ ...base, ...money, type: "issue", date: day(d.issuedAt), text: `Rechnung ${label}`, debit: debtors, credit: revenue });

    if (d.onlinePayments.length) {
      for (const p of d.onlinePayments) {
        const via = `Online-Zahlung ${providerLabel(p.provider)}`;
        const pm = { amountCents: p.amountCents, currency: p.currency };
        push({ ...base, ...pm, type: "payment", date: day(p.paidAt), text: `${via} ${label}`, debit: bank, credit: debtors });
        if (p.refundedAt) push({ ...base, ...pm, type: "refund", date: day(p.refundedAt), text: `Rückerstattung ${via} ${label}`, debit: debtors, credit: bank });
      }
    } else if (d.status === "PAID") {
      push({ ...base, ...money, type: "payment", date: day(d.paidAt ?? d.issuedAt), text: `Zahlung ${label}`, debit: bank, credit: debtors });
    }

    if (d.status === "CANCELLED") {
      push({ ...base, ...money, type: "reversal", date: day(d.cancelledAt ?? d.issuedAt), text: `Storno ${label}`, debit: revenue, credit: debtors });
    }
  }

  return out.sort((a, b) =>
    a.date !== b.date ? (a.date < b.date ? -1 : 1)
      : a.doc !== b.doc ? a.doc.localeCompare(b.doc, "de-CH", { numeric: true })
        : TYPE_ORDER[a.type] - TYPE_ORDER[b.type],
  );
}

/* ------------------------------------------------------------------ Kontensaldi */

export type AccountSummary = {
  account: string;
  /** Bezeichnungen aus dem Kontenplan (mehrere, wenn sich Rollen ein Konto teilen) */
  names: string[];
  debitCents: number;
  creditCents: number;
  /** Soll minus Haben: positiv = Sollsaldo (Aktiven, Aufwand), negativ = Habensaldo (Ertrag) */
  balanceCents: number;
  currency: string;
};

/** Saldo pro Konto (und Währung) im Zeitraum, sortiert nach Kontonummer. */
export function summarizeAccounts(entries: JournalEntry[], accounts: AccountPlan, labels: Record<AccountKey, string>): AccountSummary[] {
  const names = new Map<string, string[]>();
  for (const [key, number] of Object.entries(accounts) as Array<[AccountKey, string]>) {
    names.set(number, [...(names.get(number) ?? []), labels[key]]);
  }
  const map = new Map<string, AccountSummary>();
  const get = (account: string, currency: string) => {
    const k = `${account}\u0000${currency}`;
    let s = map.get(k);
    if (!s) {
      s = { account, names: names.get(account) ?? [], debitCents: 0, creditCents: 0, balanceCents: 0, currency };
      map.set(k, s);
    }
    return s;
  };
  for (const e of entries) {
    const d = get(e.debit, e.currency);
    d.debitCents += e.amountCents;
    d.balanceCents += e.amountCents;
    const c = get(e.credit, e.currency);
    c.creditCents += e.amountCents;
    c.balanceCents -= e.amountCents;
  }
  return [...map.values()].sort((a, b) => a.account.localeCompare(b.account, "de-CH", { numeric: true }) || a.currency.localeCompare(b.currency));
}

/** Summe aller Buchungen pro Währung (Kontrollsumme). */
export function journalTotals(entries: JournalEntry[]) {
  const map = new Map<string, number>();
  for (const e of entries) map.set(e.currency, (map.get(e.currency) ?? 0) + e.amountCents);
  return [...map.entries()].map(([currency, cents]) => ({ currency, cents }));
}
