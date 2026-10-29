/**
 * Reine Berechnung der gespeicherten Kennzahlen eines Teilnehmers (MatchParticipant.total/zeros).
 * Ohne DB und ohne "server-only", damit sie getestet und überall genutzt werden kann.
 */

import { safeJson } from "@/lib/utils";

export type StoredStageResult = { shotsJson: string; total: number };

/**
 * Anzahl Nuller einer Schussliste. In allen Wertungen ist 0 ein Fehlschuss:
 * Ringe (0 = ausserhalb), Treffer/Fehler (0 = Fehler) und Zonen (0 = Fehl-Zone).
 * Strafen ohne Schuss haben immer negative Punkte und zählen darum nicht.
 */
export function countZeros(shots: readonly number[]): number {
  let n = 0;
  for (const v of shots) if (v === 0) n += 1;
  return n;
}

/** Total (auf Zehntel gerundet) und Nuller über alle gespeicherten Serien eines Teilnehmers. */
export function participantTotals(results: readonly StoredStageResult[]): { total: number | null; zeros: number | null } {
  if (results.length === 0) return { total: null, zeros: null };
  let sum = 0;
  let zeros = 0;
  for (const r of results) {
    sum += r.total;
    const shots = safeJson<unknown>(r.shotsJson, []);
    if (Array.isArray(shots)) zeros += countZeros(shots.filter((x): x is number => typeof x === "number"));
  }
  return { total: Math.round(sum * 10) / 10, zeros };
}

/** Muss der gespeicherte Wert aktualisiert werden? (vermeidet unnötige Schreibzugriffe) */
export function totalsChanged(stored: { total: number | null; zeros: number | null }, next: { total: number | null; zeros: number | null }): boolean {
  return stored.total !== next.total || stored.zeros !== next.zeros;
}

/**
 * Geschätzte Schusszahl eines Teilnehmers ohne die Schüsse zu lesen: Summe der geplanten
 * Schüsse aller erfassten Serien. Für abgeschlossene Durchgänge (Serien vollständig) exakt genug.
 */
export function plannedShotsForStages(stageIndexes: readonly number[], stageShots: readonly number[]): number {
  let n = 0;
  for (const i of stageIndexes) n += stageShots[i] ?? 0;
  return n;
}
