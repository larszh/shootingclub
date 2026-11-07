import { z } from "zod";

/**
 * Buchhaltungsexport: Kontenplan (AccountingSettings) und gemeinsame Typen. Rein (ohne DB),
 * damit Seite, Export-Route, Seed und Tests dieselben Definitionen verwenden.
 */

export type AccountKey = "bankAccount" | "cashAccount" | "receivableAccount" | "feeAccount" | "bookingAccount" | "ammoAccount" | "workFeeAccount" | "kioskAccount" | "feesExpenseAccount";

export type AccountPlan = Record<AccountKey, string>;

/** Standardkonten nach Schweizer KMU-Kontenrahmen (identisch mit den Defaults im Prisma-Schema). */
export const DEFAULT_ACCOUNTS: AccountPlan = {
  bankAccount: "1020",
  cashAccount: "1000",
  receivableAccount: "1100",
  feeAccount: "3000",
  bookingAccount: "3400",
  ammoAccount: "3200",
  workFeeAccount: "3010",
  kioskAccount: "3600",
  feesExpenseAccount: "6940",
};

export const ACCOUNT_FIELDS: Array<{ key: AccountKey; label: string; hint: string }> = [
  { key: "bankAccount", label: "Bank / Post", hint: "Aktivkonto für Zahlungseingänge per Bank, Post und online (KMU 1020 Bankguthaben)." },
  { key: "cashAccount", label: "Kasse", hint: "Aktivkonto für Bargeld (KMU 1000 Kasse): Barverkäufe der Schützenstube und Reservationen «Bar / vor Ort». Wird die Kasse auf die Bank einbezahlt, bucht ihr das in der Buchhaltung (Bank / Kasse)." },
  { key: "receivableAccount", label: "Debitoren", hint: "Forderungen aus Rechnungen (KMU 1100). Rechnung ausgestellt: Soll Debitoren, bezahlt: Haben Debitoren." },
  { key: "feeAccount", label: "Mitgliederbeiträge", hint: "Ertrag aus Jahresbeiträgen und Vereinsrechnungen (KMU 3000)." },
  { key: "workFeeAccount", label: "Ersatzabgabe Arbeitsstunden", hint: "Ertrag aus Rechnungen, deren Bezeichnung mit «Ersatzabgabe» beginnt (Vorschlag 3010)." },
  { key: "bookingAccount", label: "Standmiete / Reservationen", hint: "Ertrag aus Reservationsrechnungen sowie Online- und Barzahlungen von Reservationen (Vorschlag 3400)." },
  { key: "kioskAccount", label: "Ertrag Schützenstube", hint: "Ertrag aus Rechnungen der Schützenstube (Konsumationen auf Rechnung) und aus Barverkäufen an der Theke (Vorschlag 3600)." },
  { key: "ammoAccount", label: "Munitionsverkauf", hint: "Ertrag aus Munitionsrechnungen (Vorschlag 3200). Munition wird nur per Rechnung verkauft, nie online." },
  { key: "feesExpenseAccount", label: "Zahlungsgebühren", hint: "Aufwand für Gebühren der Zahlungsanbieter (KMU 6940). Die Anbieter melden die Gebühren nicht pro Zahlung an Standchef; bucht sie anhand der Abrechnung von Payrexx, Stripe, Worldline oder SumUp manuell (Zahlungsgebühren / Bank)." },
];

export const ACCOUNT_LABEL: Record<AccountKey, string> = Object.fromEntries(ACCOUNT_FIELDS.map((f) => [f.key, f.label])) as Record<AccountKey, string>;

const accountNumber = z
  .string()
  .trim()
  .min(1, "Bitte eine Kontonummer angeben.")
  .max(20, "Kontonummer zu lang (max. 20 Zeichen).")
  .regex(/^[A-Za-z0-9][A-Za-z0-9.\-]*$/, "Kontonummern bestehen aus Ziffern, Buchstaben, Punkt oder Bindestrich.");

export const accountPlanSchema = z.object(
  Object.fromEntries(ACCOUNT_FIELDS.map((f) => [f.key, accountNumber])) as Record<AccountKey, typeof accountNumber>,
);

/** Kontenplan aus der DB (oder Standard), nur bekannte Felder. */
export function toAccountPlan(row: Partial<Record<AccountKey, string | null>> | null | undefined): AccountPlan {
  const plan = { ...DEFAULT_ACCOUNTS };
  if (!row) return plan;
  for (const f of ACCOUNT_FIELDS) {
    const v = row[f.key];
    if (typeof v === "string" && v.trim()) plan[f.key] = v.trim();
  }
  return plan;
}

/* ------------------------------------------------------------------ Exportformate */

export type ExportFormat = "banana" | "bexio" | "csv";

export const EXPORT_FORMATS: Array<{ key: ExportFormat; label: string; hint: string; extension: string }> = [
  {
    key: "banana",
    label: "Banana Buchhaltung",
    hint: "Textdatei mit Tabulatoren und den Banana-Spaltennamen (Date, Doc, Description, AccountDebit, AccountCredit, Amount), Datum im Format JJJJ-MM-TT. In Banana: Aktionen › In Buchhaltung importieren › Buchungen › Textdatei mit Spaltenüberschriften. Prüft vor dem Import, ob die Kontonummern im Kontenplan existieren.",
    extension: "txt",
  },
  {
    key: "bexio",
    label: "bexio (CSV für manuellen Import)",
    hint: "CSV mit Semikolon (Datum;Beleg;Text;Soll;Haben;Betrag). Beim Import in bexio müsst ihr die Spalten der Zuordnung selbst auswählen; die Konten müssen im bexio-Kontenplan vorhanden sein.",
    extension: "csv",
  },
  {
    key: "csv",
    label: "CSV (allgemein)",
    hint: "Für Excel, Numbers oder andere Programme: zusätzlich mit Währung, Bereich und Buchungsart.",
    extension: "csv",
  },
];

export function isExportFormat(v: unknown): v is ExportFormat {
  return v === "banana" || v === "bexio" || v === "csv";
}
