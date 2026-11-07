/**
 * KI-Verbrauch: reine Hilfsfunktionen (ohne DB) für Monate, CHF-Schätzungen und Tabellen.
 * Auch in Client-Komponenten nutzbar.
 */
import { zurichParts, zurichToUtc } from "@/lib/time";
import { normalizeAiModel, type AiModel } from "@/lib/ai/types";

// ---------------------------------------------------------------------------
// Monate (Europe/Zurich)

/** "YYYY-MM" des Zeitpunkts in Schweizer Zeit. */
export function monthKeyZurich(at: Date = new Date()): string {
  return zurichParts(at).dateStr.slice(0, 7);
}

export function isMonthKey(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}$/.test(v)) return false;
  const m = Number(v.slice(5, 7));
  const y = Number(v.slice(0, 4));
  return m >= 1 && m <= 12 && y >= 2000 && y <= 2999;
}

/** Monat um n verschieben ("2026-01", -1 → "2025-12"). */
export function addMonths(key: string, n: number): string {
  const y = Number(key.slice(0, 4));
  const m = Number(key.slice(5, 7)) - 1 + n;
  const yy = y + Math.floor(m / 12);
  const mm = ((m % 12) + 12) % 12;
  return `${yy}-${String(mm + 1).padStart(2, "0")}`;
}

/** [Beginn, Ende) eines Monats in Schweizer Zeit als UTC-Daten. */
export function monthRangeZurich(key: string): { from: Date; to: Date } {
  return { from: zurichToUtc(`${key}-01`, "00:00"), to: zurichToUtc(`${addMonths(key, 1)}-01`, "00:00") };
}

/** Die letzten n Monate inkl. aktuellem, neuester zuerst. */
export function recentMonths(n: number, now: Date = new Date()): string[] {
  const cur = monthKeyZurich(now);
  return Array.from({ length: Math.max(0, n) }, (_, i) => addMonths(cur, -i));
}

/**
 * Monat aus einem Suchparameter: gültig und nicht in der Zukunft, sonst der aktuelle Monat.
 * Höchstens `maxBack` Monate zurück.
 */
export function pickMonth(raw: unknown, now: Date = new Date(), maxBack = 24): string {
  const cur = monthKeyZurich(now);
  if (!isMonthKey(raw)) return cur;
  if (raw > cur) return cur;
  if (raw < addMonths(cur, -maxBack)) return cur;
  return raw;
}

// ---------------------------------------------------------------------------
// CHF-Schätzung

/**
 * Richtwerte in CHF pro 1 Mio. Tokens (Eingabe/Ausgabe), grob umgerechnet aus den Listenpreisen.
 * Nur für Schätzungen in der Oberfläche – massgebend ist die Rechnung von Anthropic.
 * Cache-Lesen ≈ 10 % der Eingabe, Cache-Schreiben ≈ 125 % der Eingabe.
 */
export const CHF_PER_MILLION: Record<AiModel, { input: number; output: number }> = {
  "claude-opus-5-5": { input: 4.5, output: 22.5 },
  "claude-sonnet-5-5": { input: 2.7, output: 13.5 },
  "claude-haiku-5-5": { input: 0.9, output: 4.5 },
};

export type TokenCounts = { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number };

export function sumTokens(u: TokenCounts): number {
  return u.inputTokens + u.outputTokens + u.cacheReadTokens + u.cacheWriteTokens;
}

/** Geschätzte Kosten in CHF für einen Verbrauch mit einem Modell. */
export function estimateChf(u: TokenCounts, model: string): number {
  const r = CHF_PER_MILLION[normalizeAiModel(model)];
  const cost = u.inputTokens * r.input + u.outputTokens * r.output + u.cacheReadTokens * r.input * 0.1 + u.cacheWriteTokens * r.input * 1.25;
  return cost / 1_000_000;
}

