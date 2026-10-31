/**
 * Demo-Jahresmeisterschaft und Live-Rangliste für den Seed (prisma/seed.ts).
 * Nur relative Imports und kein "server-only". Idempotent: legt nur etwas an, wenn der Verein
 * noch keine Meisterschaft bzw. keine Live-Rangliste hat.
 */
import { randomBytes } from "node:crypto";
import type { PrismaClient } from "../../generated/prisma/client";

type Db = Pick<PrismaClient, "championship" | "liveBoard" | "program" | "match" | "matchParticipant" | "matchResult" | "user">;

const DAY = 86_400_000;

/** Serien eines Programms (nur Schusszahl und Höchstwert) aus stagesJson, robust gegen kaputte Daten. */
function seedStages(stagesJson: string): Array<{ shots: number; max: number }> {
  let raw: unknown;
  try {
    raw = JSON.parse(stagesJson);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  return raw.map((s: unknown) => {
    const o = (s && typeof s === "object" ? s : {}) as { shots?: unknown; maxPerShot?: unknown };
    const shots = Math.max(1, Math.floor(Number(o.shots) || 1));
    const max = Math.max(1, Math.floor(Number(o.maxPerShot) || 10));
    return { shots, max };
  });
}

/**
 * Verteilt ein gewünschtes Total gleichmässig auf alle Schüsse aller Serien (ganzzahlig, je Schuss
 * höchstens maxPerShot). Ist das Total grösser als möglich, wird es auf das Maximum begrenzt.
 * Liefert die Schüsse pro Serie; die Summe aller Schüsse ist das tatsächliche Total.
 */
export function distributeSeedShots(stages: Array<{ shots: number; max: number }>, target: number): number[][] {
  const flat: Array<{ stage: number; max: number; v: number }> = [];
  stages.forEach((s, i) => {
    for (let k = 0; k < s.shots; k++) flat.push({ stage: i, max: s.max, v: 0 });
  });
  let rest = Math.max(0, Math.round(target));
  // Runde für Runde je +1 auf Schüsse mit Reserve, bis das Total verteilt ist.
  while (rest > 0) {
    let progressed = false;
    for (const f of flat) {
      if (rest === 0) break;
      if (f.v < f.max) {
        f.v += 1;
        rest -= 1;
        progressed = true;
      }
    }
    if (!progressed) break;
  }
  return stages.map((_, i) => flat.filter((f) => f.stage === i).map((f) => f.v));
}

export async function seedDemoChampionship(db: Db, tenantId: string, userIds: string[]) {
  const year = new Date().getUTCFullYear();
  let createdChampionship = false;
  let createdBoard = false;

  if ((await db.championship.count({ where: { tenantId } })) === 0) {
    const programs = await db.program.findMany({
      // Ohne Zonenwertung: Die Demo-Schüsse unten sind ganzzahlige Ringe bzw. Treffer.
      where: { OR: [{ tenantId: null }, { tenantId }], isArchived: false, officialKind: null, scoringMode: { not: "ZONES" } },
      select: { id: true, name: true, stagesJson: true, scoringMode: true },
      orderBy: [{ tenantId: "desc" }, { name: "asc" }],
      take: 2,
    });
    if (programs.length) {
      await db.championship.create({
        data: {
          tenantId,
          name: `Jahresmeisterschaft ${year}`,
          year,
          startsOn: new Date(Date.UTC(year, 0, 1)),
          endsOn: new Date(Date.UTC(year, 11, 31)),
          bestOf: 3,
          officialOnly: false,
          categoriesText: "Junioren;;20;0\nElite;21;59;0\nVeteranen;60;69;2\nSeniorveteranen;70;;4",
          rulesText: "Pro Programm zählen die drei besten Resultate. Das erste Programm ist Pflicht.\nRangverkündigung an der Generalversammlung.",
          isPublished: true,
          programs: { create: programs.map((p, i) => ({ programId: p.id, required: i === 0, weight: 1, maxCount: null })) },
        },
      });
      createdChampionship = true;

      // Ein paar abgeschlossene Durchgänge, damit die Rangliste etwas zeigt (nur wenn noch keine existieren).
      const existing = await db.match.count({ where: { tenantId, status: "FINISHED", programId: { in: programs.map((p) => p.id) } } });
      const users = userIds.slice(0, 4);
      if (existing === 0 && users.length) {
        const now = Date.now();
        const yearStart = Date.UTC(year, 0, 1);
        const scores = [[92, 88, 95, 81], [85, 90, 79, 93], [88, 76, 91, 84]];
        for (const [pi, p] of programs.entries()) {
          const stages = seedStages(p.stagesJson);
          for (let round = 0; round < 3; round++) {
            const at = new Date(Math.max(yearStart + DAY, now - (60 - round * 20 - pi * 3) * DAY));
            const match = await db.match.create({
              data: { tenantId, programId: p.id, createdById: users[0], title: `Training ${round + 1}`, date: at, status: "FINISHED", finishedAt: at },
            });
            for (const [ui, userId] of users.entries()) {
              const target = scores[round]![ui % 4]! - pi * 5;
              // Echte Serien (MatchResult) anlegen, damit ein erneutes Öffnen/Abschliessen das Total
              // aus den Schüssen neu berechnet statt es zu löschen (recomputeMatchTotals).
              const perStage = distributeSeedShots(stages, target);
              const stageTotals = perStage.map((shots) => shots.reduce((a, b) => a + b, 0));
              const total = stages.length ? stageTotals.reduce((a, b) => a + b, 0) : target;
              const zeros = perStage.reduce((n, shots) => n + shots.filter((v) => v === 0).length, 0);
              const participant = await db.matchParticipant.create({ data: { matchId: match.id, userId, sortOrder: ui, total, zeros } });
              for (const [stageIndex, shots] of perStage.entries()) {
                await db.matchResult.create({
                  data: { participantId: participant.id, stageIndex, shotsJson: JSON.stringify(shots), total: stageTotals[stageIndex]! },
                });
              }
            }
          }
        }
      }
    }
  }

  if ((await db.liveBoard.count({ where: { tenantId } })) === 0) {
    const today = new Date();
    await db.liveBoard.create({
      data: {
        tenantId,
        token: randomBytes(32).toString("base64url"),
        title: "Live-Rangliste Training",
        // null = immer «heute» (Schweizer Tag, siehe buildSnapshot), damit die Demo-Tafel nicht an den Seed-Tag gebunden ist.
        date: null,
        showDecimals: false,
        expiresAt: new Date(today.getTime() + 7 * DAY),
      },
    });
    createdBoard = true;
  }

  return { createdChampionship, createdBoard };
}
