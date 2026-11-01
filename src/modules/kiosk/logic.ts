/**
 * Schützenstube: reine Logik (ohne Datenbank), testbar mit Vitest.
 * Zeiträume als Kalendertage "YYYY-MM-DD" (Schweizer Zeit, beide Enden inklusive).
 */
import { addDays, zurichParts, zurichToUtc } from "../../lib/time";

export const MONTHS_DE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

/** Rückgängig machen der letzten Erfassung ist so lange möglich. */
export const UNDO_WINDOW_MS = 2 * 60_000;
/** Maximale Länge eines Abrechnungszeitraums in Tagen. */
export const MAX_PERIOD_DAYS = 400;
export const MAX_QUANTITY = 99;
export const MAX_LINES = 40;

export type Period = { from: string; to: string };
export type PeriodPreset = Period & { key: string; label: string };

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDayKey(s: unknown): s is string {
  if (typeof s !== "string" || !DAY_RE.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m! - 1 && dt.getUTCDate() === d;
}

/** Letzter Tag des Monats (month 1–12). */
export function lastDayOfMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

const pad = (n: number) => String(n).padStart(2, "0");
const monthFirst = (y: number, m: number) => `${y}-${pad(m)}-01`;
const monthLast = (y: number, m: number) => `${y}-${pad(m)}-${pad(lastDayOfMonth(y, m))}`;

/** Anzahl Kalendertage im Zeitraum (inklusive). */
export function periodDays(p: Period) {
  const a = Date.parse(`${p.from}T00:00:00Z`);
  const b = Date.parse(`${p.to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000) + 1;
}

/** Prüft einen Zeitraum; gibt eine Fehlermeldung oder null zurück. */
export function validatePeriod(p: Partial<Period>): string | null {
  if (!isDayKey(p.from) || !isDayKey(p.to)) return "Bitte einen gültigen Zeitraum wählen.";
  if (p.from > p.to) return "Das Startdatum liegt nach dem Enddatum.";
  if (periodDays(p as Period) > MAX_PERIOD_DAYS) return "Der Zeitraum ist zu lang (höchstens ein Jahr).";
  return null;
}

/** Zeitraum als UTC-Grenzen: [start, end) von Mitternacht Schweizer Zeit bis Mitternacht nach dem Endtag. */
export function periodToUtcRange(p: Period) {
  return { start: zurichToUtc(p.from, "00:00"), end: zurichToUtc(addDays(p.to, 1), "00:00") };
}

const dmy = (s: string) => `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}`;
const dm = (s: string) => `${s.slice(8, 10)}.${s.slice(5, 7)}.`;

/**
 * Lesbare Bezeichnung: «Oktober 2026», «Oktober–Dezember 2026», «2026», «Q3 2026» wird bewusst nicht
 * verwendet (Monatsnamen sind für Mitglieder klarer). Sonst «01.09.–15.10.2026».
 */
export function periodLabel(p: Period): string {
  const [fy, fm, fd] = p.from.split("-").map(Number) as [number, number, number];
  const [ty, tm, td] = p.to.split("-").map(Number) as [number, number, number];
  const fullMonths = fd === 1 && td === lastDayOfMonth(ty, tm);
  if (fullMonths) {
    if (fy === ty && fm === 1 && tm === 12) return String(fy);
    if (fy === ty && fm === tm) return `${MONTHS_DE[fm - 1]} ${fy}`;
    if (fy === ty) return `${MONTHS_DE[fm - 1]}–${MONTHS_DE[tm - 1]} ${fy}`;
    return `${MONTHS_DE[fm - 1]} ${fy}–${MONTHS_DE[tm - 1]} ${ty}`;
  }
  if (p.from === p.to) return dmy(p.from);
  if (fy === ty) return `${dm(p.from)}–${dmy(p.to)}`;
  return `${dmy(p.from)}–${dmy(p.to)}`;
}

/** Rechnungsbezeichnung «Schützenstube <Zeitraum>» (max. 191 Zeichen). */
export function invoiceCategoryName(p: Period) {
  return `Schützenstube ${periodLabel(p)}`.slice(0, 191);
}

/** Rechnungsjahr: Jahr des letzten Tages im Zeitraum. */
export function invoiceYear(p: Period) {
  return Number(p.to.slice(0, 4));
}

/** Vorschläge für den Abrechnungszeitraum, ausgehend vom heutigen Tag (Schweizer Zeit). */
export function periodPresets(today: string): PeriodPreset[] {
  const [y, m] = today.split("-").map(Number) as [number, number];
  const prevM = m === 1 ? 12 : m - 1;
  const prevY = m === 1 ? y - 1 : y;
  const q = Math.floor((m - 1) / 3); // 0..3 aktuelles Quartal
  const pq = q === 0 ? 3 : q - 1;
  const pqY = q === 0 ? y - 1 : y;
  const qFrom = (yy: number, qq: number) => monthFirst(yy, qq * 3 + 1);
  const qTo = (yy: number, qq: number) => monthLast(yy, qq * 3 + 3);
  const list: Array<Omit<PeriodPreset, "label"> & { label?: string }> = [
    { key: "last-month", from: monthFirst(prevY, prevM), to: monthLast(prevY, prevM) },
    { key: "this-month", from: monthFirst(y, m), to: today },
    { key: "last-quarter", from: qFrom(pqY, pq), to: qTo(pqY, pq) },
    { key: "this-year", from: `${y}-01-01`, to: today },
    { key: "last-year", from: `${y - 1}-01-01`, to: `${y - 1}-12-31` },
  ];
  const names: Record<string, string> = {
    "last-month": "Letzter Monat",
    "this-month": "Dieser Monat",
    "last-quarter": "Letztes Quartal",
    "this-year": "Dieses Jahr",
    "last-year": "Letztes Jahr",
  };
  return list.map((p) => ({ key: p.key, from: p.from, to: p.to, label: names[p.key] ?? p.key }));
}

/** Zeitraum aus Suchparametern (?from=&to= oder ?preset=), Standard: letzter Monat. */
export function resolvePeriod(sp: { from?: string; to?: string; preset?: string }, today: string): PeriodPreset {
  const presets = periodPresets(today);
  if (sp.from && sp.to && !validatePeriod({ from: sp.from, to: sp.to })) {
    const hit = presets.find((p) => p.from === sp.from && p.to === sp.to);
    return hit ?? { key: "custom", label: "Eigener Zeitraum", from: sp.from, to: sp.to };
  }
  return presets.find((p) => p.key === sp.preset) ?? presets[0]!;
}

// ---------------------------------------------------------------------------
// Beträge und Gruppierung
// ---------------------------------------------------------------------------

export type CartLine = { productId: string; quantity: number };
export type PricedProduct = { id: string; name: string; priceCents: number };

/** Summe einer Positionsliste (Menge × Preis). Unbekannte Produkte zählen nicht. */
export function cartTotal(lines: CartLine[], products: PricedProduct[]) {
  const byId = new Map(products.map((p) => [p.id, p]));
  return lines.reduce((s, l) => s + (byId.get(l.productId)?.priceCents ?? 0) * Math.max(0, Math.floor(l.quantity)), 0);
}

/** Fasst gleiche Produkte zusammen, entfernt Mengen ≤ 0 und begrenzt die Menge. */
export function normalizeCart(lines: CartLine[]): CartLine[] {
  const m = new Map<string, number>();
  for (const l of lines) {
    const q = Math.floor(Number(l.quantity));
    if (!Number.isFinite(q) || q <= 0) continue;
    m.set(l.productId, (m.get(l.productId) ?? 0) + q);
  }
  return [...m.entries()].map(([productId, quantity]) => ({ productId, quantity: Math.min(MAX_QUANTITY, quantity) }));
}

export type BillableEntry = { id: string; userId: string | null; totalCents: number; paidCash: boolean; billedInvoiceId: string | null; createdAt?: Date };

export type BillingGroup = { userId: string; entryIds: string[]; count: number; totalCents: number; firstAt: Date | null; lastAt: Date | null };

/**
 * Gruppiert unverrechnete Mitglieder-Einträge pro Mitglied. Ausgeschlossen: Gäste (ohne userId),
 * bar bezahlte und bereits verrechnete Einträge, Mitglieder mit Summe ≤ 0. Sortierung nach userId
 * (stabil); die Anzeige sortiert nach Namen.
 */
export function groupForBilling(entries: BillableEntry[]): BillingGroup[] {
  const m = new Map<string, BillingGroup>();
  for (const e of entries) {
    if (!e.userId || e.paidCash || e.billedInvoiceId) continue;
    let g = m.get(e.userId);
    if (!g) {
      g = { userId: e.userId, entryIds: [], count: 0, totalCents: 0, firstAt: null, lastAt: null };
      m.set(e.userId, g);
    }
    g.entryIds.push(e.id);
    g.count += 1;
    g.totalCents += e.totalCents;
    if (e.createdAt) {
      if (!g.firstAt || e.createdAt < g.firstAt) g.firstAt = e.createdAt;
      if (!g.lastAt || e.createdAt > g.lastAt) g.lastAt = e.createdAt;
    }
  }
  return [...m.values()].filter((g) => g.totalCents > 0).sort((a, b) => (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0));
}

export function sumCents(list: Array<{ totalCents: number }>) {
  return list.reduce((s, e) => s + e.totalCents, 0);
}

export type CashEntry = { createdAt: Date; totalCents: number; quantity: number; productName: string };
export type CashDay = { day: string; count: number; totalCents: number; products: Array<{ name: string; quantity: number; totalCents: number }> };

/** Barverkäufe pro Kalendertag (Schweizer Zeit), neueste zuerst, Produkte nach Umsatz. */
export function cashByDay(entries: CashEntry[]): CashDay[] {
  const days = new Map<string, { count: number; totalCents: number; products: Map<string, { quantity: number; totalCents: number }> }>();
  for (const e of entries) {
    const day = zurichParts(e.createdAt).dateStr;
    let d = days.get(day);
    if (!d) {
      d = { count: 0, totalCents: 0, products: new Map() };
      days.set(day, d);
    }
    d.count += 1;
    d.totalCents += e.totalCents;
    const p = d.products.get(e.productName) ?? { quantity: 0, totalCents: 0 };
    p.quantity += e.quantity;
    p.totalCents += e.totalCents;
    d.products.set(e.productName, p);
  }
  return [...days.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([day, d]) => ({
      day, count: d.count, totalCents: d.totalCents,
      products: [...d.products.entries()].map(([name, p]) => ({ name, ...p })).sort((a, b) => b.totalCents - a.totalCents || a.name.localeCompare(b.name, "de")),
    }));
}

/** Produkte nach Kategorie gruppieren (Reihenfolge: sortOrder, dann Name; «Weitere» am Schluss). */
export function groupByCategory<T extends { category: string | null; sortOrder: number; name: string }>(products: T[]) {
  const sorted = [...products].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "de"));
  const groups = new Map<string, T[]>();
  for (const p of sorted) {
    const key = p.category?.trim() || "";
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  return [...groups.entries()]
    .sort((a, b) => (a[0] === "" ? 1 : b[0] === "" ? -1 : 0))
    .map(([category, items]) => ({ category: category || "Weitere", items }));
}

/** Kann die Erfassung noch rückgängig gemacht werden? */
export function canUndo(createdAt: Date, now: Date = new Date()) {
  const age = now.getTime() - createdAt.getTime();
  return age >= -60_000 && age <= UNDO_WINDOW_MS;
}

/** clientId der n-ten Position einer Erfassung (eindeutig in KioskEntry.clientId). */
export function lineClientId(batchId: string, index: number) {
  return `${batchId}:${index}`;
}

/** Geräte-ID einer Erfassung (UUID o.ä.). Ohne «_» und «%», damit sie in LIKE-Präfixen nichts anderes trifft. */
const BATCH_RE = /^[A-Za-z0-9-]{8,64}$/;
export function isBatchId(s: unknown): s is string {
  return typeof s === "string" && BATCH_RE.test(s);
}

/** Filter der Einträge-Liste. */
export type EntryStatusFilter = "all" | "open" | "billed" | "cash";
export function parseStatusFilter(s: string | undefined): EntryStatusFilter {
  return s === "open" || s === "billed" || s === "cash" ? s : "all";
}