/** Mischpreis pro 1 Mio. Tokens (80 % Eingabe, 20 % Ausgabe) – für Budget-Umrechnung. */
export function blendedChfPerMillion(model: string): number {
  const r = CHF_PER_MILLION[normalizeAiModel(model)];
  return r.input * 0.8 + r.output * 0.2;
}

/**
 * Tokens, die gegen ein Monatslimit zählen («Budget-Tokens»): der Verbrauch so gewichtet, dass
 * er zur CHF-Umrechnung des Limits passt – also geschätzte Kosten ÷ Mischpreis. Ein Gemisch aus
 * 80 % Eingabe und 20 % Ausgabe zählt damit 1:1; Cache-Lesen zählt nur ≈ 10 % der Eingabe,
 * Cache-Schreiben ≈ 125 %. So sperrt ein Budget von «CHF 10» bei ≈ CHF 10 geschätztem Verbrauch.
 */
export function budgetTokens(u: TokenCounts, model: string): number {
  const blended = blendedChfPerMillion(model);
  if (!(blended > 0)) return sumTokens(u);
  return Math.round((estimateChf(u, model) / blended) * 1_000_000);
}

/** CHF-Budget → Token-Limit (abgerundet, in Budget-Tokens, siehe `budgetTokens`). */
export function tokensForChf(chf: number, model: string): number {
  if (!Number.isFinite(chf) || chf <= 0) return 0;
  return Math.floor((chf / blendedChfPerMillion(model)) * 1_000_000);
}

/** Token-Limit → geschätztes CHF-Budget (auf Rappen gerundet). */
export function chfForTokens(tokens: number, model: string): number {
  if (!Number.isFinite(tokens) || tokens <= 0) return 0;
  return Math.round((tokens / 1_000_000) * blendedChfPerMillion(model) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Tabellen

/** Eine gruppierte Zeile aus der DB (z.B. groupBy feature, model, ok). */
export type UsageGroup = TokenCounts & { key: string; model: string; ok: boolean; requests: number };

export type UsageTableRow = { key: string; requests: number; failed: number; tokens: number; chf: number };
export type UsageTable = { rows: UsageTableRow[]; total: UsageTableRow };

/**
 * Fasst Gruppen nach `key` zusammen (über Modelle und ok/Fehler), sortiert nach Tokens absteigend,
 * bei Gleichstand nach Schlüssel. `order` legt eine feste Reihenfolge fest (fehlende Schlüssel danach).
 */
export function buildUsageTable(groups: readonly UsageGroup[], order?: readonly string[]): UsageTable {
  const map = new Map<string, UsageTableRow>();
  const total: UsageTableRow = { key: "total", requests: 0, failed: 0, tokens: 0, chf: 0 };
  for (const g of groups) {
    const row = map.get(g.key) ?? { key: g.key, requests: 0, failed: 0, tokens: 0, chf: 0 };
    const tok = sumTokens(g);
    const chf = estimateChf(g, g.model);
    row.requests += g.requests;
    if (!g.ok) row.failed += g.requests;
    row.tokens += tok;
    row.chf += chf;
    map.set(g.key, row);
    total.requests += g.requests;
    if (!g.ok) total.failed += g.requests;
    total.tokens += tok;
    total.chf += chf;
  }
  const rows = [...map.values()];
  if (order) {
    const idx = (k: string) => {
      const i = order.indexOf(k);
      return i < 0 ? order.length : i;
    };
    rows.sort((a, b) => idx(a.key) - idx(b.key) || b.tokens - a.tokens || a.key.localeCompare(b.key));
  } else {
    rows.sort((a, b) => b.tokens - a.tokens || a.key.localeCompare(b.key));
  }
  return { rows, total };
}

/** Anteil des Limits in Prozent (0–100, null ohne Limit). */
export function limitPercent(used: number, limit: number | null | undefined): number | null {
  if (limit == null || limit <= 0) return null;
  return Math.min(100, Math.round((used / limit) * 100));
}
