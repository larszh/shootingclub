/**
 * Resultat-Import: Übernahmeplan aus Datei, Zuordnung und Programm. Wird in der Vorschau
 * (Browser) und bei der Übernahme (Server) identisch berechnet. Rein, ohne Datenbank.
 */
import { buildShooters, duplicateAssignments, evaluateShooter, participantNote, type Assignment, type ImportedShooter, type ProgramSpec, type ShooterEvaluation } from "./shooters";
import { normalizeMapping, type ScoreField, type ScoreLayout, type ScoreTable } from "./parse";

export type ImportConfig = {
  layout: ScoreLayout;
  mapping: ScoreField[];
  /** Nur Zeilen dieser Disziplin (null = alle) */
  discipline: string | null;
};

export type PlannedParticipant = {
  shooter: ImportedShooter;
  assignment: Assignment;
  evaluation: ShooterEvaluation;
  /** Fehler inkl. Zuordnungsfehler (nur relevant, wenn nicht «skip») */
  errors: string[];
  note: string | null;
};

export type ImportPlan = {
  participants: PlannedParticipant[];
  globalErrors: string[];
  skippedRows: number;
  disciplines: string[];
  dates: string[];
  /** Anzahl Schützen, die übernommen werden */
  included: number;
  /** Übernommene Schützen mit Fehlern (verhindern die Übernahme) */
  blocking: number;
};

export function planImport(
  table: Pick<ScoreTable, "rows" | "firstLine" | "headers">,
  config: ImportConfig,
  program: ProgramSpec | null,
  assignmentFor: (shooter: ImportedShooter) => Assignment,
  validMemberIds?: ReadonlySet<string>,
): ImportPlan {
  const mapping = normalizeMapping(config.mapping, table.headers.length);
  const built = buildShooters(table, mapping, config.layout, config.discipline);
  const assigned = built.shooters.map((s) => ({ key: s.key, assignment: assignmentFor(s) }));
  const dups = duplicateAssignments(assigned);
  const participants = built.shooters.map((s, i): PlannedParticipant => {
    const assignment = assigned[i]!.assignment;
    const evaluation = program ? evaluateShooter(s, program) : { stages: [], total: 0, shotCount: 0, errors: [], warnings: [...s.warnings] };
    const errors = [...evaluation.errors];
    if (!program) errors.unshift("Programm wählen");
    const dup = dups.get(s.key);
    if (dup) errors.push(dup);
    if (assignment.kind === "member" && validMemberIds && !validMemberIds.has(assignment.userId)) errors.push("Mitglied nicht (mehr) im Verein");
    if (assignment.kind !== "skip" && evaluation.stages.length === 0 && !errors.length) errors.push("Keine Resultate");
    return { shooter: s, assignment, evaluation, errors, note: participantNote(s) };
  });
  const active = participants.filter((p) => p.assignment.kind !== "skip");
  return {
    participants,
    globalErrors: built.errors,
    skippedRows: built.skippedRows,
    disciplines: built.disciplines,
    dates: built.dates,
    included: active.length,
    blocking: active.filter((p) => p.errors.length > 0).length,
  };
}
