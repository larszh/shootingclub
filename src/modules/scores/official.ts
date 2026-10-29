/**
 * Reine Regeln für amtliche Resultate (Bundesübungen): Bestanden-Prüfung und Versuchsnummer.
 * Ohne DB und ohne "server-only", damit sie getestet und in Actions, Abfragen und UI genutzt werden können.
 *
 * Die Grenzwerte (Mindestpunkte, Nuller) stammen immer aus dem Programm und sind vom Verein bzw.
 * Super-Admin einstellbar. Die App ersetzt die Prüfung durch die verantwortliche Person nicht.
 */
import { zurichParts } from "@/lib/time";

export type PassRule = { passMinScore: number | null | undefined; passMaxZeros: number | null | undefined };

/** Hat das Programm überhaupt eine Bestehensregel? */
export function hasPassRule(rule: PassRule): boolean {
  return (rule.passMinScore !== null && rule.passMinScore !== undefined) || (rule.passMaxZeros !== null && rule.passMaxZeros !== undefined);
}

/**
 * Bestanden? `null`, wenn das Programm keine Regel hat (z.B. Feldschiessen) oder noch kein Total vorliegt.
 * Bestanden = Total ≥ Mindestpunkte (falls gesetzt) und Nuller ≤ Höchstzahl (falls gesetzt).
 * Fehlende Nuller zählen als 0.
 */
export function evaluatePass(result: { total: number | null | undefined; zeros: number | null | undefined }, rule: PassRule): boolean | null {
  if (!hasPassRule(rule)) return null;
  if (result.total === null || result.total === undefined || !Number.isFinite(result.total)) return null;
  const total = Math.round(result.total * 10) / 10;
  const zeros = result.zeros ?? 0;
  if (rule.passMinScore !== null && rule.passMinScore !== undefined && total < rule.passMinScore) return false;
  if (rule.passMaxZeros !== null && rule.passMaxZeros !== undefined && zeros > rule.passMaxZeros) return false;
  return true;
}

/** Kalenderjahr eines Zeitpunkts in Schweizer Zeit. */
export function swissYear(at: Date): number {
  return Number(zurichParts(at).dateStr.slice(0, 4));
}

export type AttemptRef = { id: string; date: Date; createdAt: Date };

/** Liegt a zeitlich vor b? (Datum des Durchgangs, bei Gleichstand Erfassungszeit, dann ID) */
function before(a: AttemptRef, b: AttemptRef) {
  if (a.date.getTime() !== b.date.getTime()) return a.date.getTime() < b.date.getTime();
  if (a.createdAt.getTime() !== b.createdAt.getTime()) return a.createdAt.getTime() < b.createdAt.getTime();
  return a.id < b.id;
}

/**
 * Vorgeschlagene Versuchsnummer: Anzahl früherer amtlicher Teilnahmen desselben Schützen im selben
 * Programm und Jahr (Schweizer Kalenderjahr) + 1. `others` darf auch spätere und andere Jahre enthalten,
 * die Funktion filtert selbst. Der aktuelle Teilnehmer (gleiche ID) wird ignoriert.
 */
export function autoAttempt(current: AttemptRef, others: readonly AttemptRef[]): number {
  const year = swissYear(current.date);
  let n = 0;
  for (const o of others) {
    if (o.id === current.id) continue;
    if (swissYear(o.date) !== year) continue;
    if (before(o, current)) n += 1;
  }
  return n + 1;
}

/** Erlaubte Versuchsnummern (Eingabe des Schützenmeisters). */
export const MAX_ATTEMPT = 20;
export function clampAttempt(n: unknown): number | null {
  const v = typeof n === "string" ? Number(n) : typeof n === "number" ? n : Number.NaN;
  if (!Number.isFinite(v)) return null;
  const i = Math.round(v);
  return i >= 1 && i <= MAX_ATTEMPT ? i : null;
}

/** Text für den Status eines amtlichen Resultats. */
export function passLabel(passed: boolean | null | undefined): string {
  if (passed === true) return "bestanden";
  if (passed === false) return "nicht bestanden";
  return "ohne Bestehensregel";
}
