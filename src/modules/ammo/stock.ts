/**
 * Munitionskontrolle: reine Bestandslogik (ohne DB), gemeinsam für Client und Server.
 * Bewegungen werden in Verkaufseinheiten (z.B. Schachteln) gebucht; positiv = Zugang, negativ = Abgang.
 */
import { formatDateTimeZurich, formatDateZurich } from "@/lib/time";

export const STOCK_KINDS = ["RECEIPT", "ISSUE", "SALE", "RETURN", "INVENTORY", "CORRECTION"] as const;
export type StockKind = (typeof STOCK_KINDS)[number];

type Tone = "neutral" | "accent" | "ok" | "warn" | "danger" | "outline";

export const STOCK_KIND: Record<StockKind, { label: string; short: string; tone: Tone; sign: 1 | -1 | 0 }> = {
  RECEIPT: { label: "Wareneingang", short: "Eingang", tone: "ok", sign: 1 },
  ISSUE: { label: "Abgabe am Stand", short: "Abgabe", tone: "accent", sign: -1 },
  SALE: { label: "Verkauf", short: "Verkauf", tone: "neutral", sign: -1 },
  RETURN: { label: "Rücknahme", short: "Rücknahme", tone: "ok", sign: 1 },
  INVENTORY: { label: "Inventur", short: "Inventur", tone: "warn", sign: 0 },
  CORRECTION: { label: "Korrektur", short: "Korrektur", tone: "warn", sign: 0 },
};

export function stockKindInfo(k: string) {
  return STOCK_KIND[k as StockKind] ?? { label: k, short: k, tone: "neutral" as Tone, sign: 0 as const };
}

export function isStockKind(k: string): k is StockKind {
  return (STOCK_KINDS as readonly string[]).includes(k);
}

/** Arten, die im Journal von Hand gebucht werden (Verkauf und Inventur entstehen über eigene Abläufe). */
export const MANUAL_KINDS = ["RECEIPT", "ISSUE", "RETURN", "CORRECTION"] as const;
export type ManualKind = (typeof MANUAL_KINDS)[number];

export const FUNDING_TYPES = ["FEDERAL_FREE", "SUBSIDIZED", "COMMERCIAL"] as const;
export type FundingType = (typeof FUNDING_TYPES)[number];

export const FUNDING: Record<FundingType, { label: string; short: string; hint: string }> = {
  FEDERAL_FREE: { label: "Bund (gratis)", short: "Bund gratis", hint: "Vom Bund gratis abgegebene Munition, z.B. für Bundesübungen." },
  SUBSIDIZED: { label: "Subventioniert", short: "Subventioniert", hint: "Vom Bund verbilligt bezogene Munition." },
  COMMERCIAL: { label: "Kommerziell", short: "Kommerziell", hint: "Im Handel gekaufte Munition." },
};

export function fundingInfo(f: string) {
  return FUNDING[f as FundingType] ?? FUNDING.COMMERCIAL;
}

export function isFundingType(f: string): f is FundingType {
  return (FUNDING_TYPES as readonly string[]).includes(f);
}

export const STOCK_CHECK_HINT =
  "Werte bitte mit den aktuellen Vorgaben (VBS/SSV/Kanton) und den Lieferscheinen prüfen. Die App hilft bei der Buchführung, die Verantwortung für die Munitionskontrolle bleibt beim Verein.";

/**
 * Vorzeichenbehaftete Menge einer Bewegung. Eingang/Rücknahme positiv, Abgabe/Verkauf negativ,
 * Inventur/Korrektur mit der übergebenen Richtung.
 */
export function signedUnits(kind: StockKind, quantity: number, direction: 1 | -1 = 1) {
  const q = Math.abs(Math.trunc(quantity));
  const s = STOCK_KIND[kind].sign;
  return s === 0 ? q * direction : q * s;
}

/**
 * Neuer Bestand nach einer Bewegung. Nie unter null. Ohne geführten Bestand (null) setzt ein Zugang
 * den Bestand; ein Abgang ist dann nicht möglich.
 */
