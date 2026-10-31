/**
 * Rangliste der Jahresmeisterschaft. Rein, ohne DB (getestet in ranking.test.ts).
 *
 * Regeln:
 * - Es zählen nur abgeschlossene Durchgänge im Zeitraum (Schweizer Kalendertag), auf Wunsch nur amtlich bestätigte.
 * - Pro Mitglied und Programm zählen die besten N Resultate (maxCount des Programms, sonst bestOf, sonst alle).
 *   Die übrigen sind Streichresultate.
 * - Total = Summe(Programm-Summe × Gewicht) + Bonus der Kategorie.
 * - Wer ein Pflichtprogramm nicht geschossen hat, ist «nicht klassiert» (separat gelistet).
 * - Gleichstand: zuerst bestes Einzelresultat, dann mehr gezählte Resultate. Sonst gleicher Rang.
 */

import { NO_CATEGORY, categoryForBirthYear, type ChampionshipCategory } from "./types";

export type RankingProgram = { programId: string; name: string; required: boolean; weight: number; maxCount: number | null };

export type RankingConfig = {
  year: number;
  /** "YYYY-MM-DD" (inkl.) */
  startsOn: string;
  endsOn: string;
  bestOf: number | null;
  officialOnly: boolean;
  programs: RankingProgram[];
  categories: ChampionshipCategory[];
};

export type RankingMember = { userId: string; name: string; birthYear: number | null };

export type RankingResult = {
  participantId: string;
  userId: string;
  programId: string;
  matchId: string;
  /** Schweizer Kalendertag des Durchgangs, "YYYY-MM-DD" */
  day: string;
  finished: boolean;
  isOfficial: boolean;
  /** Gespeichertes Total (MatchParticipant.total), kann fehlen */
  total: number | null;
  /** Fallback: Totale der Serien (MatchResult.total) */
  stageTotals?: number[];
};

export type ScoredResult = RankingResult & { score: number };

export type ProgramStanding = {
  programId: string;
  name: string;
  required: boolean;
  weight: number;
  /** Höchstzahl gezählter Resultate (null = alle) */
  limit: number | null;
  counted: ScoredResult[];
  struck: ScoredResult[];
  sum: number;
  weighted: number;
};

export type RankingEntry = {
  userId: string;
  name: string;
  birthYear: number | null;
  category: string;
  bonus: number;
  /** Summe der gewichteten Programme (ohne Bonus) */
  base: number;
  total: number;
  bestSingle: number;
  countedResults: number;
  programs: ProgramStanding[];
  /** Namen der fehlenden Pflichtprogramme (leer = klassiert) */
  missingRequired: string[];
  /** Rang (1-basiert) in der Gesamtrangliste; null = nicht klassiert */
  rank: number | null;
};

