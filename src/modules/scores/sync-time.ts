/**
 * Reine Zeitlogik der Offline-Synchronisierung (last-write-wins), ohne DB.
 */

/** Höchstens so weit darf eine Gerätezeit in der Zukunft liegen (falsch gestellte Uhren). */
export const MAX_CLIENT_SKEW_MS = 5 * 60_000;
const EARLIEST = Date.UTC(2020, 0, 1);

/** Gerätezeit übernehmen, aber nie weiter als 5 Minuten in die Zukunft und nie vor 2020. */
export function clampClientTime(v: number | string | Date | undefined, now: number = Date.now()): Date {
  if (v === undefined) return new Date(now);
  const t = v instanceof Date ? v.getTime() : typeof v === "number" ? v : Date.parse(v);
  if (!Number.isFinite(t) || t < EARLIEST) return new Date(now);
  return new Date(Math.min(t, now + MAX_CLIENT_SKEW_MS));
}

/**
 * Gewinnt eine eingehende Änderung gegen den gespeicherten Stand? Ohne gespeicherten Zeitstempel
 * (ältere Daten) immer; bei Gleichstand gewinnt die neue Änderung (wie in der DB-Bedingung lte).
 */
export function incomingWins(stored: Date | null | undefined, incoming: Date): boolean {
  return !stored || stored.getTime() <= incoming.getTime();
}
