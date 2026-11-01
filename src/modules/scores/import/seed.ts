/**
 * Demo-Daten für den Resultat-Import (prisma/seed.ts): ein bereits importierter Meyton-Export
 * mit Durchgang, damit der Importverlauf nicht leer ist. Nur relative Imports, kein "server-only".
 * Idempotent über ScoreImport (tenantId, fileHash).
 */
import { createHash } from "node:crypto";
import type { PrismaClient } from "../../../generated/prisma/client";

type Db = Pick<PrismaClient, "scoreImport" | "program" | "match">;

const DEMO_FILE = "demo-meyton-export.csv";
const DEMO_GUEST = "Gast Reto Schmid";
const DAY = 86_400_000;

function demoStages(stagesJson: string): Array<{ shots: number; max: number }> {
  try {
    const raw: unknown = JSON.parse(stagesJson);
    if (!Array.isArray(raw)) return [];
    return raw.map((s: unknown) => {
      const o = (s && typeof s === "object" ? s : {}) as { shots?: unknown; maxPerShot?: unknown };
      return { shots: Math.min(60, Math.max(1, Math.floor(Number(o.shots) || 1))), max: Math.max(1, Math.floor(Number(o.maxPerShot) || 10)) };
    });
  } catch {
    return [];
  }
}

/** Deterministische Schüsse: meist hohe Werte, je Schütze etwas anders. */
function demoShots(shots: number, max: number, seed: number): number[] {
  return Array.from({ length: shots }, (_, k) => Math.max(0, max - ((seed * 5 + k * 7) % 4)));
}

export async function seedDemoScoreImport(db: Db, tenantId: string, userIds: string[]): Promise<void> {
  const fileHash = createHash("sha256").update(`standchef-demo-score-import:${DEMO_FILE}`).digest("hex");
  const existing = await db.scoreImport.findUnique({ where: { tenantId_fileHash: { tenantId, fileHash } } });
  if (existing) return;

  const program = await db.program.findFirst({ where: { tenantId: null, isArchived: false, scoringMode: "RINGS_INT", officialKind: null }, orderBy: { name: "asc" } });
  if (!program) return;
  const stages = demoStages(program.stagesJson);
  if (!stages.length) return;

  const people: Array<{ userId: string | null; guestName: string | null; startNo: number }> = [
    ...userIds.slice(0, 3).map((id, i) => ({ userId: id, guestName: null, startNo: 11 + i })),
    { userId: null, guestName: DEMO_GUEST, startNo: 20 },
  ];
  let rows = 0;
  const participants = people.map((p, i) => {
    const results = stages.map((st, idx) => {
      const shots = demoShots(st.shots, st.max, i + idx);
      rows += shots.length;
      return { stageIndex: idx, shotsJson: JSON.stringify(shots), total: shots.reduce((a, b) => a + b, 0) };
    });
    const zeros = results.reduce((a, r) => a + (JSON.parse(r.shotsJson) as number[]).filter((v) => v === 0).length, 0);
    return {
      userId: p.userId,
      guestName: p.guestName,
      note: `Startnr. ${p.startNo}`,
      sortOrder: i,
      total: results.reduce((a, r) => a + r.total, 0),
      zeros,
      results: { create: results },
    };
  });

  const date = new Date(Date.now() - 12 * DAY);
  date.setUTCHours(11, 0, 0, 0);
  const match = await db.match.create({
    data: {
      tenantId,
      programId: program.id,
      createdById: userIds[0] ?? null,
      title: `Import ${DEMO_FILE}`,
      date,
      status: "FINISHED",
      finishedAt: date,
      participants: { create: participants },
    },
    select: { id: true },
  });
  await db.scoreImport.create({
    data: { tenantId, createdById: userIds[0] ?? null, format: "MEYTON", fileName: DEMO_FILE, fileHash, rows, matchIds: match.id },
  });
}
