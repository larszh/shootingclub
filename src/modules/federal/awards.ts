/**
 * Feldschiessen-Auszeichnungen (Kranz, Anerkennungskarte, eigene Bezeichnung): reine Logik ohne DB.
 *
 * Die Limiten trägt der Verein pro Programm und Jahr selbst ein (gemäss Ausschreibung). Die App
 * hinterlegt keine offiziellen Werte; eine Vorbelegung ist immer nur ein Beispiel zum Prüfen.
 *
 * Kategorien: Der Name einer Kategorie ist frei (z.B. «U21», «Elite», «Veteranen»). Optional gilt sie
 * nur für ein Alter (Jahrgang: Alter = Jahr − Geburtsjahr, wie bei der Jahresmeisterschaft).
 * Gespeichert wird die Kategorie lesbar in AwardLimit.category, z.B. «U21 (bis 20)», «Elite (21–59)»,
 * «Veteranen (ab 60)» oder nur «Alle».
 *
 * Waffenkategorie: Eine Limite kann zusätzlich nur für eine Waffenkategorie gelten (AwardLimit.weaponCategory,
 * frei, z.B. «A», «D», «E»; leer = alle). Der Schütze trägt seine Kategorie pro Teilnahme ein
 * (MatchParticipant.weaponCategory). Passend sind dann Limiten seiner Waffenkategorie und solche ohne;
 * ohne Angabe beim Schützen nur Limiten ohne Waffenkategorie.
 */
import { toCsv } from "@/modules/scores/analytics";

export const AWARD_LIMITS_HINT = "Limiten gemäss Ausschreibung eintragen.";
export const AWARD_EXAMPLE_HINT = "Beispiel, bitte prüfen";
/** Zusatz in der Auszeichnung von Beispiel-Limiten (z.B. Demo-Daten), damit die Markierung beim Speichern erhalten bleibt. */
export const AWARD_EXAMPLE_MARK = "(Beispiel)";
export const AWARD_EXAMPLE_NOTICE = `${AWARD_EXAMPLE_HINT}: Diese Limiten sind Beispielwerte, keine offiziellen Werte. Limiten gemäss Ausschreibung eintragen und speichern.`;
export const AWARD_FORMAT_HINT = "Eine Zeile pro Limite: Kategorie;Alter von;Alter bis;Limite;Auszeichnung, optional ;Waffenkategorie (z.B. D). Alter leer = ohne Grenze, ohne Waffenkategorie = für alle. Zeilen mit # werden ignoriert.";

/** Höchstlänge einer Waffenkategorie (z.B. «A», «D», «Stgw 90»). */
export const MAX_WEAPON_CATEGORY = 20;

/** Waffenkategorie bereinigen: getrimmt, Leerzeichen zusammengefasst, leer = null. */
export function normalizeWeaponCategory(raw: string | null | undefined): string | null {
  const v = (raw ?? "").replace(/\s+/g, " ").trim();
  return v ? v.slice(0, MAX_WEAPON_CATEGORY) : null;
}

/** Gleiche Waffenkategorie (ohne Gross-/Kleinschreibung)? */
export function sameWeaponCategory(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = normalizeWeaponCategory(a);
  const y = normalizeWeaponCategory(b);
  return x !== null && y !== null && x.toLowerCase() === y.toLowerCase();
}

/** Waffenkategorien aus Limiten (eindeutig, Schreibweise der ersten Nennung, sortiert). */
export function weaponCategoriesOf(limits: readonly { weaponCategory?: string | null }[]): string[] {
  const map = new Map<string, string>();
  for (const l of limits) {
    const w = normalizeWeaponCategory(l.weaponCategory);
    if (w && !map.has(w.toLowerCase())) map.set(w.toLowerCase(), w);
  }
  return [...map.values()].sort((a, b) => a.localeCompare(b, "de-CH", { numeric: true }));
}

/** true, wenn Limiten als Beispiel markiert sind (Kategorie oder Auszeichnung enthält «Beispiel»). */
export function isExampleLimits(limits: readonly Pick<AwardLimitLite, "category" | "award">[]): boolean {
  return limits.some((l) => /beispiel/i.test(l.award) || /beispiel/i.test(l.category));
}

/** Höchstzahl Limiten pro Programm und Jahr. */
export const MAX_AWARD_LINES = 60;

export type AwardCategory = { name: string; minAge: number | null; maxAge: number | null };

/** Lesbare Kategorie für AwardLimit.category. */
export function formatAwardCategory(c: AwardCategory): string {
  const name = c.name.trim();
  if (c.minAge !== null && c.maxAge !== null) return c.minAge === c.maxAge ? `${name} (${c.minAge})` : `${name} (${c.minAge}–${c.maxAge})`;
  if (c.minAge !== null) return `${name} (ab ${c.minAge})`;
  if (c.maxAge !== null) return `${name} (bis ${c.maxAge})`;
  return name;
}

