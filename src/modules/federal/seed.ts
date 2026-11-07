/**
 * Demo-Daten für die Bundesübungen (prisma/seed.ts). Bewusst nur relative Imports und kein
 * "server-only", damit tsx das Skript ausserhalb von Next.js ausführen kann.
 *
 * Idempotent: Modul einschalten, Fristen des laufenden Jahres nur anlegen, wenn keine existieren;
 * Obligatorisch-Anlass und Durchgang nur, wenn der Demo-Anlass noch nicht existiert.
 * Die Fristen sind Beispielwerte und keine offiziellen Termine.
 */
import type { PrismaClient } from "../../generated/prisma/client";

type Db = Pick<PrismaClient, "tenantModule" | "federalYear" | "event" | "eventRsvp" | "program" | "match" | "awardLimit">;

const DEMO_EVENT_TITLE = "Obligatorisch 300 m (Demo)";
const OP_PRESET_NAME = "Gewehr 300 m – Obligatorisch";

function utcDay(y: number, m: number, d: number) {
  return new Date(Date.UTC(y, m - 1, d));
}

/** Schüsse für eine Serie: gleichmässig verteilt, mit `zeros` Nullern am Schluss. */
function shotsFor(count: number, value: number, zeros: number) {
  return Array.from({ length: count }, (_, i) => (i >= count - zeros ? 0 : value));
}

export async function seedDemoFederal(db: Db, tenantId: string, userIds: string[]) {
  await db.tenantModule.upsert({
    where: { tenantId_moduleKey: { tenantId, moduleKey: "federal" } },
    update: { enabled: true },
    create: { tenantId, moduleKey: "federal", enabled: true },
  });

  const now = new Date();
  const year = now.getUTCFullYear();
  const existingYear = await db.federalYear.findUnique({ where: { tenantId_year: { tenantId, year } } });
  if (!existingYear) {
    await db.federalYear.create({
      data: {
        tenantId,
        year,
        registrationDeadline: utcDay(year, 3, 31),
        shootingDeadline: utcDay(year, 8, 31),
        reportDeadline: utcDay(year, 9, 15),
        notes: "Beispielwerte aus den Demo-Daten – bitte mit den aktuellen Vorgaben (VBS/SSV/Kanton) prüfen.",
      },
    });
  }

  await seedDemoFederalAwards(db, tenantId, userIds);

  const already = await db.event.findFirst({ where: { tenantId, title: DEMO_EVENT_TITLE }, select: { id: true } });
  if (already) return { created: false };

  // Anlass vor rund drei Wochen, 09:00 Schweizer Zeit (ungefähr 07:00 UTC)
  const startsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 21, 7, 0));
  const event = await db.event.create({
    data: {
      tenantId,
      createdById: userIds[0] ?? null,
      title: DEMO_EVENT_TITLE,
      description: "Bundesübung 300 m. Dienstbüchlein/Schiessbüchlein und Ausweis mitnehmen.",
      kind: "OBLIGATORY",
      startsAt,
      endsAt: new Date(startsAt.getTime() + 3 * 3600_000),
      location: "Schiessanlage Demo",
      rsvpEnabled: true,
    },
  });
  for (const userId of userIds.slice(0, 3)) {
    await db.eventRsvp.create({ data: { eventId: event.id, userId, status: "YES" } });
  }

  const program = await db.program.findFirst({ where: { tenantId: null, name: OP_PRESET_NAME }, select: { id: true, stagesJson: true, passMinScore: true, passMaxZeros: true } });
  if (!program || userIds.length === 0) return { created: true, match: false };
  let stages: Array<{ shots: number }> = [];
  try {
    const parsed: unknown = JSON.parse(program.stagesJson);
    if (Array.isArray(parsed)) stages = parsed.map((s) => ({ shots: Number((s as { shots?: number }).shots) || 0 }));
  } catch {
    stages = [];
  }
  if (!stages.length) return { created: true, match: false };

  const participants = userIds.slice(0, 3).map((userId, i) => {
    // 1. Teilnehmer: solide, 2. viele Nuller (nicht bestanden), 3. nicht bestätigt
    const value = i === 0 ? 8 : i === 1 ? 5 : 7;
    const zerosPerStage = i === 1 ? 1 : 0;
    const results = stages.map((st, stageIndex) => {
      const shots = shotsFor(st.shots, value, Math.min(zerosPerStage, st.shots));
      return { stageIndex, shotsJson: JSON.stringify(shots), total: shots.reduce((a, b) => a + b, 0) };
    });
    const total = results.reduce((a, r) => a + r.total, 0);
    const zeros = stages.reduce((a, st) => a + Math.min(zerosPerStage, st.shots), 0);
    const hasRule = program.passMinScore !== null || program.passMaxZeros !== null;
    const passed = !hasRule ? null : (program.passMinScore === null || total >= program.passMinScore) && (program.passMaxZeros === null || zeros <= program.passMaxZeros);
    const official = i < 2;
    return {
      userId,
      sortOrder: i,
      total,
      zeros,
      isOfficial: official,
      attempt: official ? 1 : null,
      passed: official ? passed : null,
      verifiedById: official ? userIds[0]! : null,
      verifiedAt: official ? new Date(startsAt.getTime() + 2 * 3600_000) : null,
      results: { create: results },
    };
  });

  await db.match.create({
    data: {
      tenantId,
      programId: program.id,
      createdById: userIds[0]!,
      eventId: event.id,
      title: DEMO_EVENT_TITLE,
      date: startsAt,
      status: "FINISHED",
      finishedAt: new Date(startsAt.getTime() + 2 * 3600_000),
      participants: { create: participants },
    },
  });
  return { created: true, match: true };
}

