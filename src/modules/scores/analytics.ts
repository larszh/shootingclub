/**
 * Reine Hilfsfunktionen für Ranglisten, Statistik und Export (ohne DB, ohne "server-only"),
 * damit sie in Abfragen, Routen und Komponenten gleichermassen nutzbar sind.
 */
import { addDays, APP_TZ, zurichParts, zurichToUtc } from "@/lib/time";
import type { Stage } from "./types";

// ---------------------------------------------------------------------------
// Zeiträume
// ---------------------------------------------------------------------------

export const PERIODS = [
  { key: "month", label: "Monat" },
  { key: "year", label: "Jahr" },
  { key: "all", label: "Alle" },
] as const;
export type Period = (typeof PERIODS)[number]["key"];

export function parsePeriod(v: string | undefined | null, fallback: Period = "year"): Period {
  return PERIODS.some((p) => p.key === v) ? (v as Period) : fallback;
}

const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

/** Beginn des Zeitraums (Schweizer Zeit) und lesbare Bezeichnung. */
export function periodRange(period: Period, now: Date): { from: Date | null; label: string } {
  const [y, m] = zurichParts(now).dateStr.split("-");
  if (period === "month") return { from: zurichToUtc(`${y}-${m}-01`, "00:00"), label: `${MONTHS[Number(m) - 1]} ${y}` };
  if (period === "year") return { from: zurichToUtc(`${y}-01-01`, "00:00"), label: `Jahr ${y}` };
  return { from: null, label: "Alle Zeiten" };
}

/** Zeitraumfilter für die Durchgangsliste. */
export const MATCH_PERIODS = [
  { key: "", label: "Alle Zeiten" },
  { key: "30d", label: "Letzte 30 Tage" },
  { key: "month", label: "Dieser Monat" },
  { key: "year", label: "Dieses Jahr" },
  { key: "lastyear", label: "Letztes Jahr" },
] as const;
export type MatchPeriod = (typeof MATCH_PERIODS)[number]["key"];

export function matchPeriodRange(key: string | undefined, now: Date): { from?: Date; to?: Date } {
  const today = zurichParts(now).dateStr;
  const [y, m] = today.split("-");
  switch (key) {
    case "30d":
      return { from: zurichToUtc(addDays(today, -30), "00:00") };
    case "month":
      return { from: zurichToUtc(`${y}-${m}-01`, "00:00") };
    case "year":
      return { from: zurichToUtc(`${y}-01-01`, "00:00") };
    case "lastyear":
      return { from: zurichToUtc(`${Number(y) - 1}-01-01`, "00:00"), to: zurichToUtc(`${y}-01-01`, "00:00") };
    default:
      return {};
  }
}

/** Gültiges Kalenderdatum "YYYY-MM-DD" (z.B. kein 2026-02-30)? */
export function isValidDay(s: string | null | undefined): s is string {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  if (y! < 1900 || y! > 2999) return false;
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m! - 1 && dt.getUTCDate() === d;
}

/** "YYYY-MM-DD" (Schweizer Datum) → Beginn bzw. Ende des Tages als UTC. Ungültig → undefined. */
export function parseDayStart(s: string | null | undefined) {
  return isValidDay(s) ? zurichToUtc(s, "00:00") : undefined;
}
export function parseDayEnd(s: string | null | undefined) {
  return isValidDay(s) ? zurichToUtc(addDays(s, 1), "00:00") : undefined;
}

const dayFmt = new Intl.DateTimeFormat("de-CH", { timeZone: APP_TZ, day: "2-digit", month: "2-digit", year: "numeric" });

/** Datum in Schweizer Zeit, z.B. 27.10.2026 (unabhängig von der Server-Zeitzone). */
export function formatDay(d: Date) {
  return dayFmt.format(d);
}

// ---------------------------------------------------------------------------
// Punkte, Zehner, Ranglisten-Vergleich
// ---------------------------------------------------------------------------

export function round1(n: number) {
  return Math.round(n * 10) / 10;
}

/** Anzahl Höchstwerte (z.B. Zehner) über alle Serien. Bei Treffer/Fehler-Wertung immer 0. */
export function countTopShots(shotsPerStage: number[][], stages: Stage[], scoringMode: string) {
  if (scoringMode === "HITS") return 0;
  let n = 0;
  shotsPerStage.forEach((shots, i) => {
    const max = stages[i]?.maxPerShot ?? 10;
    for (const s of shots) if (s >= max) n += 1;
  });
  return n;
}

export type RankedEntry = { total: number; topShots: number; lastStage: number; date: Date };

/**
 * Sortierung für Ranglisten: höheres Total, dann mehr Höchstwerte (Zehner),
 * dann höhere letzte Serie, dann früheres Datum.
 */
export function compareEntries(a: RankedEntry, b: RankedEntry) {
  if (b.total !== a.total) return b.total - a.total;
  if (b.topShots !== a.topShots) return b.topShots - a.topShots;
  if (b.lastStage !== a.lastStage) return b.lastStage - a.lastStage;
  return a.date.getTime() - b.date.getTime();
}

/** Vergibt Ränge (gleiche Werte in allen Kriterien ausser Datum → gleicher Rang). */
export function assignRanks<T extends RankedEntry>(sorted: T[]): Array<T & { rank: number }> {
  const out: Array<T & { rank: number }> = [];
  sorted.forEach((e, i) => {
    const prev = out[i - 1];
    const same = prev && prev.total === e.total && prev.topShots === e.topShots && prev.lastStage === e.lastStage;
    out.push({ ...e, rank: same ? prev.rank : i + 1 });
  });
  return out;
}

// ---------------------------------------------------------------------------
// Wochen und Serien (Streak)
// ---------------------------------------------------------------------------

/** Montag der Kalenderwoche (Schweizer Datum) als "YYYY-MM-DD". */
export function weekMonday(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const wd = new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay(); // 0 = So
  return addDays(dateStr, -((wd + 6) % 7));
}

/**
 * Anzahl aufeinanderfolgender Wochen mit mindestens einem Durchgang.
 * `current` zählt bis zur aktuellen Woche (oder der Vorwoche, falls diese Woche noch nichts war).
 */
export function weekStreaks(dates: Date[], now: Date) {
  const weeks = new Set(dates.map((d) => weekMonday(zurichParts(d).dateStr)));
  if (weeks.size === 0) return { current: 0, longest: 0, activeThisWeek: false };
  const thisWeek = weekMonday(zurichParts(now).dateStr);
  const activeThisWeek = weeks.has(thisWeek);
  let cursor = activeThisWeek ? thisWeek : addDays(thisWeek, -7);
  let current = 0;
  while (weeks.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -7);
  }
  const sorted = [...weeks].sort();
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const w of sorted) {
    run = prev && addDays(prev, 7) === w ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = w;
  }
  return { current, longest, activeThisWeek };
}

// ---------------------------------------------------------------------------
// CSV (Excel Schweiz: Semikolon, UTF-8 mit BOM)
// ---------------------------------------------------------------------------

function csvCell(v: string | number | null | undefined) {
  if (v === null || v === undefined) return "";
  let s = typeof v === "number" ? String(v) : v;
  // Formel-Injection verhindern (Excel interpretiert =, +, -, @ am Anfang).
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[";\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(rows: Array<Array<string | number | null | undefined>>) {
  return "﻿" + rows.map((r) => r.map(csvCell).join(";")).join("\r\n") + "\r\n";
}

export function csvResponseHeaders(filename: string) {
  return {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    "Cache-Control": "private, no-store",
  };
}
