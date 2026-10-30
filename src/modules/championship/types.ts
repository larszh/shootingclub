import { z } from "zod";

/**
 * Jahresmeisterschaft: Typen, Validierung und Kategorien-Parser.
 * Rein, ohne DB und ohne "server-only" (auch im Browser und in Tests nutzbar).
 */

export const CHAMPIONSHIP_RULES_HINT =
  "Die Rangliste wird nach den hier erfassten Regeln berechnet. Reglement und Werte bitte selbst prüfen; massgebend ist das Reglement des Vereins.";

/** Bezeichnung für Mitglieder ohne Geburtsdatum bzw. ohne passende Kategorie. */
export const NO_CATEGORY = "ohne Kategorie";

export type ChampionshipCategory = {
  name: string;
  /** Mindestalter (inkl.), null = ohne Untergrenze */
  minAge: number | null;
  /** Höchstalter (inkl.), null = ohne Obergrenze */
  maxAge: number | null;
  /** Bonuspunkte, die zum Total addiert werden */
  bonus: number;
};

export const CATEGORY_EXAMPLE = "Junioren;0;20;0\nElite;21;59;0\nVeteranen;60;69;2\nSeniorveteranen;70;;4";

/**
 * Liest die Kategorien aus dem Freitext: eine pro Zeile «Name;minAlter;maxAlter;Bonus».
 * Leere Felder = offen bzw. 0 Bonus. Zeilen mit # am Anfang und Leerzeilen werden ignoriert.
 * Fehlerhafte Zeilen werden mit Zeilennummer gemeldet.
 */
export function parseCategories(text: string | null | undefined): { categories: ChampionshipCategory[]; errors: string[] } {
  const categories: ChampionshipCategory[] = [];
  const errors: string[] = [];
  const lines = (text ?? "").split(/\r?\n/);
  const num = (raw: string | undefined, allowDecimal: boolean): number | null | undefined => {
    const s = (raw ?? "").trim().replace(",", ".");
    if (s === "") return null;
    const n = Number(s);
    if (!Number.isFinite(n)) return undefined;
    if (!allowDecimal && !Number.isInteger(n)) return undefined;
    return n;
  };
  lines.forEach((rawLine, i) => {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) return;
    const parts = line.split(";");
    const name = (parts[0] ?? "").trim();
    const nr = i + 1;
    if (!name) {
      errors.push(`Zeile ${nr}: Name fehlt.`);
      return;
    }
    if (name.length > 60) {
      errors.push(`Zeile ${nr}: Name höchstens 60 Zeichen.`);
      return;
    }
    if (parts.length > 4) {
      errors.push(`Zeile ${nr}: höchstens vier Felder (Name;minAlter;maxAlter;Bonus).`);
      return;
    }
    const minAge = num(parts[1], false);
    const maxAge = num(parts[2], false);
    const bonus = num(parts[3], true);
    if (minAge === undefined || maxAge === undefined) {
      errors.push(`Zeile ${nr}: Alter als ganze Zahl angeben.`);
      return;
    }
    if (bonus === undefined) {
      errors.push(`Zeile ${nr}: Bonus als Zahl angeben.`);
      return;
    }
    if ((minAge !== null && (minAge < 0 || minAge > 120)) || (maxAge !== null && (maxAge < 0 || maxAge > 120))) {
      errors.push(`Zeile ${nr}: Alter zwischen 0 und 120.`);
      return;
    }
    if (minAge !== null && maxAge !== null && minAge > maxAge) {
      errors.push(`Zeile ${nr}: Mindestalter ist grösser als Höchstalter.`);
      return;
    }
    if (bonus !== null && Math.abs(bonus) > 1000) {
      errors.push(`Zeile ${nr}: Bonus höchstens ±1000.`);
      return;
    }
    if (categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      errors.push(`Zeile ${nr}: Kategorie «${name}» doppelt.`);
      return;
    }
    if (name.toLowerCase() === NO_CATEGORY.toLowerCase()) {
      errors.push(`Zeile ${nr}: «${NO_CATEGORY}» ist reserviert.`);
      return;
    }
    categories.push({ name, minAge, maxAge, bonus: bonus ?? 0 });
  });
  return { categories, errors };
}

/** Alter im Meisterschaftsjahr (Jahrgang): erreichtes Alter am 31.12. des Jahres. */
export function ageInYear(birthYear: number, year: number): number {
  return year - birthYear;
}

/** Erste passende Kategorie (Reihenfolge wie im Text) oder null (→ «ohne Kategorie»). */
export function categoryForBirthYear(categories: readonly ChampionshipCategory[], birthYear: number | null, year: number): ChampionshipCategory | null {
  if (birthYear === null) return null;
  const age = ageInYear(birthYear, year);
  return categories.find((c) => (c.minAge === null || age >= c.minAge) && (c.maxAge === null || age <= c.maxAge)) ?? null;
}

// ---------------------------------------------------------------------------
// Formular
// ---------------------------------------------------------------------------

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum fehlt");

export const championshipProgramSchema = z.object({
  programId: z.string().min(1).max(40),
  required: z.boolean(),
  weight: z.coerce.number().min(0, "Gewicht mindestens 0").max(100, "Gewicht höchstens 100"),
  maxCount: z.coerce.number().int("Anzahl als ganze Zahl").min(1, "Anzahl mindestens 1").max(100, "Anzahl höchstens 100").nullable(),
});
export type ChampionshipProgramInput = z.infer<typeof championshipProgramSchema>;

export const championshipSchema = z
  .object({
    name: z.string().trim().min(1, "Name fehlt").max(120, "Name höchstens 120 Zeichen"),
    year: z.coerce.number().int().min(2000, "Jahr ungültig").max(2100, "Jahr ungültig"),
    startsOn: day,
    endsOn: day,
    bestOf: z.coerce.number().int("Anzahl als ganze Zahl").min(1, "Mindestens 1").max(100, "Höchstens 100").nullable(),
    officialOnly: z.boolean(),
    categoriesText: z.string().max(5000, "Kategorien zu lang").nullable(),
    rulesText: z.string().max(20000, "Reglement zu lang").nullable(),
    programs: z.array(championshipProgramSchema).min(1, "Mindestens ein Programm wählen").max(30, "Höchstens 30 Programme"),
  })
  .refine((v) => v.startsOn <= v.endsOn, { message: "Ende liegt vor dem Beginn", path: ["endsOn"] });
export type ChampionshipInput = z.infer<typeof championshipSchema>;

/** Gewicht für die Anzeige: «×1», «×1.5». */
export function formatWeight(w: number) {
  return `×${Math.round(w * 100) / 100}`;
}

/** Punkte mit höchstens einer Nachkommastelle (Schweizer Schreibweise mit Punkt). */
export function formatPoints(n: number | null | undefined) {
  if (n === null || n === undefined || !Number.isFinite(n)) return "–";
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}
