import type { CamtCredit } from "./camt";

export type ImportStatus = "matched" | "amount_mismatch" | "already_paid" | "duplicate" | "ambiguous" | "unmatched";

export const IMPORT_STATUS_LABEL: Record<ImportStatus, { label: string; tone: "ok" | "warn" | "outline" | "accent" | "neutral" }> = {
  matched: { label: "Zugeordnet", tone: "ok" },
  amount_mismatch: { label: "Betrag weicht ab", tone: "warn" },
  already_paid: { label: "Bereits bezahlt", tone: "outline" },
  duplicate: { label: "Doppelt in Datei", tone: "outline" },
  ambiguous: { label: "Mehrdeutig", tone: "warn" },
  unmatched: { label: "Nicht gefunden", tone: "neutral" },
};

export type ImportTarget = {
  kind: "FEE" | "BOOKING";
  id: string;
  number: string;
  name: string;
  label: string;
  amountCents: number;
  currency: string;
  status: string;
};

export type ImportPreviewItem = CamtCredit & {
  status: ImportStatus;
  reason: string | null;
  matchedBy: "reference" | "number" | null;
  target: ImportTarget | null;
  candidates: Array<{ number: string; name: string }>;
};
