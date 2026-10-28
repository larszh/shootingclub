import { z } from "zod";

export const DISCIPLINES = [
  { key: "PISTOL", label: "Pistole" },
  { key: "RIFLE", label: "Gewehr" },
  { key: "AIR_PISTOL", label: "Luftpistole" },
  { key: "AIR_RIFLE", label: "Luftgewehr" },
  { key: "SHOTGUN", label: "Flinte" },
  { key: "TACTICAL", label: "Taktik/Behörden" },
  { key: "OTHER", label: "Andere" },
] as const;
export type Discipline = (typeof DISCIPLINES)[number]["key"];
export const disciplineKeys = DISCIPLINES.map((d) => d.key) as [Discipline, ...Discipline[]];
export function disciplineLabel(key: string) {
  return DISCIPLINES.find((d) => d.key === key)?.label ?? key;
}

export const SCORING_MODES = [
  { key: "RINGS_INT", label: "Ringe (ganze Zahlen)", short: "Ringe", hint: "0 bis Maximalring, z.B. 0–10" },
  { key: "RINGS_DECIMAL", label: "Ringe (Zehntel)", short: "Zehntel", hint: "z.B. 0.0 bis 10.9" },
  { key: "HITS", label: "Treffer / Fehler", short: "Treffer/Fehler", hint: "Jeder Schuss zählt als Treffer (1) oder Fehler (0)" },
  { key: "ZONES", label: "Trefferzonen mit Strafpunkten", short: "Zonen", hint: "Jede Zone hat eigene Punkte, Strafzonen zählen negativ (z.B. Geisel getroffen)" },
] as const;
export type ScoringMode = (typeof SCORING_MODES)[number]["key"];
export const scoringModeKeys = SCORING_MODES.map((s) => s.key) as [ScoringMode, ...ScoringMode[]];
export function scoringModeLabel(key: string, short = false) {
  const m = SCORING_MODES.find((s) => s.key === key);
  return m ? (short ? m.short : m.label) : key;
}

// ---------------------------------------------------------------------------
// Trefferzonen (Wertung «ZONES»)
// ---------------------------------------------------------------------------

export const ZONE_LIMITS = { maxZones: 10, minPoints: -100, maxPoints: 100, keyMax: 12, labelMax: 40 } as const;

export const zoneSchema = z.object({
  key: z.string().trim().min(1, "Kürzel fehlt").max(ZONE_LIMITS.keyMax, `Kürzel höchstens ${ZONE_LIMITS.keyMax} Zeichen`),
  label: z.string().trim().min(1, "Bezeichnung fehlt").max(ZONE_LIMITS.labelMax, `Bezeichnung höchstens ${ZONE_LIMITS.labelMax} Zeichen`),
  points: z.coerce
    .number()
    .int("Punkte als ganze Zahl")
    .min(ZONE_LIMITS.minPoints, `Punkte mindestens ${ZONE_LIMITS.minPoints}`)
    .max(ZONE_LIMITS.maxPoints, `Punkte höchstens ${ZONE_LIMITS.maxPoints}`),
});
export type Zone = z.infer<typeof zoneSchema>;

/**
 * Prüft eine Zonenliste. Schüsse werden als Punktwert gespeichert, darum braucht jede Zone
 * einen eigenen Punktwert (sonst wäre die Zone eines Schusses nicht mehr eindeutig).
 * Gibt eine lesbare Fehlermeldung zurück oder null.
 */
export function validateZones(zones: Array<{ key: string; label: string; points: number }>): string | null {
  if (zones.length === 0) return "Mindestens eine Zone erfassen.";
  if (zones.length > ZONE_LIMITS.maxZones) return `Höchstens ${ZONE_LIMITS.maxZones} Zonen.`;
  for (const z0 of zones) {
    const r = zoneSchema.safeParse(z0);
    if (!r.success) return `Zone «${z0.key || z0.label || "?"}»: ${r.error.issues[0]?.message ?? "ungültig"}`;
  }
  const keys = zones.map((z0) => z0.key.trim().toLowerCase());
  if (new Set(keys).size !== keys.length) return "Jedes Kürzel darf nur einmal vorkommen.";
  const pts = zones.map((z0) => Number(z0.points));
  if (new Set(pts).size !== pts.length) return "Jede Zone braucht einen eigenen Punktwert.";
  if (!pts.some((p) => p > 0)) return "Mindestens eine Zone muss positive Punkte geben.";
  return null;
}

export const zoneListSchema = z
  .array(zoneSchema)
  .min(1, "Mindestens eine Zone")
  .max(ZONE_LIMITS.maxZones, `Höchstens ${ZONE_LIMITS.maxZones} Zonen`)
  .superRefine((zones, ctx) => {
    const err = validateZones(zones);
    if (err) ctx.addIssue({ code: "custom", message: err });
  });

