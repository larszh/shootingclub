/**
 * Demo-Kurse für den Seed (prisma/seed.ts). Nur relative Imports und kein "server-only".
 * Idempotent: legt nur etwas an, wenn der Verein noch keine Kurse hat.
 */
import type { PrismaClient } from "../../generated/prisma/client";

type Db = Pick<PrismaClient, "course" | "courseParticipant" | "courseSession" | "courseAttendance" | "courseResult" | "qualificationRule" | "program" | "user">;

const DAY = 86_400_000;

function dbDate(daysFromToday: number) {
  const d = new Date(Date.now() + daysFromToday * DAY);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function at(daysFromToday: number, hourUtc: number) {
  const d = dbDate(daysFromToday);
  return new Date(d.getTime() + hourUtc * 3_600_000);
}

export async function seedDemoCourses(db: Db, tenantId: string, userIds: string[]) {
  if ((await db.course.count({ where: { tenantId } })) > 0) return { created: 0, skipped: true };
  const year = new Date().getUTCFullYear();
  const [leaderId, memberId] = [userIds[0] ?? null, userIds[1] ?? null];

  const programs = await db.program.findMany({
    where: { OR: [{ tenantId: null }, { tenantId }], isArchived: false },
    select: { id: true, name: true, discipline: true, passMinScore: true, passMaxZeros: true, officialKind: true },
    orderBy: { name: "asc" },
    take: 50,
  });
  const official = programs.filter((p) => p.officialKind === "OP" || p.officialKind === "FS");
  const required = (official.length ? official : programs).slice(0, 2);

  // --- Jungschützenkurs ---
  const js = await db.course.create({
    data: {
      tenantId, kind: "JUNGSCHUETZEN", name: `Jungschützenkurs ${year}`, year, startsOn: dbDate(-35), endsOn: dbDate(60), leaderUserId: leaderId,
      minParticipants: 5, requiredProgramIds: required.map((p) => p.id).join(",") || null, status: "RUNNING",
      notes: "Treffpunkt jeweils 15 Minuten vor Beginn beim Schützenhaus. Gehörschutz wird abgegeben.",
    },
  });
  const people = [
    { firstName: "Lea", lastName: "Muster", birthDate: new Date(Date.UTC(year - 16, 2, 4)), guardianName: "Eva Muster", guardianEmail: "eva.muster@example.ch", guardianPhone: "079 000 00 01" },
    { firstName: "Noah", lastName: "Brunner", birthDate: new Date(Date.UTC(year - 17, 6, 12)), guardianName: "Peter Brunner", guardianEmail: null, guardianPhone: "079 000 00 02" },
    { firstName: "Mia", lastName: "Keller", birthDate: new Date(Date.UTC(year - 15, 10, 23)), guardianName: "Sandra Keller", guardianEmail: "s.keller@example.ch", guardianPhone: null },
    { firstName: "Luca", lastName: "Steiner", birthDate: new Date(Date.UTC(year - 19, 0, 30)), guardianName: null, guardianEmail: null, guardianPhone: null },
  ];
  const parts = [];
  for (const p of people) parts.push(await db.courseParticipant.create({ data: { courseId: js.id, ...p, status: "ACTIVE" } }));
  if (memberId) {
    const u = await db.user.findUnique({ where: { id: memberId }, select: { name: true, email: true, birthDate: true, phone: true } });
    if (u) {
      const bits = u.name.trim().split(/\s+/);
      parts.push(
        await db.courseParticipant.create({
          data: { courseId: js.id, userId: memberId, firstName: bits.slice(0, -1).join(" ") || bits[0]!, lastName: bits[bits.length - 1]!, birthDate: u.birthDate, email: u.email, phone: u.phone, status: "ACTIVE", note: "Mitglied mit App-Konto" },
        }),
      );
    }
  }

  const sessions = [];
  for (const [i, d] of [-28, -21, -14, -7, 7].entries()) {
    sessions.push(await db.courseSession.create({ data: { courseId: js.id, title: `Lektion ${i + 1}`, startsAt: at(d, 16), endsAt: at(d, 18) } }));
  }
  const past = sessions.slice(0, 4);
  const attendance = [];
  for (const [si, s] of past.entries()) {
    for (const [pi, p] of parts.entries()) attendance.push({ sessionId: s.id, participantId: p.id, present: !((si + pi) % 4 === 3) });
  }
  await db.courseAttendance.createMany({ data: attendance });

  if (required.length) {
    const results = [];
    // Lea: alles bestanden → abgeschlossen; Noah: erstes Programm bestanden; Mia: erster Versuch knapp verfehlt.
    for (const prog of required) {
      const min = prog.passMinScore ?? 40;
      results.push({ participantId: parts[0]!.id, programId: prog.id, label: prog.name, score: min + 6, passed: true, date: dbDate(-14) });
    }
    results.push({ participantId: parts[1]!.id, programId: required[0]!.id, label: required[0]!.name, score: (required[0]!.passMinScore ?? 40) + 2, passed: true, date: dbDate(-14) });
    results.push({ participantId: parts[2]!.id, programId: required[0]!.id, label: required[0]!.name, score: Math.max(0, (required[0]!.passMinScore ?? 40) - 3), passed: false, date: dbDate(-7) });
    await db.courseResult.createMany({ data: results });
    await db.courseParticipant.update({ where: { id: parts[0]!.id }, data: { status: "COMPLETED" } });
  }

  // --- J+S Sportschiessen (geplant) ---
  const jsCourse = await db.course.create({
    data: { tenantId, kind: "JS", name: `J+S Sportschiessen Herbst ${year}`, year, startsOn: dbDate(20), endsOn: dbDate(90), leaderUserId: leaderId, status: "PLANNED", notes: "Präsenz nach jeder Lektion erfassen und monatlich in die NDS übertragen (J+S-Coach)." },
  });
  await db.courseParticipant.createMany({
    data: [
      { courseId: jsCourse.id, firstName: "Elena", lastName: "Graf", birthDate: new Date(Date.UTC(year - 13, 4, 2)), guardianName: "Marco Graf", guardianPhone: "079 000 00 03" },
      { courseId: jsCourse.id, firstName: "Jonas", lastName: "Meier", birthDate: new Date(Date.UTC(year - 14, 8, 17)), guardianName: "Anna Meier", guardianEmail: "anna.meier@example.ch" },
    ],
  });

  // --- Qualifikationsregel ---
  let rules = 0;
  const pistol = programs.find((p) => p.discipline === "PISTOL") ?? programs[0];
  if (pistol && (await db.qualificationRule.count({ where: { tenantId } })) === 0) {
    await db.qualificationRule.create({
      data: { tenantId, programId: pistol.id, name: `Einsatzqualifikation ${pistol.name}`.slice(0, 191), kind: "WEAPON_QUAL", passScore: pistol.passMinScore ?? 80, maxZeros: pistol.passMaxZeros ?? 2, validityMonths: 12, requireInstructor: true },
    });
    rules = 1;
  }
  return { created: 2, rules, skipped: false };
}
