/**
 * Demo-Jahresmeisterschaft und Live-Rangliste für den Seed (prisma/seed.ts).
 * Nur relative Imports und kein "server-only". Idempotent: legt nur etwas an, wenn der Verein
 * noch keine Meisterschaft bzw. keine Live-Rangliste hat.
 */
import { randomBytes } from "node:crypto";
import type { PrismaClient } from "../../generated/prisma/client";

type Db = Pick<PrismaClient, "championship" | "liveBoard" | "program" | "match" | "matchParticipant" | "user">;

const DAY = 86_400_000;

export async function seedDemoChampionship(db: Db, tenantId: string, userIds: string[]) {
  const year = new Date().getUTCFullYear();
  let createdChampionship = false;
  let createdBoard = false;

  if ((await db.championship.count({ where: { tenantId } })) === 0) {
    const programs = await db.program.findMany({
      where: { OR: [{ tenantId: null }, { tenantId }], isArchived: false, officialKind: null },
      select: { id: true, name: true },
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
          for (let round = 0; round < 3; round++) {
            const at = new Date(Math.max(yearStart + DAY, now - (60 - round * 20 - pi * 3) * DAY));
            const match = await db.match.create({
              data: { tenantId, programId: p.id, createdById: users[0], title: `Training ${round + 1}`, date: at, status: "FINISHED", finishedAt: at },
            });
            for (const [ui, userId] of users.entries()) {
              const total = scores[round]![ui % 4]! - pi * 5;
              await db.matchParticipant.create({ data: { matchId: match.id, userId, sortOrder: ui, total, zeros: 0 } });
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
        date: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())),
        showDecimals: false,
        expiresAt: new Date(today.getTime() + 7 * DAY),
      },
    });
    createdBoard = true;
  }

  return { createdChampionship, createdBoard };
}