/** Standard-Zonen für taktische Scheiben (z.B. Silhouette A/C/D mit Geisel/Unbeteiligten). */
export const DEFAULT_ZONES: Zone[] = [
  { key: "A", label: "A-Zone", points: 5 },
  { key: "C", label: "C-Zone", points: 3 },
  { key: "D", label: "D-Zone", points: 1 },
  { key: "M", label: "Fehl", points: 0 },
  { key: "VF", label: "Verfahrensfehler", points: -5 },
  { key: "NS", label: "Unbeteiligte/Geisel getroffen", points: -10 },
];

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
  /** Nur bei Wertung «ZONES»: Zonen dieser Serie (fehlt bei älteren Programmen → Standard-Zonen). */
  zones: zoneListSchema.optional(),
});
export type Stage = z.infer<typeof stageSchema>;

/** Höchste positive Zone (mindestens 1). */
function maxZonePoints(zones: Zone[]) {
  return Math.max(1, ...zones.map((z0) => z0.points));
}

/** Zonen einer Serie (Fallback: Standard-Zonen). */
export function stageZones(stage: Pick<Stage, "zones">): Zone[] {
  return stage.zones && stage.zones.length ? stage.zones : DEFAULT_ZONES;
}

/** Zone zu einem gespeicherten Schusswert (Punkte), falls vorhanden. */
export function zoneForValue(stage: Pick<Stage, "zones">, value: number): Zone | undefined {
  return stageZones(stage).find((z0) => z0.points === value);
}

/**
 * Normalisiert die Serien je nach Wertung: Bei «ZONES» bekommt jede Serie ihre Zonen
 * (Standard, falls keine) und maxPerShot = höchste Zone; sonst werden Zonen entfernt.
 */
export function normalizeStages(stages: Stage[], mode: string): Stage[] {
  return stages.map((s) => {
    if (mode === "ZONES") {
      const zones = stageZones(s).map((z0) => ({ ...z0 }));
      return { ...s, zones, maxPerShot: maxZonePoints(zones) };
    }
    if (s.zones === undefined) return s;
    const rest = { ...s };
    delete rest.zones;
    return mode === "HITS" ? { ...rest, maxPerShot: 1 } : rest;
  });
}

export const programInputSchema = z
  .object({
    name: z.string().trim().min(2, "Mindestens 2 Zeichen").max(80),
    description: z.string().trim().max(600).optional(),
    discipline: z.enum(disciplineKeys),
    weaponNote: z.string().trim().max(120).optional(),
    scoringMode: z.enum(scoringModeKeys),
    stages: z.array(stageSchema).min(1, "Mindestens eine Serie").max(30),
  })
  .transform((p) => ({ ...p, stages: normalizeStages(p.stages, p.scoringMode) }));
export type ProgramInput = z.infer<typeof programInputSchema>;

export function parseStages(raw: string): Stage[] {
  try {
    const parsed = z.array(stageSchema).safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

/**
 * Höchstmöglicher Wert eines Schusses; bei Zehntelwertung bis Maximalring + 0.9 (z.B. 10.9),
 * bei Zonenwertung die höchste positive Zone.
 */
export function maxShotValue(stage: Stage, mode: string) {
  if (mode === "ZONES") return maxZonePoints(stageZones(stage));
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

/**
 * Validiert eine Schussliste gegen Serie und Wertungsmodus. Negative Werte gibt es nur bei
 * «ZONES», und dort nur Werte, die einer Zone der Serie entsprechen (andere werden verworfen).
 */
export function sanitizeShots(shots: unknown, stage: Stage, mode: ScoringMode, stored?: readonly number[]): number[] {
  if (!Array.isArray(shots)) return [];
  const out: number[] = [];
  const zonePoints = mode === "ZONES" ? new Set(stageZones(stage).map((z0) => z0.points)) : null;
  for (const [i, v] of shots.slice(0, stage.shots).entries()) {
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    // Bereits gespeicherter Wert an derselben Stelle bleibt gültig, auch wenn das Programm
    // (Zonen, Wertung, Maximum) inzwischen geändert wurde – sonst wäre die Serie nicht mehr speicherbar.
    if (stored && typeof v === "number" && stored[i] === n) {
      out.push(n);
      continue;
    }
    if (zonePoints) {
      if (typeof v === "number" && Number.isInteger(n) && zonePoints.has(n)) out.push(n);
      continue;
    }
    if (n < 0) continue;
    if (mode === "HITS") out.push(n >= 1 ? 1 : 0);
    else if (mode === "RINGS_DECIMAL") out.push(Math.min(Math.round(n * 10) / 10, maxShotValue(stage, mode)));
    else out.push(Math.min(Math.round(n), stage.maxPerShot));
  }
  return out;
}
