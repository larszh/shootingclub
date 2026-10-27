import "server-only";
import { db } from "@/lib/db";
import type { AppContext } from "@/lib/tenant";
import type { Prisma } from "@/generated/prisma/client";
import { parseStages, programTotals, type Stage } from "./types";

export type ProgramView = {
  id: string;
  name: string;
  description: string | null;
  discipline: string;
  weaponNote: string | null;
  scoringMode: string;
  stages: Stage[];
  totals: ReturnType<typeof programTotals>;
  scope: "global" | "tenant";
  hidden: boolean;
  favorite: boolean;
  isArchived: boolean;
  updatedAt: Date;
};

function toView(
  p: { id: string; name: string; description: string | null; discipline: string; weaponNote: string | null; scoringMode: string; stagesJson: string; tenantId: string | null; isArchived: boolean; updatedAt: Date },
  hidden: boolean,
  favorite: boolean,
): ProgramView {
  const stages = parseStages(p.stagesJson);
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    discipline: p.discipline,
    weaponNote: p.weaponNote,
    scoringMode: p.scoringMode,
    stages,
    totals: programTotals(stages),
    scope: p.tenantId ? "tenant" : "global",
    hidden,
    favorite,
    isArchived: p.isArchived,
    updatedAt: p.updatedAt,
  };
}

/**
 * Programme, die im aktiven Tenant sichtbar sind: globale + tenant-eigene.
 * `includeHidden` zeigt auch versteckte (für Admins).
 */
export async function listPrograms(ctx: AppContext & { tenant: NonNullable<AppContext["tenant"]> }, opts?: { includeHidden?: boolean; includeArchived?: boolean }) {
  const [programs, settings, favorites] = await Promise.all([
    db.program.findMany({
      where: {
        OR: [{ tenantId: null }, { tenantId: ctx.tenant.id }],
        ...(opts?.includeArchived ? {} : { isArchived: false }),
      },
      orderBy: [{ tenantId: "desc" }, { name: "asc" }],
    }),
    db.programTenantSetting.findMany({ where: { tenantId: ctx.tenant.id } }),
    db.programFavorite.findMany({ where: { userId: ctx.user.id } }),
  ]);
  const hiddenSet = new Set(settings.filter((s) => s.hidden).map((s) => s.programId));
  const favSet = new Set(favorites.map((f) => f.programId));
  const views = programs.map((p) => toView(p, hiddenSet.has(p.id), favSet.has(p.id)));
  return opts?.includeHidden ? views : views.filter((v) => !v.hidden);
}

export async function getProgram(ctx: AppContext & { tenant: NonNullable<AppContext["tenant"]> }, id: string) {
  const p = await db.program.findUnique({ where: { id } });
  if (!p) return null;
  if (p.tenantId && p.tenantId !== ctx.tenant.id) return null;
  const [setting, fav] = await Promise.all([
    db.programTenantSetting.findUnique({ where: { programId_tenantId: { programId: id, tenantId: ctx.tenant.id } } }),
    db.programFavorite.findUnique({ where: { userId_programId: { userId: ctx.user.id, programId: id } } }),
  ]);
  return toView(p, setting?.hidden ?? false, !!fav);
}

export async function listGlobalPrograms() {
  const programs = await db.program.findMany({ where: { tenantId: null }, orderBy: { name: "asc" } });
  return programs.map((p) => toView(p, false, false));
}

export type MatchListItem = {
  id: string;
  title: string | null;
  date: Date;
  status: string;
  program: { id: string; name: string; discipline: string; scoringMode: string };
  participants: Array<{ id: string; name: string; isGuest: boolean; total: number; userId: string | null; avatarUrl: string | null }>;
  maxScore: number;
};

export type MatchListOptions = {
  limit?: number;
  programId?: string;
  /** "OPEN" | "FINISHED" */
  status?: string;
  /** Inklusive (>=) */
  from?: Date;
  /** Exklusive (<) */
  to?: Date;
  /** Suche im Namen eines Teilnehmers (Mitglied oder Gast) */
  q?: string;
};

