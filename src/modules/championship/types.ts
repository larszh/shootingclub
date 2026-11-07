import { z } from "zod";

/** Optionaler Übersetzer; ohne gilt der deutsche Text (mit {Platzhaltern}). */
type Tr = (key: string, vars?: Record<string, string | number>) => string;
const L = (t: Tr | undefined, key: string, de: string, vars?: Record<string, string | number>) =>
  t ? t(key, vars) : de.replace(/\{(\w+)\}/g, (_, k: string) => String(vars?.[k] ?? `{${k}}`));

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
export function parseCategories(text: string | null | undefined, t?: Tr): { categories: ChampionshipCategory[]; errors: string[] } {
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
      errors.push(L(t, "adm2.champ.cat.nameMissing", "Zeile {nr}: Name fehlt.", { nr }));
      return;
    }
    if (name.length > 60) {
      errors.push(L(t, "adm2.champ.cat.nameMax", "Zeile {nr}: Name höchstens 60 Zeichen.", { nr }));
      return;
    }
    if (parts.length > 4) {
      errors.push(L(t, "adm2.champ.cat.fields", "Zeile {nr}: höchstens vier Felder (Name;minAlter;maxAlter;Bonus).", { nr }));
      return;
    }
    const minAge = num(parts[1], false);
    const maxAge = num(parts[2], false);
    const bonus = num(parts[3], true);
    if (minAge === undefined || maxAge === undefined) {
      errors.push(L(t, "adm2.champ.cat.ageInt", "Zeile {nr}: Alter als ganze Zahl angeben.", { nr }));
      return;
    }
    if (bonus === undefined) {
      errors.push(L(t, "adm2.champ.cat.bonusNum", "Zeile {nr}: Bonus als Zahl angeben.", { nr }));
      return;
    }
    if ((minAge !== null && (minAge < 0 || minAge > 120)) || (maxAge !== null && (maxAge < 0 || maxAge > 120))) {
      errors.push(L(t, "adm2.champ.cat.ageRange", "Zeile {nr}: Alter zwischen 0 und 120.", { nr }));
      return;
    }
    if (minAge !== null && maxAge !== null && minAge > maxAge) {
      errors.push(L(t, "adm2.champ.cat.minMax", "Zeile {nr}: Mindestalter ist grösser als Höchstalter.", { nr }));
      return;
    }
    if (bonus !== null && Math.abs(bonus) > 1000) {
      errors.push(L(t, "adm2.champ.cat.bonusMax", "Zeile {nr}: Bonus höchstens ±1000.", { nr }));
      return;
    }
    if (categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      errors.push(L(t, "adm2.champ.cat.dup", "Zeile {nr}: Kategorie «{name}» doppelt.", { nr, name }));
      return;
    }
    if (name.toLowerCase() === NO_CATEGORY.toLowerCase()) {
      errors.push(L(t, "adm2.champ.cat.reserved", "Zeile {nr}: «{name}» ist reserviert.", { nr, name: NO_CATEGORY }));
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

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "adm2.champ.v.date");

export const championshipProgramSchema = z.object({
  programId: z.string().min(1).max(40),
  required: z.boolean(),
  // Ohne coerce: Das Formular schickt Zahlen als JSON; ungültige Eingaben (null/Text) dürfen nicht still zu 0 werden.
  weight: z.number({ error: "adm2.champ.v.weightNum" }).min(0, "adm2.champ.v.weightMin").max(100, "adm2.champ.v.weightMax"),
  maxCount: z.number({ error: "adm2.champ.v.countNum" }).int("adm2.champ.v.countInt").min(1, "adm2.champ.v.countMin").max(100, "adm2.champ.v.countMax").nullable(),
});
export type ChampionshipProgramInput = z.infer<typeof championshipProgramSchema>;

export const championshipSchema = z
  .object({
    name: z.string().trim().min(1, "adm2.champ.v.name").max(120, "adm2.champ.v.nameMax"),
    year: z.coerce.number().int().min(2000, "adm2.champ.v.year").max(2100, "adm2.champ.v.year"),
    startsOn: day,
    endsOn: day,
    bestOf: z.coerce.number().int("adm2.champ.v.countInt").min(1, "adm2.champ.v.min1").max(100, "adm2.champ.v.max100").nullable(),
    officialOnly: z.boolean(),
    categoriesText: z.string().max(5000, "adm2.champ.v.catsLong").nullable(),
    rulesText: z.string().max(20000, "adm2.champ.v.rulesLong").nullable(),
    programs: z.array(championshipProgramSchema).min(1, "adm2.champ.v.programMin").max(30, "adm2.champ.v.programMax"),
  })
  .refine((v) => v.startsOn <= v.endsOn, { message: "adm2.champ.v.endBefore", path: ["endsOn"] });
export type ChampionshipInput = z.infer<typeof championshipSchema>;

/** Zahl aus einem Formularfeld («1,5» oder «1.5»); null, wenn keine gültige Zahl. */
export function parseDecimalInput(raw: string): number | null {
  const s = raw.trim().replace(",", ".");
  if (!/^-?\d+(\.\d+)?$|^-?\.\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Fehlermeldung zum Gewicht eines Programms (leer = 1), sonst null. */
export function weightInputError(raw: string, t?: Tr): string | null {
  if (raw.trim() === "") return null;
  const n = parseDecimalInput(raw);
  if (n === null) return L(t, "adm2.champ.v.weightNum", "Gewicht als Zahl angeben");
  if (n < 0) return L(t, "adm2.champ.v.weightMin", "Gewicht mindestens 0");
  if (n > 100) return L(t, "adm2.champ.v.weightMax", "Gewicht höchstens 100");
  return null;
}

/** Fehlermeldung zur Anzahl «Beste N» eines Programms (leer = wie oben), sonst null. */
export function maxCountInputError(raw: string, t?: Tr): string | null {
  if (raw.trim() === "") return null;
  const n = parseDecimalInput(raw);
  if (n === null || !Number.isInteger(n)) return L(t, "adm2.champ.v.countNum", "Anzahl als ganze Zahl angeben");
  if (n < 1) return L(t, "adm2.champ.v.countMin", "Anzahl mindestens 1");
  if (n > 100) return L(t, "adm2.champ.v.countMax", "Anzahl höchstens 100");
  return null;
}

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