/** Gegenstück zu formatAwardCategory (unbekanntes Format = Name ohne Altersgrenze). */
export function parseAwardCategory(raw: string): AwardCategory {
  const s = raw.trim();
  const m = /^(.*?)\s*\(\s*(?:(\d{1,3})\s*[–-]\s*(\d{1,3})|ab\s+(\d{1,3})|bis\s+(\d{1,3})|(\d{1,3}))\s*\)$/i.exec(s);
  if (!m) return { name: s, minAge: null, maxAge: null };
  const n = (v: string | undefined) => (v === undefined ? null : Number(v));
  const name = m[1]!.trim() || s;
  if (m[2] !== undefined) return { name, minAge: n(m[2]), maxAge: n(m[3]) };
  if (m[4] !== undefined) return { name, minAge: n(m[4]), maxAge: null };
  if (m[5] !== undefined) return { name, minAge: null, maxAge: n(m[5]) };
  return { name, minAge: n(m[6]), maxAge: n(m[6]) };
}

export type AwardLine = AwardCategory & { minScore: number; award: string; weaponCategory: string | null };
export type AwardLimitLite = { category: string; minScore: number; award: string; sort?: number; weaponCategory?: string | null };

/**
 * Liest die Limiten aus dem Freitext (eine pro Zeile «Kategorie;Alter von;Alter bis;Limite;Auszeichnung»,
 * optional mit «;Waffenkategorie»). Fehlerhafte Zeilen werden mit Zeilennummer gemeldet. Gleiche Kategorie
 * mit anderem Alter ist ein Fehler, ebenso die gleiche Auszeichnung zweimal in derselben Kategorie und
 * Waffenkategorie.
 */
export function parseAwardLines(text: string | null | undefined, maxScore?: number | null): { lines: AwardLine[]; errors: string[] } {
  const lines: AwardLine[] = [];
  const errors: string[] = [];
  const num = (raw: string | undefined, decimal: boolean): number | null | undefined => {
    const v = (raw ?? "").trim().replace(",", ".");
    if (v === "") return null;
    const n = Number(v);
    if (!Number.isFinite(n) || (!decimal && !Number.isInteger(n))) return undefined;
    return n;
  };
  (text ?? "").split(/\r?\n/).forEach((rawLine, i) => {
    const line = rawLine.trim();
    const nr = i + 1;
    if (!line || line.startsWith("#")) return;
    const parts = line.split(";").map((p) => p.trim());
    if (parts.length !== 5 && parts.length !== 6) {
      errors.push(`Zeile ${nr}: fünf oder sechs Felder angeben (Kategorie;Alter von;Alter bis;Limite;Auszeichnung;Waffenkategorie).`);
      return;
    }
    const [name, fromRaw, toRaw, scoreRaw, award, weaponRaw] = parts as [string, string, string, string, string, string | undefined];
    if (!name) return void errors.push(`Zeile ${nr}: Kategorie fehlt.`);
    if (name.length > 60) return void errors.push(`Zeile ${nr}: Kategorie höchstens 60 Zeichen.`);
    if (/[()]/.test(name)) return void errors.push(`Zeile ${nr}: Kategorie ohne Klammern angeben (das Alter gehört in die eigenen Felder).`);
    const minAge = num(fromRaw, false);
    const maxAge = num(toRaw, false);
    if (minAge === undefined || maxAge === undefined) return void errors.push(`Zeile ${nr}: Alter als ganze Zahl angeben.`);
    if ((minAge !== null && (minAge < 0 || minAge > 120)) || (maxAge !== null && (maxAge < 0 || maxAge > 120))) return void errors.push(`Zeile ${nr}: Alter zwischen 0 und 120.`);
    if (minAge !== null && maxAge !== null && minAge > maxAge) return void errors.push(`Zeile ${nr}: «Alter von» ist grösser als «Alter bis».`);
    const minScore = num(scoreRaw, true);
    if (minScore === undefined || minScore === null) return void errors.push(`Zeile ${nr}: Limite als Zahl angeben.`);
    if (minScore < 0) return void errors.push(`Zeile ${nr}: Limite nicht negativ.`);
    if (maxScore && minScore > maxScore) return void errors.push(`Zeile ${nr}: Limite ${minScore} ist höher als das Maximum des Programms (${maxScore}).`);
    if (!award) return void errors.push(`Zeile ${nr}: Auszeichnung fehlt (z.B. Kranz).`);
    if (award.length > 60) return void errors.push(`Zeile ${nr}: Auszeichnung höchstens 60 Zeichen.`);
    if ((weaponRaw ?? "").trim().length > MAX_WEAPON_CATEGORY) return void errors.push(`Zeile ${nr}: Waffenkategorie höchstens ${MAX_WEAPON_CATEGORY} Zeichen.`);
    const weaponCategory = normalizeWeaponCategory(weaponRaw);
    const same = lines.find((l) => l.name.toLowerCase() === name.toLowerCase());
    if (same && (same.minAge !== minAge || same.maxAge !== maxAge)) return void errors.push(`Zeile ${nr}: Kategorie «${name}» ist schon mit einem anderen Alter erfasst.`);
    const sameWeapon = (w: string | null) => (w === null ? weaponCategory === null : sameWeaponCategory(w, weaponCategory));
    if (lines.some((l) => l.name.toLowerCase() === name.toLowerCase() && sameWeapon(l.weaponCategory) && l.award.toLowerCase() === award.toLowerCase())) {
      return void errors.push(weaponCategory ? `Zeile ${nr}: «${award}» in der Kategorie «${name}» (Waffenkategorie ${weaponCategory}) doppelt.` : `Zeile ${nr}: «${award}» in der Kategorie «${name}» doppelt.`);
    }
    if (lines.length >= MAX_AWARD_LINES) return void errors.push(`Zeile ${nr}: höchstens ${MAX_AWARD_LINES} Limiten.`);
    lines.push({ name, minAge, maxAge, minScore, award, weaponCategory });
  });
  return { lines, errors };
}

