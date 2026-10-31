/**
 * Demo-Daten für die Bundesübungen (prisma/seed.ts). Bewusst nur relative Imports und kein
 * "server-only", damit tsx das Skript ausserhalb von Next.js ausführen kann.
 *
 * Idempotent: Modul einschalten, Fristen des laufenden Jahres nur anlegen, wenn keine existieren;
 * Obligatorisch-Anlass und Durchgang nur, wenn der Demo-Anlass noch nicht existiert.
 * Die Fristen sind Beispielwerte und keine offiziellen Termine.
 */
import type { PrismaClient } from "../../generated/prisma/client";

type Db = Pick<PrismaClient, "tenantModule" | "federalYear" | "event" | "eventRsvp" | "program" | "match">;

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