/** Wettkämpfe, die der Benutzer sehen darf (Teilnehmer, Ersteller oder Trainer+). */
export async function listMatches(ctx: AppContext & { tenant: NonNullable<AppContext["tenant"]> }, opts?: MatchListOptions) {
  const viewAll = ctx.can("match.viewAll");
  const q = opts?.q?.trim().slice(0, 60);
  const status = opts?.status === "OPEN" || opts?.status === "FINISHED" ? opts.status : undefined;
  const and: Prisma.MatchWhereInput[] = [];
  if (!viewAll) and.push({ OR: [{ createdById: ctx.user.id }, { participants: { some: { userId: ctx.user.id } } }] });
  if (q) and.push({ participants: { some: { OR: [{ user: { name: { contains: q } } }, { guestName: { contains: q } }] } } });
  const matches = await db.match.findMany({
    where: {
      tenantId: ctx.tenant.id,
      ...(opts?.programId ? { programId: opts.programId } : {}),
      ...(status ? { status } : {}),
      ...(opts?.from || opts?.to ? { date: { ...(opts.from ? { gte: opts.from } : {}), ...(opts.to ? { lt: opts.to } : {}) } } : {}),
      ...(and.length ? { AND: and } : {}),
    },
    include: {
      program: { select: { id: true, name: true, discipline: true, scoringMode: true, stagesJson: true } },
      participants: { include: { user: { select: { id: true, name: true, avatarPath: true, updatedAt: true } }, results: { select: { total: true } } }, orderBy: { sortOrder: "asc" } },
    },
    orderBy: { date: "desc" },
    take: opts?.limit ?? 50,
  });
  return matches.map<MatchListItem>((m) => ({
    id: m.id,
    title: m.title,
    date: m.date,
    status: m.status,
    program: { id: m.program.id, name: m.program.name, discipline: m.program.discipline, scoringMode: m.program.scoringMode },
    maxScore: programTotals(parseStages(m.program.stagesJson)).max,
    participants: m.participants.map((p) => ({
      id: p.id,
      userId: p.userId,
      name: p.user?.name ?? p.guestName ?? "Gast",
      isGuest: !p.userId,
      total: Math.round(p.results.reduce((a, r) => a + r.total, 0) * 10) / 10,
      avatarUrl: p.user?.avatarPath ? `/api/avatars/user/${p.user.id}?v=${p.user.updatedAt.getTime()}` : null,
    })),
  }));
}

export async function getMatch(ctx: AppContext & { tenant: NonNullable<AppContext["tenant"]> }, id: string) {
  const m = await db.match.findUnique({
    where: { id },
    include: {
      program: true,
      createdBy: { select: { id: true, name: true } },
      participants: { include: { user: { select: { id: true, name: true, avatarPath: true, updatedAt: true } }, results: true }, orderBy: { sortOrder: "asc" } },
    },
  });
  if (!m || m.tenantId !== ctx.tenant.id) return null;
  const isParticipant = m.participants.some((p) => p.userId === ctx.user.id);
  const isCreator = m.createdById === ctx.user.id;
  if (!isParticipant && !isCreator && !ctx.can("match.viewAll")) return null;
  const stages = parseStages(m.program.stagesJson);
  return {
    id: m.id,
    clientId: m.clientId,
    title: m.title,
    date: m.date,
    status: m.status,
    locationNote: m.locationNote,
    createdBy: m.createdBy,
    canEdit: isCreator || isParticipant || ctx.can("match.viewAll"),
    canDelete: isCreator || ctx.can("match.delete"),
    program: {
      id: m.program.id,
      name: m.program.name,
      discipline: m.program.discipline,
      scoringMode: m.program.scoringMode,
      stages,
      totals: programTotals(stages),
    },
    participants: m.participants.map((p) => ({
      id: p.id,
      userId: p.userId,
      name: p.user?.name ?? p.guestName ?? "Gast",
      isGuest: !p.userId,
      note: p.note,
      isMe: p.userId === ctx.user.id,
      avatarUrl: p.user?.avatarPath ? `/api/avatars/user/${p.user.id}?v=${p.user.updatedAt.getTime()}` : null,
      results: stages.map((_, idx) => {
        const r = p.results.find((x) => x.stageIndex === idx);
        return { stageIndex: idx, shots: r ? (JSON.parse(r.shotsJson) as number[]) : [], total: r?.total ?? 0 };
      }),
    })),
  };
}
export type MatchView = NonNullable<Awaited<ReturnType<typeof getMatch>>>;