/** Gespeicherte Limiten als Text für das Formular (Reihenfolge nach sort). */
export function awardLimitsToText(limits: readonly AwardLimitLite[]): string {
  return [...limits]
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
    .map((l) => {
      const c = parseAwardCategory(l.category);
      const weapon = normalizeWeaponCategory(l.weaponCategory);
      return [c.name, c.minAge ?? "", c.maxAge ?? "", fmtScore(l.minScore), l.award, ...(weapon ? [weapon] : [])].join(";");
    })
    .join("\n");
}

function fmtScore(n: number) {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
}

/** Zeilen → Datensätze für AwardLimit (category lesbar, sort = Reihenfolge). */
export function awardLinesToRows(lines: readonly AwardLine[]): Array<{ category: string; minScore: number; award: string; sort: number; weaponCategory: string | null }> {
  return lines.map((l, i) => ({ category: formatAwardCategory(l).slice(0, 191), minScore: l.minScore, award: l.award.slice(0, 191), sort: i, weaponCategory: normalizeWeaponCategory(l.weaponCategory) }));
}

// ---------------------------------------------------------------------------
// Berechnung
// ---------------------------------------------------------------------------

export type AwardResult =
  /** Auszeichnung erreicht (weaponCategory: Waffenkategorie der Limite, null = für alle) */
  | { status: "award"; award: string; category: string; minScore: number; weaponCategory?: string | null }
  /** Kategorie gefunden, Limite nicht erreicht */
  | { status: "none"; award: null; category: string; minScore: null; weaponCategory?: string | null }
  /** Limiten vorhanden, aber keine passende Kategorie (z.B. Geburtsdatum fehlt) */
  | { status: "no-category"; award: null; category: null; minScore: null }
  /** Keine Limiten für Programm/Jahr erfasst */
  | { status: "no-limits"; award: null; category: null; minScore: null };

/** Alter im Jahr (Jahrgang): Jahr − Geburtsjahr. */
export function ageInYear(birthYear: number, year: number): number {
  return year - birthYear;
}

/**
 * Kategorie und Auszeichnung eines Resultats. Passend sind Kategorien, deren Alter den Schützen umfasst
 * (Kategorien ohne Alter passen immer) und deren Waffenkategorie zu der des Schützen passt (Limiten ohne
 * Waffenkategorie passen immer; ohne Angabe beim Schützen passen nur diese). Gibt es mehrere, gilt zuerst
 * die eigene Waffenkategorie vor «für alle», dann die engste Altersspanne (z.B. «U21 (bis 20)» vor «Alle»).
 * In der Kategorie zählt die höchste erreichte Limite.
 */
