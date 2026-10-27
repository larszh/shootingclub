import "server-only";
import { db } from "@/lib/db";
import type { AppContext } from "@/lib/tenant";
import { safeJson } from "@/lib/utils";
import { parseStages, programTotals, type Stage } from "./types";
import { assignRanks, compareEntries, countTopShots, periodRange, round1, weekStreaks, type Period, type RankedEntry } from "./analytics";

type Ctx = AppContext & { tenant: NonNullable<AppContext["tenant"]> };

function avatarUrlOf(u: { id: string; avatarPath: string | null; updatedAt: Date } | null | undefined) {
  return u?.avatarPath ? `/api/avatars/user/${u.id}?v=${u.updatedAt.getTime()}` : null;
}

type ResultRow = { stageIndex: number; shotsJson: string; total: number };

/** Kennzahlen eines Teilnehmers aus seinen Serien. */
function summarize(results: ResultRow[], stages: Stage[], scoringMode: string) {
  const byIdx = new Map(results.map((r) => [r.stageIndex, r]));
  const shotsPerStage = stages.map((_, i) => safeJson<number[]>(byIdx.get(i)?.shotsJson, []));
  const total = round1(results.reduce((a, r) => a + r.total, 0));
  const shots = shotsPerStage.reduce((a, s) => a + s.length, 0);
  const last = stages.length ? byIdx.get(stages.length - 1)?.total ?? 0 : 0;
  return {
    total,
    shots,
    shotsPerStage,
    stageTotals: stages.map((_, i) => round1(byIdx.get(i)?.total ?? 0)),
    topShots: countTopShots(shotsPerStage, stages, scoringMode),
    lastStage: round1(last),
    stagesDone: results.length,
  };
}

/** Ein Durchgang gilt als vollständig, wenn er abgeschlossen ist oder alle Serien erfasst sind. */
function isComplete(status: string, stagesDone: number, stageCount: number) {
  return status === "FINISHED" || (stageCount > 0 && stagesDone >= stageCount);
}

/** Programm laden, sofern im aktiven Tenant sichtbar (global oder eigenes). */
async function visibleProgram(ctx: Ctx, programId: string) {
  const p = await db.program.findUnique({ where: { id: programId } });
  if (!p || (p.tenantId && p.tenantId !== ctx.tenant.id)) return null;
  const stages = parseStages(p.stagesJson);
  return { id: p.id, name: p.name, scoringMode: p.scoringMode, stages, totals: programTotals(stages) };
}

// ---------------------------------------------------------------------------
// Rangliste
// ---------------------------------------------------------------------------

export type LeaderboardEntry = RankedEntry & {
  rank: number;
  key: string;
  userId: string | null;
  name: string;
  avatarUrl: string | null;
  matchId: string;
  attempts: number;
  isMe: boolean;
};

/**
 * Rangliste eines Programms im aktiven Tenant: bestes Resultat pro Mitglied aus
 * ABGESCHLOSSENEN Durchgängen. Gäste werden separat geführt. Alle Mitglieder dürfen sie sehen.
 */
export async function getLeaderboard(ctx: Ctx, programId: string, period: Period) {
  const program = await visibleProgram(ctx, programId);
  if (!program) return null;
  const range = periodRange(period, new Date());
  const parts = await db.matchParticipant.findMany({
    where: {
      match: { tenantId: ctx.tenant.id, programId, status: "FINISHED", ...(range.from ? { date: { gte: range.from } } : {}) },
      results: { some: {} },
    },
    include: {
      results: { select: { stageIndex: true, shotsJson: true, total: true } },
      user: { select: { id: true, name: true, avatarPath: true, updatedAt: true } },
      match: { select: { id: true, date: true } },
    },
    take: 5000,
  });

  const best = new Map<string, LeaderboardEntry>();
  const guests: LeaderboardEntry[] = [];
  for (const p of parts) {
    const s = summarize(p.results, program.stages, program.scoringMode);
    const entry: LeaderboardEntry = {
      rank: 0,
      key: p.userId ?? `guest:${p.id}`,
      userId: p.userId,
      name: p.user?.name ?? p.guestName ?? "Gast",
      avatarUrl: avatarUrlOf(p.user),
      matchId: p.match.id,
      attempts: 1,
      isMe: p.userId === ctx.user.id,
      total: s.total,
      topShots: s.topShots,
      lastStage: s.lastStage,
      date: p.match.date,
    };
    if (!p.userId) {
      guests.push(entry);
      continue;
    }
    const cur = best.get(p.userId);
    if (!cur) best.set(p.userId, entry);
    else {
      const attempts = cur.attempts + 1;
      if (compareEntries(entry, cur) < 0) best.set(p.userId, { ...entry, attempts });
      else cur.attempts = attempts;
    }
  }
  const entries = assignRanks([...best.values()].sort(compareEntries));
  const guestEntries = assignRanks(guests.sort(compareEntries)).slice(0, 10);
  return {
    program: { id: program.id, name: program.name, scoringMode: program.scoringMode, max: program.totals.max },
    decimal: program.scoringMode === "RINGS_DECIMAL",
    showTopShots: program.scoringMode !== "HITS",
    topShotsLabel: program.stages.every((st) => st.maxPerShot === 10) ? "Zehner" : "Höchstwerte",
    period,
    periodLabel: range.label,
    entries,
    guests: guestEntries,
    me: entries.find((e) => e.isMe) ?? null,
  };
}
export type Leaderboard = NonNullable<Awaited<ReturnType<typeof getLeaderboard>>>;