export function applyStock(current: number | null, delta: number): { ok: true; next: number } | { ok: false; error: string } {
  if (!Number.isInteger(delta)) return { ok: false, error: "Menge: ganze Zahl." };
  if (current === null) {
    if (delta < 0) return { ok: false, error: "Für dieses Produkt wird kein Bestand geführt." };
    return { ok: true, next: delta };
  }
  const next = current + delta;
  if (next < 0) return { ok: false, error: `Zu wenig an Lager (Bestand ${current}).` };
  return { ok: true, next };
}

/** Inventur: Differenz gezählt minus Buchbestand (ohne geführten Bestand = 0). */
export function inventoryDelta(current: number | null, counted: number) {
  return counted - (current ?? 0);
}

export type SummaryProduct = { id: string; name: string; caliber: string; unitLabel: string; roundsPerUnit: number; fundingType: string; stockUnits: number | null };
export type SummaryMovement = { productId: string; kind: string; units: number };

export type SummaryRow = {
  receipt: number; issue: number; sale: number; returned: number; adjust: number; opening: number; closing: number;
};

export type ProductSummary = SummaryRow & { product: SummaryProduct; tracked: boolean };
export type FundingSummary = { fundingType: FundingType; label: string; products: ProductSummary[]; units: SummaryRow; rounds: SummaryRow };

const emptyRow = (): SummaryRow => ({ receipt: 0, issue: 0, sale: 0, returned: 0, adjust: 0, opening: 0, closing: 0 });

/**
 * Jahresübersicht pro Finanzierungsart. Eingang, Abgabe, Verkauf, Rücknahme und Korrekturen (Inventur
 * und Korrektur) als positive Mengen bzw. Korrekturen mit Vorzeichen. Endbestand = heutiger Bestand
 * minus Bewegungen nach dem Jahr; Anfangsbestand = Endbestand minus Bewegungen im Jahr.
 */
export function yearSummary(products: SummaryProduct[], inYear: SummaryMovement[], afterYear: SummaryMovement[]): FundingSummary[] {
  const byProduct = new Map<string, SummaryRow>();
  for (const p of products) byProduct.set(p.id, emptyRow());
  const net = new Map<string, number>();
  for (const m of inYear) {
    const r = byProduct.get(m.productId);
    if (!r) continue;
    net.set(m.productId, (net.get(m.productId) ?? 0) + m.units);
    switch (m.kind) {
      case "RECEIPT": r.receipt += m.units; break;
      case "ISSUE": r.issue += -m.units; break;
      case "SALE": r.sale += -m.units; break;
      case "RETURN": r.returned += m.units; break;
      default: r.adjust += m.units;
    }
  }
  const after = new Map<string, number>();
  for (const m of afterYear) after.set(m.productId, (after.get(m.productId) ?? 0) + m.units);

  return FUNDING_TYPES.map((ft) => {
    const list = products.filter((p) => (isFundingType(p.fundingType) ? p.fundingType : "COMMERCIAL") === ft);
    const units = emptyRow();
    const rounds = emptyRow();
    const rows = list.map((p): ProductSummary => {
      const r = byProduct.get(p.id)!;
      r.closing = (p.stockUnits ?? 0) - (after.get(p.id) ?? 0);
      r.opening = r.closing - (net.get(p.id) ?? 0);
      for (const k of Object.keys(units) as (keyof SummaryRow)[]) {
        units[k] += r[k];
        rounds[k] += r[k] * p.roundsPerUnit;
      }
      return { ...r, product: p, tracked: p.stockUnits !== null };
    });
    return { fundingType: ft, label: FUNDING[ft].label, products: rows, units, rounds };
  });
}

/** Jahr aus der URL (2000 bis laufendes Jahr), sonst das laufende Jahr. */
export function parseSummaryYear(raw: string | null | undefined, currentYear: number) {
  const y = Number(raw);
  return raw && Number.isInteger(y) && y >= 2000 && y <= currentYear ? y : currentYear;
}

/**
 * Anzeige des Buchungsdatums: Nur «jetzt» gebuchte Bewegungen (Datum ≈ Erfassungszeit) haben eine echte
 * Uhrzeit. Rückdatierte Buchungen tragen nur einen Kalendertag (intern Mittag) und werden ohne Zeit gezeigt.
 */
export function formatMovementDate(date: Date, createdAt: Date) {
  return Math.abs(date.getTime() - createdAt.getTime()) < 5 * 60_000 ? formatDateTimeZurich(date) : formatDateZurich(date, { weekday: undefined });
}
