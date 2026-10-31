/**
 * Demo-Daten Helfereinsätze und Qualifikationen für den Seed (prisma/seed.ts).
 * Nur relative Imports und kein "server-only". Idempotent: legt nur etwas an, wenn der Verein
 * noch keine Einsätze hat.
 */
import type { PrismaClient } from "../../generated/prisma/client";

type Db = Pick<PrismaClient, "shift" | "shiftAssignment" | "workHoursSettings" | "workLog" | "qualification" | "event">;

const DAY = 86_400_000;
const HOUR = 3_600_000;

/** UTC-Mitternacht in `days` Tagen (für @db.Date-Felder). */
function dbDate(days: number) {
  const d = new Date(Date.now() + days * DAY);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Zeitpunkt in `days` Tagen um `hour` Uhr (ungefähr Schweizer Zeit, für Demo ausreichend). */
function at(days: number, hour: number) {
  const base = dbDate(days);
  return new Date(base.getTime() + (hour - 1) * HOUR);
}

export async function seedDemoShifts(db: Db, tenantId: string, userIds: string[]) {
  if ((await db.shift.count({ where: { tenantId } })) > 0) return { created: 0, skipped: true };
  const [adminId, memberId, thirdId] = [userIds[0] ?? null, userIds[1] ?? userIds[0] ?? null, userIds[2] ?? userIds[0] ?? null];

  await db.workHoursSettings.upsert({
    where: { tenantId },
    create: { tenantId, enabled: true, requiredHours: 8, ratePerMissingHourCents: 3000, appliesToStatuses: "ACTIVE,JUNIOR" },
    update: {},
  });

  // Einsatz zu einem Arbeitseinsatz-Anlass, falls vorhanden
  const workEvent = await db.event.findFirst({ where: { tenantId, kind: { in: ["WORK", "COMPETITION"] }, isCancelled: false, startsAt: { gte: new Date() } }, orderBy: { startsAt: "asc" }, select: { id: true, startsAt: true, title: true } });

  const created: string[] = [];
  const mk = async (data: { title: string; startsAt: Date; endsAt: Date; capacity: number; eventId?: string | null; requiredQualification?: string | null; hoursCredit?: number | null; note?: string | null }) => {
    const s = await db.shift.create({ data: { tenantId, eventId: null, requiredQualification: null, hoursCredit: null, note: null, ...data }, select: { id: true } });
    created.push(s.id);
    return s.id;
  };

  // Standdienst an den nächsten drei Samstagen (ungefähr), 08–12 Uhr, Schützenmeister verlangt
  for (let i = 0; i < 3; i++) {
    const day = 3 + i * 7;
    await mk({ title: "Standdienst 300 m", startsAt: at(day, 8), endsAt: at(day, 12), capacity: 2, requiredQualification: "SCHUETZENMEISTER", note: "Standblatt führen, Schützen einweisen." });
  }
  if (workEvent) {
    await mk({ title: "Helfer Aufbau", eventId: workEvent.id, startsAt: new Date(workEvent.startsAt.getTime() - 2 * HOUR), endsAt: workEvent.startsAt, capacity: 4, hoursCredit: 2 });
  }
  const past = await mk({ title: "Frühlingsputz Schützenhaus", startsAt: at(-20, 9), endsAt: at(-20, 13), capacity: 6, note: "Arbeitskleider mitnehmen." });

  // Einteilungen: einer kommend, einer erledigt
  if (adminId) await db.shiftAssignment.create({ data: { shiftId: created[0]!, userId: adminId, status: "ASSIGNED" } });
  if (memberId) await db.shiftAssignment.create({ data: { shiftId: past, userId: memberId, status: "DONE", hours: 4, confirmedById: adminId } });
  if (thirdId && thirdId !== memberId) await db.shiftAssignment.create({ data: { shiftId: past, userId: thirdId, status: "NO_SHOW", confirmedById: adminId } });

  if (memberId) {
    await db.workLog.createMany({
      data: [
        { tenantId, userId: memberId, date: dbDate(-12), hours: 2, description: "Scheibenzug geölt", approvedById: adminId, approvedAt: new Date() },
        { tenantId, userId: memberId, date: dbDate(-2), hours: 1.5, description: "Rasen gemäht beim Stand" },
      ],
    });
  }

  if ((await db.qualification.count({ where: { tenantId } })) === 0 && adminId) {
    await db.qualification.createMany({
      data: [
        { tenantId, userId: adminId, kind: "SCHUETZENMEISTER", label: "Gewehr 300 m", number: "SM-DEMO-1", validFrom: dbDate(-700), validUntil: dbDate(40), verifiedById: adminId },
        { tenantId, userId: adminId, kind: "FIRST_AID", label: "Nothelferkurs", validFrom: dbDate(-300), validUntil: null, verifiedById: adminId },
        ...(memberId && memberId !== adminId ? [{ tenantId, userId: memberId, kind: "JS_LEITER", label: "Sportschiessen", validFrom: dbDate(-900), validUntil: dbDate(-10), verifiedById: adminId }] : []),
      ],
    });
  }
  return { created: created.length, skipped: false };
}
