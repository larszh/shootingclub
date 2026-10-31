import "server-only";
import { db } from "@/lib/db";
import { addDays, zurichParts, zurichToUtc } from "@/lib/time";
import { computeRanking, type Ranking, type RankingConfig, type RankingMember, type RankingResult } from "./ranking";
import { parseCategories } from "./types";

/** @db.Date → "YYYY-MM-DD" (UTC-Mitternacht des Schweizer Kalendertags). */
export function dayFromDb(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" → @db.Date (UTC-Mitternacht), null bei ungültigem Datum. */
export function dbFromDay(day: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m! - 1 && dt.getUTCDate() === d ? dt : null;
}

/** "YYYY-MM-DD" → «TT.MM.JJJJ». */
export function chDay(day: string) {
  const [y, m, d] = day.split("-");
  return `${d}.${m}.${y}`;
}

export type ChampionshipListItem = {
  id: string;
  name: string;
  year: number;
  startsOn: string;
  endsOn: string;
  isPublished: boolean;
  programCount: number;
};

export async function listChampionships(tenantId: string, opts: { includeUnpublished: boolean }): Promise<ChampionshipListItem[]> {
  const rows = await db.championship.findMany({
    where: { tenantId, ...(opts.includeUnpublished ? {} : { isPublished: true }) },
    orderBy: [{ year: "desc" }, { startsOn: "desc" }, { name: "asc" }],
    select: { id: true, name: true, year: true, startsOn: true, endsOn: true, isPublished: true, _count: { select: { programs: true } } },
    take: 200,
  });
  return rows.map((r) => ({
    id: r.id, name: r.name, year: r.year, startsOn: dayFromDb(r.startsOn), endsOn: dayFromDb(r.endsOn), isPublished: r.isPublished, programCount: r._count.programs,
  }));
}

export async function getChampionship(tenantId: string, id: string) {
  if (!id || id.length > 40) return null;
  const c = await db.championship.findFirst({
    where: { id, tenantId },
    include: {
      programs: {
        include: { program: { select: { id: true, name: true, discipline: true, scoringMode: true, tenantId: true } } },
      },
    },
  });
  if (!c) return null;
  // Programme eines anderen Vereins nie anzeigen (sollte nicht vorkommen, Schutz gegen Altlasten).
  const programs = c.programs
    .filter((p) => p.program.tenantId === null || p.program.tenantId === tenantId)
    .sort((a, b) => Number(b.required) - Number(a.required) || a.program.name.localeCompare(b.program.name, "de-CH"))
    .map((p) => ({
      programId: p.programId,
      name: p.program.name,
      discipline: p.program.discipline,
      scoringMode: p.program.scoringMode,
      required: p.required,
      weight: p.weight,
      maxCount: p.maxCount,
    }));
  return {
    id: c.id,
    name: c.name,
    year: c.year,
    startsOn: dayFromDb(c.startsOn),
    endsOn: dayFromDb(c.endsOn),
    bestOf: c.bestOf,
    officialOnly: c.officialOnly,
    categoriesText: c.categoriesText ?? "",
    rulesText: c.rulesText ?? "",
    isPublished: c.isPublished,
    updatedAt: c.updatedAt,
    programs,
  };
}
export type ChampionshipView = NonNullable<Awaited<ReturnType<typeof getChampionship>>>;

/** Programme zur Auswahl: globale und eigene, nicht archiviert, nicht versteckt (plus bereits gewählte). */
export async function listSelectablePrograms(tenantId: string, keepIds: string[] = []) {
  const [programs, hidden] = await Promise.all([
    db.program.findMany({
      where: { OR: [{ tenantId: null }, { tenantId }] },
      select: { id: true, name: true, discipline: true, isArchived: true, officialKind: true },
      orderBy: { name: "asc" },
      take: 500,
    }),
    db.programTenantSetting.findMany({ where: { tenantId, hidden: true }, select: { programId: true } }),
  ]);
  const hiddenSet = new Set(hidden.map((h) => h.programId));
  const keep = new Set(keepIds);
  return programs
    .filter((p) => keep.has(p.id) || (!p.isArchived && !hiddenSet.has(p.id)))
    .map((p) => ({ id: p.id, name: p.name, discipline: p.discipline, officialKind: p.officialKind }));
}

export type ResultInfo = { matchId: string; date: Date; title: string | null };

/** Rangliste einer Meisterschaft aus den Durchgängen des Vereins berechnen. */
export async function loadRanking(tenantId: string, c: ChampionshipView): Promise<{ ranking: Ranking; categoryErrors: string[]; info: Map<string, ResultInfo>; config: RankingConfig }> {
  const { categories, errors } = parseCategories(c.categoriesText);
  const config: RankingConfig = {
    year: c.year,
    startsOn: c.startsOn,
    endsOn: c.endsOn,
    bestOf: c.bestOf,
    officialOnly: c.officialOnly,
    programs: c.programs.map((p) => ({ programId: p.programId, name: p.name, required: p.required, weight: p.weight, maxCount: p.maxCount })),
    categories,
  };
  const info = new Map<string, ResultInfo>();
  if (config.programs.length === 0) return { ranking: { ranked: [], unclassified: [], categories: [] }, categoryErrors: errors, info, config };

  const from = zurichToUtc(c.startsOn, "00:00");
  const to = zurichToUtc(addDays(c.endsOn, 1), "00:00");
  const parts = await db.matchParticipant.findMany({
    where: {
      userId: { not: null },
      ...(c.officialOnly ? { isOfficial: true } : {}),
      match: { tenantId, status: "FINISHED", programId: { in: config.programs.map((p) => p.programId) }, date: { gte: from, lt: to } },
    },
    select: {
      id: true, userId: true, total: true, isOfficial: true,
      match: { select: { id: true, date: true, programId: true, title: true, status: true } },
      results: { select: { total: true } },
    },
    take: 50_000,
  });

  const userIds = [...new Set(parts.map((p) => p.userId).filter((u): u is string => !!u))];
  const memberships = userIds.length
    ? await db.membership.findMany({
        where: { tenantId, userId: { in: userIds }, user: { deletedAt: null } },
        select: { userId: true, user: { select: { name: true, birthDate: true } } },
      })
    : [];
  const members: RankingMember[] = memberships.map((m) => ({ userId: m.userId, name: m.user.name, birthYear: m.user.birthDate ? m.user.birthDate.getUTCFullYear() : null }));

  const results: RankingResult[] = [];
  for (const p of parts) {
    if (!p.userId) continue;
    info.set(p.id, { matchId: p.match.id, date: p.match.date, title: p.match.title });
    results.push({
      participantId: p.id,
      userId: p.userId,
      programId: p.match.programId,
      matchId: p.match.id,
      day: zurichParts(p.match.date).dateStr,
      finished: p.match.status === "FINISHED",
      isOfficial: p.isOfficial,
      total: p.total,
      stageTotals: p.results.map((r) => r.total),
    });
  }
  return { ranking: computeRanking(config, members, results), categoryErrors: errors, info, config };
}

/** Jahre mit Meisterschaften (für die Übersicht früherer Jahre). */
export async function championshipYears(tenantId: string, includeUnpublished: boolean) {
  const rows = await db.championship.findMany({
    where: { tenantId, ...(includeUnpublished ? {} : { isPublished: true }) },
    distinct: ["year"],
    select: { year: true },
    orderBy: { year: "desc" },
  });
  return rows.map((r) => r.year);
}

/** Aktueller Zeitpunkt (ausserhalb des Renderns aufgerufen, für Druckdatum). */
export function nowDate() {
  return new Date();
}