export function awardFor(limits: readonly AwardLimitLite[], total: number | null, birthYear: number | null, year: number, weaponCategory?: string | null): AwardResult {
  if (!limits.length) return { status: "no-limits", award: null, category: null, minScore: null };
  const age = birthYear === null ? null : ageInYear(birthYear, year);
  const shooterWeapon = normalizeWeaponCategory(weaponCategory);
  const cats = new Map<string, { category: string; weapon: string | null; cat: AwardCategory; width: number; order: number; limits: AwardLimitLite[] }>();
  limits.forEach((l, i) => {
    const weapon = normalizeWeaponCategory(l.weaponCategory);
    const key = `${l.category}\u0000${weapon?.toLowerCase() ?? ""}`;
    const existing = cats.get(key);
    if (existing) {
      existing.limits.push(l);
      return;
    }
    const cat = parseAwardCategory(l.category);
    const width = (cat.maxAge ?? 200) - (cat.minAge ?? 0);
    cats.set(key, { category: l.category, weapon, cat, width, order: l.sort ?? i, limits: [l] });
  });
  const candidates = [...cats.values()].filter((c) => {
    if (c.weapon !== null && !sameWeaponCategory(c.weapon, shooterWeapon)) return false;
    if (c.cat.minAge === null && c.cat.maxAge === null) return true;
    if (age === null) return false;
    return (c.cat.minAge === null || age >= c.cat.minAge) && (c.cat.maxAge === null || age <= c.cat.maxAge);
  });
  if (!candidates.length) return { status: "no-category", award: null, category: null, minScore: null };
  candidates.sort((a, b) => Number(b.weapon !== null) - Number(a.weapon !== null) || a.width - b.width || a.order - b.order);
  const chosen = candidates[0]!;
  const { category, weapon } = chosen;
  if (total === null) return { status: "none", award: null, category, minScore: null, weaponCategory: weapon };
  const reached = chosen.limits.filter((l) => total >= l.minScore - 1e-9).sort((a, b) => b.minScore - a.minScore || (a.sort ?? 0) - (b.sort ?? 0));
  const best = reached[0];
  if (!best) return { status: "none", award: null, category, minScore: null, weaponCategory: weapon };
  return { status: "award", award: best.award, category, minScore: best.minScore, weaponCategory: weapon };
}

/** Kategorie für Anzeige und Export, z.B. «Elite (21–59) · D» bei einer Limite für Waffenkategorie D. */
export function awardCategoryLabel(r: AwardResult): string {
  if (!r.category) return "";
  return r.weaponCategory ? `${r.category} · ${r.weaponCategory}` : r.category;
}

export type FsResultLite = {
  id: string;
  programId: string;
  /** Mitglied (userId) oder Gast (Name) */
  shooterKey: string;
  total: number;
  zeros: number | null;
  isOfficial: boolean;
};

/**
 * Pro Schütze und Programm ein Resultat: das amtlich bestätigte (bestes, falls mehrere), sonst das beste.
 * Bei Gleichstand zählen weniger Nuller.
 */
export function bestPerShooter<T extends FsResultLite>(rows: readonly T[]): T[] {
  const map = new Map<string, T>();
  const better = (a: T, b: T) => (a.isOfficial !== b.isOfficial ? a.isOfficial : a.total !== b.total ? a.total > b.total : (a.zeros ?? 0) < (b.zeros ?? 0));
  for (const r of rows) {
    const key = `${r.programId}|${r.shooterKey}`;
    const cur = map.get(key);
    if (!cur || better(r, cur)) map.set(key, r);
  }
  return [...map.values()];
}

/** Anzahl pro Auszeichnung (für die Übersicht), sortiert nach Häufigkeit. */
export function countAwards(results: readonly AwardResult[]): Array<{ award: string; count: number }> {
  const map = new Map<string, number>();
  for (const r of results) if (r.status === "award") map.set(r.award, (map.get(r.award) ?? 0) + 1);
  return [...map.entries()].map(([award, count]) => ({ award, count })).sort((a, b) => b.count - a.count || a.award.localeCompare(b.award, "de-CH"));
}

export function awardStatusText(r: AwardResult): string {
  if (r.status === "award") return r.award;
  if (r.status === "none") return "keine";
  if (r.status === "no-category") return "keine Kategorie";
  return "";
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export type AwardExportRow = {
  name: string;
  birthYear: number | null;
  /** Waffenkategorie des Schützen (Teilnahme), null = keine Angabe */
  weaponCategory?: string | null;
  program: string;
  total: number;
  zeros: number | null;
  isOfficial: boolean;
  isGuest: boolean;
  date: string;
  result: AwardResult;
};

export const AWARD_CSV_HEADER = ["Name", "Jahrgang", "Programm", "Kategorie", "Waffenkategorie", "Resultat", "Nuller", "Auszeichnung", "Amtlich", "Gast", "Datum"];

export function awardRowCells(r: AwardExportRow): string[] {
  return [
    r.name,
    r.birthYear === null ? "" : String(r.birthYear),
    r.program,
    r.result.category ?? "",
    r.weaponCategory ?? "",
    fmtScore(r.total),
    r.zeros === null ? "" : String(r.zeros),
    awardStatusText(r.result),
    r.isOfficial ? "ja" : "nein",
    r.isGuest ? "ja" : "nein",
    r.date,
  ];
}

/** CSV (Semikolon, UTF-8 mit BOM, Schutz gegen Formel-Injection). */
export function buildAwardsCsv(rows: readonly AwardExportRow[]): string {
  return toCsv([AWARD_CSV_HEADER, ...rows.map(awardRowCells)]);
}
