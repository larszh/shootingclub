import "server-only";
import { db } from "@/lib/db";
import { zurichParts } from "@/lib/time";
import { QUALIFICATION_KINDS, dayToDbDate } from "./types";

// Vertrag für andere Module (Standbetrieb, Kurse, Schichten). Signaturen nicht ändern.
export { QUALIFICATION_KINDS };

/**
 * Hat das Mitglied am Zeitpunkt `at` (Standard: jetzt, Schweizer Kalendertag) mindestens eine gültige
 * Qualifikation einer der Arten `kinds`? Leere Gültigkeitsgrenzen gelten als offen.
 */
export async function hasValidQualification(tenantId: string, userId: string, kinds: string[], at?: Date): Promise<boolean> {
  if (!tenantId || !userId || !kinds.length) return false;
  const day = dayToDbDate(zurichParts(at ?? new Date()).dateStr);
  const row = await db.qualification.findFirst({
    where: {
      tenantId,
      userId,
      kind: { in: kinds },
      AND: [{ OR: [{ validFrom: null }, { validFrom: { lte: day } }] }, { OR: [{ validUntil: null }, { validUntil: { gte: day } }] }],
    },
    select: { id: true },
  });
  return !!row;
}

const clip = (s: string | null | undefined, max = 191) => {
  const v = s?.trim();
  return v ? v.slice(0, max) : null;
};

/**
 * Erteilt eine Qualifikation (z.B. nach bestandenem Qualifikationsschiessen oder Kursabschluss).
 * Mit `sourceParticipantId` idempotent: dieselbe Quelle erzeugt keine zweite Qualifikation derselben Art.
 */
export async function grantQualification(q: {
  tenantId: string;
  userId: string;
  kind: string;
  label?: string | null;
  validFrom?: Date | null;
  validUntil?: Date | null;
  verifiedById?: string | null;
  sourceParticipantId?: string | null;
  note?: string | null;
}): Promise<{ id: string }> {
  const kind = QUALIFICATION_KINDS.some((k) => k.key === q.kind) ? q.kind : "OTHER";
  // @db.Date: als UTC-Mitternacht des Schweizer Kalendertags speichern
  const asDay = (d: Date | null | undefined) => (d ? dayToDbDate(zurichParts(d).dateStr) : null);
  const data = {
    label: clip(q.label),
    validFrom: asDay(q.validFrom),
    validUntil: asDay(q.validUntil),
    verifiedById: q.verifiedById ?? null,
    note: clip(q.note),
  };
  if (q.sourceParticipantId) {
    const existing = await db.qualification.findFirst({
      where: { tenantId: q.tenantId, userId: q.userId, kind, sourceParticipantId: q.sourceParticipantId },
      select: { id: true },
    });
    if (existing) {
      await db.qualification.update({ where: { id: existing.id }, data });
      return { id: existing.id };
    }
  }
  const row = await db.qualification.create({
    data: { tenantId: q.tenantId, userId: q.userId, kind, sourceParticipantId: q.sourceParticipantId ?? null, ...data },
    select: { id: true },
  });
  return { id: row.id };
}