// ---------------------------------------------------------------------------
// Persönlicher Verlauf pro Programm
// ---------------------------------------------------------------------------

export type ProgressPoint = { matchId: string; date: Date; total: number; isBest: boolean };

export async function getProgramProgress(ctx: Ctx, programId: string, userId = ctx.user.id) {
  const program = await visibleProgram(ctx, programId);
  if (!program) return null;
  const parts = await db.matchParticipant.findMany({
    where: { userId, match: { tenantId: ctx.tenant.id, programId }, results: { some: {} } },
    include: { results: { select: { stageIndex: true, shotsJson: true, total: true } }, match: { select: { id: true, date: true, status: true } } },
    orderBy: { match: { date: "asc" } },
    take: 500,
  });
  const rows = parts
    .map((p) => ({ p, s: summarize(p.results, program.stages, program.scoringMode) }))
    .filter(({ p, s }) => isComplete(p.match.status, s.stagesDone, program.stages.length));
  const totals = rows.map((r) => r.s.total);
  const best = totals.length ? Math.max(...totals) : 0;
  const bestRow = rows.find((r) => r.s.total === best);
  const points: ProgressPoint[] = rows.map(({ p, s }) => ({ matchId: p.match.id, date: p.match.date, total: s.total, isBest: p.match.id === bestRow?.p.match.id }));
  const shots = rows.reduce((a, r) => a + r.s.shots, 0);
  return {
    program: { id: program.id, name: program.name, scoringMode: program.scoringMode, max: program.totals.max, shotsPerMatch: program.totals.shots },
    decimal: program.scoringMode === "RINGS_DECIMAL",
    points,
    count: points.length,
    best,
    bestDate: bestRow?.p.match.date ?? null,
    bestMatchId: bestRow?.p.match.id ?? null,
    avg: totals.length ? round1(totals.reduce((a, b) => a + b, 0) / totals.length) : 0,
    last: totals.length ? totals[totals.length - 1]! : 0,
    avgPerShot: shots ? Math.round((totals.reduce((a, b) => a + b, 0) / shots) * 100) / 100 : 0,
  };
}
export type ProgramProgress = NonNullable<Awaited<ReturnType<typeof getProgramProgress>>>;

// ---------------------------------------------------------------------------
// Persönliche Gesamtstatistik
// ---------------------------------------------------------------------------

export type ProgramStat = {
  programId: string;
  name: string;
  scoringMode: string;
  decimal: boolean;
  max: number;
  count: number;
  best: number;
  bestDate: Date | null;
  bestMatchId: string | null;
  avg: number;
  last: number;
  lastDate: Date | null;
  avgPerShot: number;
  shots: number;
};

export type DistanceStat = { distanceM: number; shots: number; ringShots: number; ringAvg: number | null; hitShots: number; hitRate: number | null };

