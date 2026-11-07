import "server-only";
import { listAwardLimits, listFsParticipants, listFsPrograms, previousAwardLimits, type FsParticipantRow } from "./queries";
import { awardFor, awardLimitsToText, bestPerShooter, countAwards, type AwardExportRow, type AwardResult } from "./awards";
import { formatSwissDate } from "./types";

export type FsAwardRow = FsParticipantRow & { result: AwardResult };

/**
 * Feldschiessen-Auszeichnungen eines Jahres: pro Programm die Limiten und pro Schütze ein Resultat
 * (amtliches bzw. bestes, siehe bestPerShooter) mit berechneter Auszeichnung.
 * `participants` sind alle Teilnahmen, `byParticipant` die Berechnung je Teilnahme (für die Rangliste im Jahresüberblick).
 */
export async function fsAwardsOverview(tenantId: string, year: number) {
  const [programs, limitsByProgram, participants] = await Promise.all([listFsPrograms(tenantId), listAwardLimits(tenantId, year), listFsParticipants(tenantId, year)]);
  const byParticipant = new Map<string, AwardResult>();
  for (const p of participants) byParticipant.set(p.id, awardFor(limitsByProgram.get(p.programId) ?? [], p.total, p.birthYear, year));

  const best = bestPerShooter(participants.map((p) => ({ ...p, shooterKey: p.userId ?? `guest:${p.name.toLowerCase()}` })));
  const knownIds = new Set(programs.map((p) => p.id));
  const sections = programs.map((program) => {
    const limits = limitsByProgram.get(program.id) ?? [];
    const rows: FsAwardRow[] = best
      .filter((r) => r.programId === program.id)
      .map((r) => ({ ...r, result: byParticipant.get(r.id)! }))
      .sort((a, b) => b.total - a.total || (a.zeros ?? 0) - (b.zeros ?? 0) || a.name.localeCompare(b.name, "de-CH"));
    return { program, limits, rows, counts: countAwards(rows.map((r) => r.result)) };
  });
  // Resultate in Programmen, die (z.B. versteckt) nicht mehr in der Liste sind, gehen nicht verloren
  const orphans = best.filter((r) => !knownIds.has(r.programId));
  return { sections, participants, byParticipant, orphanCount: orphans.length, hasLimits: limitsByProgram.size > 0 };
}
export type FsAwardsOverview = Awaited<ReturnType<typeof fsAwardsOverview>>;

/** Vorschläge für Programme ohne Limiten im Jahr: zuerst das letzte Jahr mit Limiten. */
export async function awardSuggestions(tenantId: string, year: number) {
  const prev = await previousAwardLimits(tenantId, year);
  return new Map([...prev].map(([programId, p]) => [programId, { year: p.year, text: awardLimitsToText(p.limits) }]));
}

/** Exportzeilen (CSV, Druck) aus der Übersicht, Programm für Programm. */
export function awardExportRows(overview: FsAwardsOverview): AwardExportRow[] {
  return overview.sections.flatMap((s) =>
    s.rows.map((r) => ({
      name: r.name,
      birthYear: r.birthYear,
      program: s.program.name,
      total: r.total,
      zeros: r.zeros,
      isOfficial: r.isOfficial,
      isGuest: r.isGuest,
      date: formatSwissDate(r.date),
      result: r.result,
    })),
  );
}
