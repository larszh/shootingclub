import "server-only";
import { db } from "@/lib/db";
import { addDays, formatDateZurich, todayZurich, zurichToUtc } from "@/lib/time";
import { normalizeHex } from "@/lib/brand";
import { safeJson } from "@/lib/utils";
import { firedShots, parseStages, programTotals } from "@/modules/scores/types";
import { guestDisplayName, isExpired, isPlausibleToken, rankLiveRows, shortNames, type LiveRow, type LiveSnapshot, type LiveTickerItem } from "./logic";

export type PublicBoard = {
  id: string;
  tenantId: string;
  token: string;
  title: string;
  programId: string | null;
  eventId: string | null;
  /** "YYYY-MM-DD" oder null (= heute) */
  day: string | null;
  showDecimals: boolean;
  expiresAt: Date | null;
  clubName: string;
  brandColor: string | null;
  hasLogo: boolean;
  logoPath: string | null;
  logoVersion: number;
};

/**
 * Tafel zu einem Token. null, wenn der Token unbekannt ist oder der Verein gelöscht wurde.
 * Abgelaufene Tafeln werden geliefert (für eine freundliche Meldung), siehe isExpired.
 */
export async function findBoardByToken(token: string | null | undefined): Promise<PublicBoard | null> {
  if (!isPlausibleToken(token)) return null;
  const b = await db.liveBoard.findUnique({
    where: { token },
    select: {
      id: true, tenantId: true, token: true, title: true, programId: true, eventId: true, date: true, showDecimals: true, expiresAt: true,
      tenant: { select: { name: true, brandColor: true, logoPath: true, deletedAt: true, updatedAt: true } },
    },
  });
  if (!b || b.token !== token || b.tenant.deletedAt) return null;
  return {
    id: b.id,
    tenantId: b.tenantId,
    token: b.token,
    title: b.title,
    programId: b.programId,
    eventId: b.eventId,
    day: b.date ? b.date.toISOString().slice(0, 10) : null,
    showDecimals: b.showDecimals,
    expiresAt: b.expiresAt,
    clubName: b.tenant.name,
    brandColor: normalizeHex(b.tenant.brandColor),
    hasLogo: !!b.tenant.logoPath,
    logoPath: b.tenant.logoPath,
    logoVersion: b.tenant.updatedAt.getTime(),
  };
}

export function boardExpired(b: Pick<PublicBoard, "expiresAt">, now = new Date()) {
  return isExpired(b.expiresAt, now);
}

const TICKER_SIZE = 8;
const MAX_PARTICIPANTS = 400;

/** Aktueller Stand einer Tafel: abgeschlossene und laufende Teilnahmen des Tages (Programm/Anlass optional). */
export async function buildSnapshot(b: PublicBoard, now = new Date()): Promise<LiveSnapshot> {
  const day = b.day ?? todayZurich();
  const from = zurichToUtc(day, "00:00");
  const to = zurichToUtc(addDays(day, 1), "00:00");

  const [parts, program, event] = await Promise.all([
    db.matchParticipant.findMany({
      where: {
        match: {
          tenantId: b.tenantId,
          date: { gte: from, lt: to },
          ...(b.programId ? { programId: b.programId } : {}),
          ...(b.eventId ? { eventId: b.eventId } : {}),
        },
      },
      select: {
        id: true, userId: true, guestName: true, total: true,
        user: { select: { name: true, deletedAt: true } },
        match: { select: { status: true, program: { select: { id: true, name: true, stagesJson: true, scoringMode: true } } } },
        results: { select: { stageIndex: true, total: true, shotsJson: true, updatedAt: true } },
      },
      orderBy: { id: "asc" },
      take: MAX_PARTICIPANTS,
    }),
    b.programId ? db.program.findFirst({ where: { id: b.programId, OR: [{ tenantId: null }, { tenantId: b.tenantId }] }, select: { name: true } }) : null,
    b.eventId ? db.event.findFirst({ where: { id: b.eventId, tenantId: b.tenantId }, select: { title: true } }) : null,
  ]);

  // Namen: Mitglieder als «Vorname N.» (gleiche Kürzel unterschieden), Gäste wie erfasst.
  const memberParts = parts.filter((p) => p.userId && p.user && !p.user.deletedAt);
  const memberNames = shortNames(memberParts.map((p) => p.user!.name));
  const nameOf = new Map<string, string>();
  memberParts.forEach((p, i) => nameOf.set(p.id, memberNames[i]!));

  const stagesCache = new Map<string, ReturnType<typeof parseStages>>();
  const stagesOf = (programId: string, json: string) => {
    let s = stagesCache.get(programId);
    if (!s) {
      s = parseStages(json);
      stagesCache.set(programId, s);
    }
    return s;
  };

  const rows: Array<Omit<LiveRow, "rank">> = [];
  const tickerSource: Array<LiveTickerItem & { t: number }> = [];
  for (const p of parts) {
    const finished = p.match.status === "FINISHED";
    if (!finished && p.results.length === 0) continue;
    const prog = p.match.program;
    const stages = stagesOf(prog.id, prog.stagesJson);
    const isGuest = !p.userId;
    const name = isGuest ? guestDisplayName(p.guestName) : (nameOf.get(p.id) ?? "Schütze/in");
    let shots = 0;
    let sum = 0;
    for (const r of p.results) {
      sum += r.total;
      const list = safeJson<unknown>(r.shotsJson, []);
      const nums = Array.isArray(list) ? list.filter((x): x is number => typeof x === "number") : [];
      const stage = stages[r.stageIndex];
      shots += stage ? firedShots(stage, nums, prog.scoringMode) : nums.length;
      if (nums.length) {
        tickerSource.push({
          id: `${p.id}:${r.stageIndex}:${nums.length}`,
          name,
          stage: stage?.name ?? `Serie ${r.stageIndex + 1}`,
          value: nums[nums.length - 1]!,
          at: r.updatedAt.toISOString(),
          t: r.updatedAt.getTime(),
        });
      }
    }
    const total = finished && typeof p.total === "number" ? p.total : Math.round(sum * 10) / 10;
    rows.push({
      id: p.id,
      name,
      isGuest,
      total,
      shots,
      maxShots: programTotals(stages, prog.scoringMode).shots,
      finished,
      program: b.programId ? null : prog.name,
    });
  }

  const ticker = tickerSource
    .sort((a, b2) => b2.t - a.t)
    .slice(0, TICKER_SIZE)
    .map((x) => ({ id: x.id, name: x.name, stage: x.stage, value: x.value, at: x.at }));

  const subtitle = [program?.name, event?.title, formatDateZurich(from, { weekday: "long", day: "numeric", month: "long", year: "numeric" })].filter(Boolean).join(" · ");
  return {
    title: b.title,
    clubName: b.clubName,
    subtitle,
    showDecimals: b.showDecimals,
    rows: rankLiveRows(rows),
    ticker,
    updatedAt: now.toISOString(),
    expiresAt: b.expiresAt ? b.expiresAt.toISOString() : null,
  };
}

/** Antwort-Header für alle öffentlichen Live-Antworten: nie cachen, nicht indexieren. */
export const LIVE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
} as const;
