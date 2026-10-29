import "server-only";
import { db } from "@/lib/db";
import { zurichToUtc } from "@/lib/time";
import { autoAttempt, swissYear } from "./official";
import { firedShots, parseStages, type Stage } from "./types";
import { safeJson } from "@/lib/utils";

/**
 * Serverseitige Hilfen für amtliche Resultate (Versuchsnummer, Vollständigkeit, Namen der Bestätigenden).
 * Alle Abfragen sind auf den Tenant beschränkt.
 */

function yearBounds(year: number) {
  return { from: zurichToUtc(`${year}-01-01`, "00:00"), to: zurichToUtc(`${year + 1}-01-01`, "00:00") };
}

/** Vorschlag für die Versuchsnummer eines Teilnehmers (frühere amtliche Teilnahmen im selben Programm und Jahr + 1). */
export async function suggestAttempt(tenantId: string, p: { id: string; userId: string | null; match: { date: Date; createdAt: Date; programId: string } }): Promise<number> {
  if (!p.userId) return 1;
  const { from, to } = yearBounds(swissYear(p.match.date));
  const others = await db.matchParticipant.findMany({
    where: { userId: p.userId, isOfficial: true, id: { not: p.id }, match: { tenantId, programId: p.match.programId, date: { gte: from, lt: to } } },
    select: { id: true, match: { select: { date: true, createdAt: true } } },
    take: 200,
  });
  return autoAttempt({ id: p.id, date: p.match.date, createdAt: p.match.createdAt }, others.map((o) => ({ id: o.id, date: o.match.date, createdAt: o.match.createdAt })));
}

/** Sind alle Schüsse aller Serien erfasst? */
export function isComplete(stages: Stage[], mode: string, results: Array<{ stageIndex: number; shots: number[] }>): boolean {
  return stages.every((st, i) => firedShots(st, results.find((r) => r.stageIndex === i)?.shots ?? [], mode) >= st.shots);
}

export type OfficialParticipantInfo = {
  suggestedAttempt: number;
  complete: boolean;
  verifiedByName: string | null;
};

/** Zusatzangaben pro Teilnehmer für die Bestätigung auf der Durchgangsseite. */
export async function officialInfoForMatch(tenantId: string, matchId: string): Promise<Record<string, OfficialParticipantInfo>> {
  const m = await db.match.findFirst({
    where: { id: matchId, tenantId },
    select: {
      id: true, date: true, createdAt: true, programId: true,
      program: { select: { stagesJson: true, scoringMode: true } },
      participants: { select: { id: true, userId: true, verifiedById: true, results: { select: { stageIndex: true, shotsJson: true } } } },
    },
  });
  if (!m) return {};
  const stages = parseStages(m.program.stagesJson);
  const verifierIds = [...new Set(m.participants.map((p) => p.verifiedById).filter((x): x is string => !!x))];
  const verifiers = verifierIds.length ? await db.user.findMany({ where: { id: { in: verifierIds } }, select: { id: true, name: true } }) : [];
  const out: Record<string, OfficialParticipantInfo> = {};
  for (const p of m.participants) {
    const results = p.results.map((r) => ({ stageIndex: r.stageIndex, shots: safeJson<number[]>(r.shotsJson, []) }));
    out[p.id] = {
      suggestedAttempt: await suggestAttempt(tenantId, { id: p.id, userId: p.userId, match: { date: m.date, createdAt: m.createdAt, programId: m.programId } }),
      complete: isComplete(stages, m.program.scoringMode, results),
      verifiedByName: verifiers.find((v) => v.id === p.verifiedById)?.name ?? null,
    };
  }
  return out;
}
