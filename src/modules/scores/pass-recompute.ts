/**
 * «Bestanden» aller amtlichen Resultate eines Programms neu berechnen, nachdem sich dessen
 * Bestehensgrenze geändert hat (Programm bearbeitet oder Vorlagen-Abgleich im Seed).
 * Bewusst nur relative Imports und kein "server-only", damit auch prisma/seed.ts (tsx) es nutzen kann.
 */
import type { PrismaClient } from "../../generated/prisma/client";
import { evaluatePass, type PassRule } from "./official";

type Db = Pick<PrismaClient, "matchParticipant">;

/** Hat sich die Bestehensgrenze geändert? */
export function passRuleChanged(before: PassRule, after: PassRule): boolean {
  return (before.passMinScore ?? null) !== (after.passMinScore ?? null) || (before.passMaxZeros ?? null) !== (after.passMaxZeros ?? null);
}

/** Gespeichertes `passed` der amtlichen Resultate des Programms an die Regel anpassen. Gibt die Anzahl Änderungen zurück. */
export async function recomputeProgramPasses(db: Db, programId: string, rule: PassRule): Promise<number> {
  const rows = await db.matchParticipant.findMany({
    where: { isOfficial: true, match: { programId } },
    select: { id: true, total: true, zeros: true, passed: true },
  });
  let changed = 0;
  for (const r of rows) {
    const passed = evaluatePass(r, rule);
    if (passed === r.passed) continue;
    await db.matchParticipant.update({ where: { id: r.id }, data: { passed } });
    changed++;
  }
  return changed;
}
