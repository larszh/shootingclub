import { z } from "zod";

export const DISCIPLINES = [
  { key: "PISTOL", label: "Pistole" },
  { key: "RIFLE", label: "Gewehr" },
  { key: "AIR_PISTOL", label: "Luftpistole" },
  { key: "AIR_RIFLE", label: "Luftgewehr" },
  { key: "SHOTGUN", label: "Flinte" },
  { key: "OTHER", label: "Andere" },
] as const;
export type Discipline = (typeof DISCIPLINES)[number]["key"];
export const disciplineKeys = DISCIPLINES.map((d) => d.key) as [Discipline, ...Discipline[]];
export function disciplineLabel(key: string) {
  return DISCIPLINES.find((d) => d.key === key)?.label ?? key;
}

export const SCORING_MODES = [
  { key: "RINGS_INT", label: "Ringe (ganze Zahlen)", hint: "0 bis Maximalring, z.B. 0–10" },
  { key: "RINGS_DECIMAL", label: "Ringe (Zehntel)", hint: "z.B. 0.0 bis 10.9" },
  { key: "HITS", label: "Treffer / Fehler", hint: "Jeder Schuss zählt als Treffer (1) oder Fehler (0)" },
] as const;
export type ScoringMode = (typeof SCORING_MODES)[number]["key"];
export const scoringModeKeys = SCORING_MODES.map((s) => s.key) as [ScoringMode, ...ScoringMode[]];

export const POSITIONS = [
  { key: "", label: "Beliebig" },
  { key: "STANDING", label: "Stehend" },
  { key: "KNEELING", label: "Kniend" },
  { key: "PRONE", label: "Liegend" },
  { key: "SITTING", label: "Sitzend" },
  { key: "MOVING", label: "In Bewegung" },
] as const;
export function positionLabel(key: string | undefined) {
  return POSITIONS.find((p) => p.key === (key ?? ""))?.label ?? key ?? "";
}

export const stageSchema = z.object({
  name: z.string().trim().min(1, "Name fehlt").max(60),
  distanceM: z.coerce.number().min(0.5).max(1000),
  shots: z.coerce.number().int().min(1).max(200),
  maxPerShot: z.coerce.number().min(1).max(100).default(10),
  timeLimitSec: z.coerce.number().int().min(0).max(36000).optional(),
  position: z.string().max(20).optional(),
  targetName: z.string().trim().max(80).optional(),
  note: z.string().trim().max(300).optional(),
});
export type Stage = z.infer<typeof stageSchema>;

export const programInputSchema = z.object({
  name: z.string().trim().min(2, "Mindestens 2 Zeichen").max(80),
  description: z.string().trim().max(600).optional(),
  discipline: z.enum(disciplineKeys),
  weaponNote: z.string().trim().max(120).optional(),
  scoringMode: z.enum(scoringModeKeys),
  stages: z.array(stageSchema).min(1, "Mindestens eine Serie").max(30),
});
export type ProgramInput = z.infer<typeof programInputSchema>;

export function parseStages(raw: string): Stage[] {
  try {
    const parsed = z.array(stageSchema).safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

/** Höchstmöglicher Wert eines Schusses; bei Zehntelwertung bis Maximalring + 0.9 (z.B. 10.9). */
export function maxShotValue(stage: Stage, mode: string) {
  return mode === "RINGS_DECIMAL" ? stage.maxPerShot + 0.9 : stage.maxPerShot;
}

/** Schusszahl, Maximum und Distanzen eines Programms. Das Maximum hängt vom Wertungsmodus ab. */
export function programTotals(stages: Stage[], mode: string) {
  const shots = stages.reduce((a, s) => a + s.shots, 0);
  const max = Math.round(stages.reduce((a, s) => a + s.shots * maxShotValue(s, mode), 0) * 10) / 10;
  const distances = [...new Set(stages.map((s) => s.distanceM))].sort((a, b) => a - b);
  return { shots, max, distances };
}

export function formatDistances(distances: number[]) {
  if (distances.length === 0) return "";
  if (distances.length === 1) return `${distances[0]} m`;
  if (distances.length <= 3) return distances.map((d) => `${d} m`).join(" · ");
  return `${distances[0]}–${distances[distances.length - 1]} m`;
}

/** Punktzahl einer Serie aus den einzelnen Schüssen. */
export function stageTotal(shots: number[]) {
  return Math.round(shots.reduce((a, b) => a + b, 0) * 10) / 10;
}

/** Validiert eine Schussliste gegen Serie und Wertungsmodus. */
export function sanitizeShots(shots: unknown, stage: Stage, mode: ScoringMode): number[] {
  if (!Array.isArray(shots)) return [];
  const out: number[] = [];
  for (const v of shots.slice(0, stage.shots)) {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) continue;
    if (mode === "HITS") out.push(n >= 1 ? 1 : 0);
    else if (mode === "RINGS_DECIMAL") out.push(Math.min(Math.round(n * 10) / 10, maxShotValue(stage, mode)));
    else out.push(Math.min(Math.round(n), stage.maxPerShot));
  }
  return out;
}