export type Ranking = {
  ranked: RankingEntry[];
  unclassified: RankingEntry[];
  /** Kategorien in Reihenfolge der Definition (plus «ohne Kategorie», falls besetzt) mit eigener Rangierung */
  categories: Array<{ name: string; entries: Array<RankingEntry & { categoryRank: number }> }>;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Wert eines Resultats: gespeichertes Total, sonst Summe der Serien; null = nicht wertbar. */
export function resultScore(r: Pick<RankingResult, "total" | "stageTotals">): number | null {
  if (typeof r.total === "number" && Number.isFinite(r.total)) return r.total;
  if (r.stageTotals && r.stageTotals.length) return round2(r.stageTotals.reduce((a, b) => a + b, 0));
  return null;
}

/** Zählt das Resultat für diese Meisterschaft (Status, Zeitraum, amtlich)? */
export function isEligible(r: RankingResult, cfg: Pick<RankingConfig, "startsOn" | "endsOn" | "officialOnly">) {
  if (!r.finished) return false;
  if (r.day < cfg.startsOn || r.day > cfg.endsOn) return false;
  if (cfg.officialOnly && !r.isOfficial) return false;
  return true;
}

/** Bessere Resultate zuerst; bei gleichem Wert das frühere (stabil, nachvollziehbar). */
function byScore(a: ScoredResult, b: ScoredResult) {
  return b.score - a.score || a.day.localeCompare(b.day) || a.participantId.localeCompare(b.participantId);
}

/** Vergleich für die Rangliste: Total, bestes Einzelresultat, Anzahl Resultate. 0 = Gleichstand. */
export function compareEntries(a: Pick<RankingEntry, "total" | "bestSingle" | "countedResults">, b: Pick<RankingEntry, "total" | "bestSingle" | "countedResults">) {
  return b.total - a.total || b.bestSingle - a.bestSingle || b.countedResults - a.countedResults;
}

/** Sortiert und vergibt Ränge mit Gleichstand (1, 1, 3). */
export function assignRanks<T extends Pick<RankingEntry, "total" | "bestSingle" | "countedResults" | "name">>(entries: T[]): Array<T & { position: number }> {
  const sorted = [...entries].sort((a, b) => compareEntries(a, b) || a.name.localeCompare(b.name, "de-CH"));
  let rank = 0;
  return sorted.map((e, i) => {
    if (i === 0 || compareEntries(sorted[i - 1]!, e) !== 0) rank = i + 1;
    return { ...e, position: rank };
  });
}

export function computeRanking(cfg: RankingConfig, members: RankingMember[], results: RankingResult[]): Ranking {
  const programIds = new Set(cfg.programs.map((p) => p.programId));
  const byUser = new Map<string, ScoredResult[]>();
  for (const r of results) {
    if (!programIds.has(r.programId) || !isEligible(r, cfg)) continue;
    const score = resultScore(r);
    if (score === null) continue;
    const list = byUser.get(r.userId) ?? [];
    list.push({ ...r, score });
    byUser.set(r.userId, list);
  }

  const memberMap = new Map(members.map((m) => [m.userId, m]));
  const entries: RankingEntry[] = [];
  for (const [userId, list] of byUser) {
    const member = memberMap.get(userId);
    if (!member) continue;
    const cat = categoryForBirthYear(cfg.categories, member.birthYear, cfg.year);
    const programs: ProgramStanding[] = cfg.programs.map((p) => {
      const limit = p.maxCount ?? cfg.bestOf ?? null;
      const sorted = list.filter((r) => r.programId === p.programId).sort(byScore);
      const counted = limit === null ? sorted : sorted.slice(0, limit);
      const struck = limit === null ? [] : sorted.slice(limit);
      const sum = round2(counted.reduce((a, r) => a + r.score, 0));
      return { programId: p.programId, name: p.name, required: p.required, weight: p.weight, limit, counted, struck, sum, weighted: round2(sum * p.weight) };
    });
    const countedAll = programs.flatMap((p) => p.counted);
    if (countedAll.length === 0) continue;
    const base = round2(programs.reduce((a, p) => a + p.weighted, 0));
    const bonus = cat?.bonus ?? 0;
    entries.push({
      userId,
      name: member.name,
      birthYear: member.birthYear,
      category: cat?.name ?? NO_CATEGORY,
      bonus,
      base,
      total: round2(base + bonus),
      bestSingle: Math.max(...countedAll.map((r) => r.score)),
      countedResults: countedAll.length,
      programs,
      missingRequired: programs.filter((p) => p.required && p.counted.length === 0).map((p) => p.name),
      rank: null,
    });
  }

  const classified = entries.filter((e) => e.missingRequired.length === 0);
  const ranked = assignRanks(classified).map(({ position, ...e }) => ({ ...e, rank: position }));
  const unclassified = entries
    .filter((e) => e.missingRequired.length > 0)
    .sort((a, b) => compareEntries(a, b) || a.name.localeCompare(b.name, "de-CH"));

  const catNames = [...cfg.categories.map((c) => c.name), NO_CATEGORY];
  const categories = catNames
    .map((name) => {
      const inCat = ranked.filter((e) => e.category === name);
      const withRank = assignRanks(inCat).map(({ position, ...e }) => ({ ...e, categoryRank: position }));
      return { name, entries: withRank };
    })
    .filter((c) => c.entries.length > 0);

  return { ranked, unclassified, categories };
}

/** Kurzinfo für «Mein Stand»: wie viele Resultate pro Programm noch zählen könnten. */
export function openSlots(entry: Pick<RankingEntry, "programs">) {
  return entry.programs.map((p) => ({
    programId: p.programId,
    name: p.name,
    counted: p.counted.length,
    limit: p.limit,
    open: p.limit === null ? null : Math.max(0, p.limit - p.counted.length),
    /** Schwächstes gezähltes Resultat (muss übertroffen werden, sobald alle Plätze belegt sind) */
    weakest: p.limit !== null && p.counted.length >= p.limit && p.counted.length ? p.counted[p.counted.length - 1]!.score : null,
  }));
}

/** Podest (Ränge 1–3, bei Gleichstand auch mehr Personen). */
export function podium<T extends { rank: number | null }>(ranked: T[]): T[] {
  return ranked.filter((e) => e.rank !== null && e.rank <= 3);
}

/** Eintrag eines Mitglieds (klassiert oder nicht) samt Rang in der Kategorie. */
export function findEntry(ranking: Ranking, userId: string): { entry: RankingEntry | null; categoryRank: number | null } {
  const entry = ranking.ranked.find((e) => e.userId === userId) ?? ranking.unclassified.find((e) => e.userId === userId) ?? null;
  if (!entry || entry.rank === null) return { entry, categoryRank: null };
  const cat = ranking.categories.find((c) => c.name === entry.category);
  return { entry, categoryRank: cat?.entries.find((e) => e.userId === userId)?.categoryRank ?? null };
}