export async function listTenantMembers(tenantId: string) {
  const ms = await db.membership.findMany({
    where: { tenantId },
    include: { user: { select: { id: true, name: true, email: true, avatarPath: true, updatedAt: true } } },
    orderBy: { user: { name: "asc" } },
  });
  return ms.map((m) => ({
    id: m.user.id,
    name: m.user.name,
    email: m.user.email,
    role: m.role,
    avatarUrl: m.user.avatarPath ? `/api/avatars/user/${m.user.id}?v=${m.user.updatedAt.getTime()}` : null,
  }));
}

/** Persönliche Statistik des Benutzers im aktiven Tenant. */
export async function userStats(ctx: AppContext & { tenant: NonNullable<AppContext["tenant"]> }) {
  const parts = await db.matchParticipant.findMany({
    where: { userId: ctx.user.id, match: { tenantId: ctx.tenant.id } },
    include: { results: true, match: { include: { program: { select: { id: true, name: true, stagesJson: true, scoringMode: true } } } } },
    orderBy: { match: { date: "desc" } },
    take: 200,
  });
  const totalShots = parts.reduce((a, p) => a + p.results.reduce((b, r) => b + (JSON.parse(r.shotsJson) as number[]).length, 0), 0);
  const byProgram = new Map<string, { name: string; best: number; count: number; max: number; last: number; decimal: boolean }>();
  for (const p of parts) {
    const total = Math.round(p.results.reduce((a, r) => a + r.total, 0) * 10) / 10;
    const key = p.match.program.id;
    const max = programTotals(parseStages(p.match.program.stagesJson)).max;
    const cur = byProgram.get(key);
    if (cur) {
      cur.best = Math.max(cur.best, total);
      cur.count += 1;
    } else {
      byProgram.set(key, { name: p.match.program.name, best: total, count: 1, max, last: total, decimal: p.match.program.scoringMode === "RINGS_DECIMAL" });
    }
  }
  return { matches: parts.length, totalShots, byProgram: [...byProgram.values()] };
}

/**
 * Prüft, ob der Durchgang für diesen Benutzer eine neue persönliche Bestleistung im
 * Programm ist (im selben Tenant, verglichen mit allen anderen vollständigen Durchgängen).
 * Gibt null zurück, wenn der Benutzer nicht teilnimmt oder noch nichts erfasst ist.
 * Zugriffskontrolle macht der Aufrufer (z.B. über getMatch).
 */
export async function isPersonalBest(matchId: string, userId: string) {
  const m = await db.match.findUnique({
    where: { id: matchId },
    select: { id: true, tenantId: true, programId: true, participants: { where: { userId }, select: { results: { select: { total: true } } } } },
  });
  const mine = m?.participants[0];
  if (!m || !mine || mine.results.length === 0) return null;
  const total = Math.round(mine.results.reduce((a, r) => a + r.total, 0) * 10) / 10;
  const program = await db.program.findUnique({ where: { id: m.programId }, select: { stagesJson: true } });
  const stageCount = parseStages(program?.stagesJson ?? "[]").length;
  const others = await db.matchParticipant.findMany({
    where: { userId, matchId: { not: m.id }, match: { tenantId: m.tenantId, programId: m.programId }, results: { some: {} } },
    select: { results: { select: { total: true } }, match: { select: { status: true } } },
    take: 2000,
  });
  const previous = others
    .filter((o) => o.match.status === "FINISHED" || (stageCount > 0 && o.results.length >= stageCount))
    .map((o) => Math.round(o.results.reduce((a, r) => a + r.total, 0) * 10) / 10);
  const previousBest = previous.length ? Math.max(...previous) : null;
  return {
    total,
    previousBest,
    /** Erster vollständiger Durchgang in diesem Programm */
    isFirst: previous.length === 0,
    /** Echt besser als alle anderen (nicht beim ersten Mal) */
    isBest: previousBest !== null && total > previousBest,
  };
}