/** Gleicher Wert wie AWARD_EXAMPLE_MARK in awards.ts (hier dupliziert: nur relative Imports ohne Pfad-Alias). */
export const DEMO_AWARD_EXAMPLE_MARK = "(Beispiel)";
const FS_PRESET_NAME = "Feldschiessen 300 m (nachempfunden)";
const DEMO_FS_TITLE = "Feldschiessen 300 m (Demo)";

/**
 * Feldschiessen-Demo: Beispiel-Limiten (klar als Beispiel markiert, keine offiziellen Werte) und ein
 * Durchgang mit drei Teilnehmern, damit die Auszeichnungen berechnet werden. Idempotent: Limiten nur,
 * wenn für Programm und Jahr keine existieren; Durchgang nur, wenn der Demo-Titel im Jahr fehlt.
 * Wird von seedDemoFederal aufgerufen.
 */
export async function seedDemoFederalAwards(db: Db, tenantId: string, userIds: string[]) {
  const program = await db.program.findFirst({ where: { tenantId: null, name: FS_PRESET_NAME }, select: { id: true, stagesJson: true } });
  if (!program) return { limits: false, match: false };
  const now = new Date();
  const year = now.getUTCFullYear();

  let limits = false;
  // Beispiel, bitte prüfen: Platzhalterwerte, Limiten gemäss Ausschreibung eintragen. Die Markierung
  // «(Beispiel)» steht in der Auszeichnung, damit sie in Übersicht, Druckliste und CSV sichtbar ist.
  const plain = [
    { category: "Jugend (bis 20)", minScore: 56, award: "Kranz" },
    { category: "Jugend (bis 20)", minScore: 52, award: "Anerkennungskarte" },
    { category: "Elite (21–59)", minScore: 58, award: "Kranz" },
    { category: "Elite (21–59)", minScore: 54, award: "Anerkennungskarte" },
    { category: "Veteranen (ab 60)", minScore: 56, award: "Kranz" },
    { category: "Veteranen (ab 60)", minScore: 52, award: "Anerkennungskarte" },
  ];
  const marked = (award: string) => `${award} ${DEMO_AWARD_EXAMPLE_MARK}`;
  const existing = await db.awardLimit.findMany({ where: { tenantId, programId: program.id, year }, select: { id: true, category: true, minScore: true, award: true } });
  if (!existing.length) {
    await db.awardLimit.createMany({ data: plain.map((r, sort) => ({ tenantId, programId: program.id, year, sort, ...r, award: marked(r.award) })) });
    limits = true;
  } else if (
    existing.length === plain.length &&
    existing.every((e) => plain.some((p) => p.category === e.category && p.minScore === e.minScore && p.award === e.award))
  ) {
    // Ältere Demo-Daten ohne Markierung: unveränderte Beispielwerte nachträglich als Beispiel markieren.
    for (const e of existing) await db.awardLimit.update({ where: { id: e.id }, data: { award: marked(e.award) } });
    limits = true;
  }

  if (!userIds.length) return { limits, match: false };
  const from = new Date(Date.UTC(year, 0, 1));
  const to = new Date(Date.UTC(year + 1, 0, 1));
  const already = await db.match.findFirst({ where: { tenantId, title: DEMO_FS_TITLE, date: { gte: from, lt: to } }, select: { id: true } });
  if (already) return { limits, match: false };
  let stages: number[] = [];
  try {
    const parsed: unknown = JSON.parse(program.stagesJson);
    if (Array.isArray(parsed)) stages = parsed.map((s) => Number((s as { shots?: number }).shots) || 0);
  } catch {
    stages = [];
  }
  if (!stages.length) return { limits, match: false };

  // Ende Mai des laufenden Jahres (bzw. vor drei Wochen, falls noch vor Ende Mai), 09:00 Schweizer Zeit.
  // Nie vor dem 1. Januar: sonst fände die Jahresprüfung oben den Stich nicht (Seed bliebe nicht idempotent).
  const may = new Date(Date.UTC(year, 4, 30, 7, 0));
  const date = may.getTime() < now.getTime() ? may : new Date(Math.max(from.getTime() + 7 * 3_600_000, now.getTime() - 21 * 86_400_000));
  // Werte pro Schuss: guter Schütze (≈ Kranz), mittlerer (≈ Karte), schwächerer (ohne Auszeichnung)
  const perShot = [4, 3, 2];
  const extra = [1, 0, 1];
  const participants = userIds.slice(0, 3).map((userId, i) => {
    const results = stages.map((count, stageIndex) => {
      const shots = Array.from({ length: count }, (_, k) => Math.min(5, perShot[i]! + (k < 3 ? extra[i]! : 0)));
      return { stageIndex, shotsJson: JSON.stringify(shots), total: shots.reduce((a, b) => a + b, 0) };
    });
    return {
      userId,
      sortOrder: i,
      total: results.reduce((a, r) => a + r.total, 0),
      zeros: 0,
      isOfficial: i < 2,
      verifiedById: i < 2 ? userIds[0]! : null,
      verifiedAt: i < 2 ? new Date(date.getTime() + 2 * 3600_000) : null,
      results: { create: results },
    };
  });
  await db.match.create({
    data: {
      tenantId,
      programId: program.id,
      createdById: userIds[0]!,
      title: DEMO_FS_TITLE,
      date,
      status: "FINISHED",
      finishedAt: new Date(date.getTime() + 2 * 3600_000),
      participants: { create: participants },
    },
  });
  return { limits, match: true };
}