export async function getUserScoreStats(ctx: Ctx) {
  const now = new Date();
  const parts = await db.matchParticipant.findMany({
    where: { userId: ctx.user.id, match: { tenantId: ctx.tenant.id }, results: { some: {} } },
    include: {
      results: { select: { stageIndex: true, shotsJson: true, total: true } },
      match: { select: { id: true, date: true, status: true, program: { select: { id: true, name: true, stagesJson: true, scoringMode: true } } } },
    },
    orderBy: { match: { date: "asc" } },
    take: 3000,
  });

  const stagesCache = new Map<string, Stage[]>();
  const byProgram = new Map<string, ProgramStat & { sum: number; sumShots: number }>();
  const byDistance = new Map<number, { shots: number; ringShots: number; ringSum: number; hitShots: number; hits: number }>();
  let totalShots = 0;

  for (const p of parts) {
    const prog = p.match.program;
    let stages = stagesCache.get(prog.id);
    if (!stages) {
      stages = parseStages(prog.stagesJson);
      stagesCache.set(prog.id, stages);
    }
    const s = summarize(p.results, stages, prog.scoringMode);
    totalShots += s.shots;

    // Verteilung nach Distanz (alle erfassten Schüsse)
    s.shotsPerStage.forEach((shots, i) => {
      const dist = stages[i]?.distanceM;
      if (dist === undefined || shots.length === 0) return;
      const d = byDistance.get(dist) ?? { shots: 0, ringShots: 0, ringSum: 0, hitShots: 0, hits: 0 };
      d.shots += shots.length;
      if (prog.scoringMode === "HITS") {
        d.hitShots += shots.length;
        d.hits += shots.filter((x) => x >= 1).length;
      } else {
        d.ringShots += shots.length;
        d.ringSum += shots.reduce((a, b) => a + b, 0);
      }
      byDistance.set(dist, d);
    });

    if (!isComplete(p.match.status, s.stagesDone, stages.length)) continue;
    const cur = byProgram.get(prog.id);
    if (!cur) {
      byProgram.set(prog.id, {
        programId: prog.id,
        name: prog.name,
        scoringMode: prog.scoringMode,
        decimal: prog.scoringMode === "RINGS_DECIMAL",
        max: programTotals(stages).max,
        count: 1,
        best: s.total,
        bestDate: p.match.date,
        bestMatchId: p.match.id,
        avg: s.total,
        last: s.total,
        lastDate: p.match.date,
        avgPerShot: 0,
        shots: s.shots,
        sum: s.total,
        sumShots: s.shots,
      });
    } else {
      cur.count += 1;
      cur.sum += s.total;
      cur.sumShots += s.shots;
      cur.shots += s.shots;
      if (s.total > cur.best) {
        cur.best = s.total;
        cur.bestDate = p.match.date;
        cur.bestMatchId = p.match.id;
      }
      cur.last = s.total;
      cur.lastDate = p.match.date;
    }
  }

  const programs: ProgramStat[] = [...byProgram.values()]
    .map(({ sum, sumShots, ...rest }) => ({ ...rest, avg: round1(sum / rest.count), avgPerShot: sumShots ? Math.round((sum / sumShots) * 100) / 100 : 0 }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "de-CH"));

  const distances: DistanceStat[] = [...byDistance.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([distanceM, d]) => ({
      distanceM,
      shots: d.shots,
      ringShots: d.ringShots,
      ringAvg: d.ringShots ? Math.round((d.ringSum / d.ringShots) * 100) / 100 : null,
      hitShots: d.hitShots,
      hitRate: d.hitShots ? Math.round((d.hits / d.hitShots) * 100) : null,
    }));

  const records = programs
    .filter((p) => p.bestDate)
    .map((p) => ({ programId: p.programId, name: p.name, best: p.best, max: p.max, decimal: p.decimal, date: p.bestDate!, matchId: p.bestMatchId! }))
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  const yearStart = periodRange("year", now).from!;
  return {
    matches: parts.length,
    matchesThisYear: parts.filter((p) => p.match.date >= yearStart).length,
    totalShots,
    programs,
    records,
    distances,
    streak: weekStreaks(parts.map((p) => p.match.date), now),
    lastDate: parts.length ? parts[parts.length - 1]!.match.date : null,
  };
}
export type UserScoreStats = Awaited<ReturnType<typeof getUserScoreStats>>;

// ---------------------------------------------------------------------------
// Nutzung der Programme
// ---------------------------------------------------------------------------

/** Anzahl Durchgänge pro Programm im Tenant. */
export async function programUsageCounts(tenantId: string): Promise<Record<string, number>> {
  const rows = await db.match.groupBy({ by: ["programId"], where: { tenantId }, _count: { _all: true } });
  return Object.fromEntries(rows.map((r) => [r.programId, r._count._all]));
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export type ExportFilter = { tenantId: string; userId?: string; from?: Date; to?: Date };

/** Zeilen für den CSV-Export (bereits nach Tenant und optional Benutzer/Zeitraum gefiltert). */
export async function scoreExportRows(filter: ExportFilter) {
  const parts = await db.matchParticipant.findMany({
    where: {
      ...(filter.userId ? { userId: filter.userId } : {}),
      match: {
        tenantId: filter.tenantId,
        ...(filter.from || filter.to ? { date: { ...(filter.from ? { gte: filter.from } : {}), ...(filter.to ? { lt: filter.to } : {}) } } : {}),
      },
    },
    include: {
      results: { select: { stageIndex: true, shotsJson: true, total: true } },
      user: { select: { name: true } },
      match: { select: { id: true, date: true, title: true, status: true, program: { select: { id: true, name: true, stagesJson: true, scoringMode: true } } } },
    },
    orderBy: [{ match: { date: "asc" } }, { sortOrder: "asc" }],
    take: 20000,
  });
  const stagesCache = new Map<string, Stage[]>();
  return parts.map((p) => {
    const prog = p.match.program;
    let stages = stagesCache.get(prog.id);
    if (!stages) {
      stages = parseStages(prog.stagesJson);
      stagesCache.set(prog.id, stages);
    }
    const s = summarize(p.results, stages, prog.scoringMode);
    return {
      date: p.match.date,
      program: prog.name,
      title: p.match.title,
      status: p.match.status,
      participant: p.user?.name ?? p.guestName ?? "Gast",
      isGuest: !p.userId,
      stageTotals: s.stageTotals,
      total: s.total,
      max: programTotals(stages).max,
      decimal: prog.scoringMode === "RINGS_DECIMAL",
    };
  });
}
