import "server-only";
import { db } from "@/lib/db";
import { attendanceIndex, attendanceSummary, completionMatrix, dbDay, parseIdCsv, splitGrantNote } from "./logic";

// --- Programme / Mitglieder ------------------------------------------------------------------------------

export type ProgramOption = { id: string; name: string; discipline: string; passMinScore: number | null; passMaxZeros: number | null; officialKind: string | null };

/** Programme, die im Verein sichtbar sind (global + eigene, ohne versteckte und archivierte). */
export async function programOptions(tenantId: string): Promise<ProgramOption[]> {
  const [programs, hidden] = await Promise.all([
    db.program.findMany({
      where: { OR: [{ tenantId: null }, { tenantId }], isArchived: false },
      select: { id: true, name: true, discipline: true, passMinScore: true, passMaxZeros: true, officialKind: true },
      orderBy: { name: "asc" },
    }),
    db.programTenantSetting.findMany({ where: { tenantId, hidden: true }, select: { programId: true } }),
  ]);
  const h = new Set(hidden.map((x) => x.programId));
  return programs.filter((p) => !h.has(p.id));
}

/** Programme nach IDs (nur global oder eigener Verein), Reihenfolge wie angegeben. */
export async function programsByIds(tenantId: string, ids: string[]): Promise<ProgramOption[]> {
  if (!ids.length) return [];
  const rows = await db.program.findMany({
    where: { id: { in: ids }, OR: [{ tenantId: null }, { tenantId }] },
    select: { id: true, name: true, discipline: true, passMinScore: true, passMaxZeros: true, officialKind: true },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter((p): p is ProgramOption => !!p);
}

export type CourseMemberOption = {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  birthDate: string | null;
  street: string | null;
  zip: string | null;
  city: string | null;
  guardianName: string | null;
  guardianEmail: string | null;
  guardianPhone: string | null;
};

/** Mitglieder für Auswahllisten (ohne Ausgetretene und gelöschte Konten). */
export async function memberOptions(tenantId: string): Promise<CourseMemberOption[]> {
  const rows = await db.membership.findMany({
    where: { tenantId, status: { not: "LEFT" }, user: { deletedAt: null } },
    select: {
      guardianName: true, guardianEmail: true, guardianPhone: true,
      user: { select: { id: true, name: true, email: true, phone: true, birthDate: true, street: true, zip: true, city: true } },
    },
    orderBy: { user: { name: "asc" } },
  });
  return rows.map((m) => ({
    userId: m.user.id, name: m.user.name, email: m.user.email, phone: m.user.phone, birthDate: dbDay(m.user.birthDate),
    street: m.user.street, zip: m.user.zip, city: m.user.city, guardianName: m.guardianName, guardianEmail: m.guardianEmail, guardianPhone: m.guardianPhone,
  }));
}

/** Leitungs-Auswahl: Mitglieder ab Rolle Trainer zuerst, danach alle übrigen. */
export async function leaderOptions(tenantId: string) {
  const rows = await db.membership.findMany({
    where: { tenantId, status: { not: "LEFT" }, user: { deletedAt: null } },
    select: { role: true, user: { select: { id: true, name: true } } },
    orderBy: { user: { name: "asc" } },
  });
  const rank = (r: string) => (r === "MEMBER" ? 1 : 0);
  return rows.sort((a, b) => rank(a.role) - rank(b.role)).map((r) => ({ userId: r.user.id, name: r.user.name, trainer: r.role !== "MEMBER" }));
}

export async function userNames(ids: (string | null | undefined)[]) {
  const clean = [...new Set(ids.filter((x): x is string => !!x))];
  if (!clean.length) return new Map<string, string>();
  const rows = await db.user.findMany({ where: { id: { in: clean } }, select: { id: true, name: true } });
  return new Map(rows.map((u) => [u.id, u.name]));
}

export async function weaponNames(tenantId: string, ids: (string | null)[]) {
  const clean = [...new Set(ids.filter((x): x is string => !!x))];
  if (!clean.length) return new Map<string, { name: string; status: string }>();
  const rows = await db.clubWeapon.findMany({ where: { tenantId, id: { in: clean } }, select: { id: true, name: true, status: true } });
  return new Map(rows.map((w) => [w.id, { name: w.name, status: w.status }]));
}

// --- Kurse -------------------------------------------------------------------------------------------------

export async function courseYears(tenantId: string): Promise<number[]> {
  const rows = await db.course.findMany({ where: { tenantId }, select: { year: true }, distinct: ["year"], orderBy: { year: "desc" } });
  return rows.map((r) => r.year);
}

export async function listCourses(tenantId: string, f: { year: number; kind?: string }) {
  const rows = await db.course.findMany({
    where: { tenantId, year: f.year, ...(f.kind ? { kind: f.kind } : {}) },
    select: {
      id: true, name: true, kind: true, year: true, startsOn: true, endsOn: true, status: true, minParticipants: true, leaderUserId: true, requiredProgramIds: true,
      participants: { select: { status: true } },
      _count: { select: { sessions: true } },
    },
    orderBy: [{ startsOn: "asc" }, { name: "asc" }],
  });
  const leaders = await userNames(rows.map((r) => r.leaderUserId));
  return rows.map((r) => {
    const active = r.participants.filter((p) => p.status !== "DROPPED").length;
    return {
      id: r.id, name: r.name, kind: r.kind, year: r.year, status: r.status, startsOn: dbDay(r.startsOn), endsOn: dbDay(r.endsOn),
      minParticipants: r.minParticipants, participants: active, completed: r.participants.filter((p) => p.status === "COMPLETED").length,
      sessions: r._count.sessions, leaderName: r.leaderUserId ? leaders.get(r.leaderUserId) ?? null : null, requiredCount: parseIdCsv(r.requiredProgramIds).length,
    };
  });
}
export type CourseListItem = Awaited<ReturnType<typeof listCourses>>[number];

/** Kurs mit Teilnehmenden, Lektionen, Präsenz, Resultaten und Pflichtprogramm-Matrix. */
export async function getCourse(tenantId: string, id: string) {
  const c = await db.course.findFirst({
    where: { id, tenantId },
    include: {
      participants: { include: { results: { orderBy: { date: "desc" } } }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] },
      sessions: { include: { attendance: { select: { participantId: true, present: true, sessionId: true } } }, orderBy: { startsAt: "asc" } },
    },
  });
  if (!c) return null;
  const requiredIds = parseIdCsv(c.requiredProgramIds);
  const [programs, leaders, weapons] = await Promise.all([
    programsByIds(tenantId, requiredIds),
    userNames([c.leaderUserId]),
    weaponNames(tenantId, c.participants.map((p) => p.clubWeaponId)),
  ]);
  const requiredPrograms = programs;
  const results = c.participants.flatMap((p) => p.results.map((r) => ({ participantId: p.id, programId: r.programId, passed: r.passed, score: r.score, date: dbDay(r.date)! })));
  const matrix = completionMatrix(c.participants.map((p) => p.id), requiredPrograms.map((p) => p.id), results);
  const matrixBy = new Map(matrix.map((m) => [m.participantId, m]));
  const attendance = c.sessions.flatMap((s) => s.attendance);
  const idx = attendanceIndex(attendance);
  const sessionIds = c.sessions.map((s) => s.id);
  const participants = c.participants.map((p) => ({
    ...p,
    birthDay: dbDay(p.birthDate),
    weapon: p.clubWeaponId ? weapons.get(p.clubWeaponId) ?? null : null,
    completion: matrixBy.get(p.id)!,
    attendance: attendanceSummary(p.id, sessionIds, idx),
  }));
  return {
    ...c,
    startsOnDay: dbDay(c.startsOn),
    endsOnDay: dbDay(c.endsOn),
    leaderName: c.leaderUserId ? leaders.get(c.leaderUserId) ?? null : null,
    requiredPrograms,
    participants,
    activeCount: participants.filter((p) => p.status !== "DROPPED").length,
    attendanceIdx: idx,
  };
}
export type CourseDetail = NonNullable<Awaited<ReturnType<typeof getCourse>>>;

/** Kurse, in denen das Mitglied als Teilnehmer:in eingetragen ist. */
export async function myCourseParticipations(tenantId: string, userId: string) {
  const parts = await db.courseParticipant.findMany({
    where: { userId, course: { tenantId } },
    select: { id: true, courseId: true },
  });
  if (!parts.length) return [];
  const courses = await Promise.all([...new Set(parts.map((p) => p.courseId))].map((cid) => getCourse(tenantId, cid)));
  return courses
    .filter((c): c is CourseDetail => !!c)
    .map((c) => ({ course: c, me: c.participants.find((p) => p.userId === userId)! }))
    .filter((x) => !!x.me)
    .sort((a, b) => b.course.year - a.course.year || (a.course.startsOnDay ?? "").localeCompare(b.course.startsOnDay ?? ""));
}

/** Abgeschlossene Durchgänge eines Mitglieds mit einem der Programme (zum Verknüpfen als Kursresultat). */
export async function candidateMatches(tenantId: string, userId: string, programIds: string[]) {
  if (!programIds.length) return [];
  const rows = await db.matchParticipant.findMany({
    where: { userId, match: { tenantId, status: "FINISHED", programId: { in: programIds } } },
    select: { id: true, total: true, zeros: true, passed: true, isOfficial: true, match: { select: { id: true, date: true, finishedAt: true, programId: true, title: true } } },
    orderBy: { match: { date: "desc" } },
    take: 60,
  });
  return rows.map((r) => ({ id: r.id, total: r.total, zeros: r.zeros, passed: r.passed, isOfficial: r.isOfficial, matchId: r.match.id, programId: r.match.programId, date: r.match.finishedAt ?? r.match.date, title: r.match.title }));
}
export type CandidateMatch = Awaited<ReturnType<typeof candidateMatches>>[number];

// --- Qualifikationsschiessen ------------------------------------------------------------------------------

export async function listRules(tenantId: string) {
  const rules = await db.qualificationRule.findMany({
    where: { tenantId },
    include: { program: { select: { id: true, name: true, discipline: true } } },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
  return rules;
}
export type RuleItem = Awaited<ReturnType<typeof listRules>>[number];

export async function getRule(tenantId: string, id: string) {
  return db.qualificationRule.findFirst({ where: { id, tenantId }, include: { program: { select: { id: true, name: true, discipline: true, tenantId: true } } } });
}

/** Letzte abgeschlossene Durchgänge eines Programms mit Teilnehmenden und bereits erteilten Qualifikationen. */
export async function recentMatchesForProgram(tenantId: string, programId: string, take = 15) {
  const matches = await db.match.findMany({
    where: { tenantId, programId, status: "FINISHED" },
    select: {
      id: true, title: true, date: true, finishedAt: true,
      participants: { select: { id: true, userId: true, guestName: true, total: true, zeros: true, user: { select: { name: true, deletedAt: true } } }, orderBy: [{ total: "desc" }, { sortOrder: "asc" }] },
    },
    orderBy: [{ date: "desc" }],
    take,
  });
  const pids = matches.flatMap((m) => m.participants.map((p) => p.id));
  const quals = pids.length
    ? await db.qualification.findMany({ where: { tenantId, sourceParticipantId: { in: pids } }, select: { id: true, sourceParticipantId: true, kind: true, validUntil: true } })
    : [];
  const byPid = new Map<string, (typeof quals)[number][]>();
  for (const q of quals) {
    const list = byPid.get(q.sourceParticipantId!) ?? [];
    list.push(q);
    byPid.set(q.sourceParticipantId!, list);
  }
  return matches.map((m) => ({
    ...m,
    participants: m.participants.map((p) => ({ ...p, name: p.user?.name ?? p.guestName ?? "Gast", qualifications: byPid.get(p.id) ?? [] })),
  }));
}

/** Inhaber:innen von Qualifikationen der angegebenen Arten (für Übersicht und Ablaufliste). */
export async function listHolders(tenantId: string, kinds: string[]) {
  if (!kinds.length) return [];
  const rows = await db.qualification.findMany({
    where: { tenantId, kind: { in: kinds }, user: { deletedAt: null } },
    select: {
      id: true, kind: true, label: true, validFrom: true, validUntil: true, verifiedById: true, sourceParticipantId: true, createdAt: true,
      user: { select: { id: true, name: true } },
    },
    orderBy: [{ validUntil: "asc" }],
    take: 2000,
  });
  // Nur aktive Mitglieder (nicht ausgetreten)
  const active = new Set(
    (await db.membership.findMany({ where: { tenantId, status: { not: "LEFT" }, userId: { in: [...new Set(rows.map((r) => r.user.id))] } }, select: { userId: true } })).map((m) => m.userId),
  );
  const verifiers = await userNames(rows.map((r) => r.verifiedById));
  return rows.filter((r) => active.has(r.user.id)).map((r) => ({ ...r, verifiedByName: r.verifiedById ? verifiers.get(r.verifiedById) ?? null : null }));
}
export type HolderItem = Awaited<ReturnType<typeof listHolders>>[number];

/** Qualifikation mit Herkunft für den Nachweis (Druck). */
export async function getQualificationCertificate(tenantId: string, id: string) {
  const q = await db.qualification.findFirst({
    where: { id, tenantId },
    include: {
      user: { select: { name: true, birthDate: true, street: true, zip: true, city: true } },
      source: { select: { id: true, total: true, zeros: true, match: { select: { id: true, date: true, finishedAt: true, programId: true, program: { select: { name: true } } } } } },
    },
  });
  if (!q) return null;
  const names = await userNames([q.verifiedById]);
  // Anforderung als Momentaufnahme aus der Bemerkung (bei der Erteilung gespeichert), nicht aus der aktuellen Regel.
  const { note, requirement } = splitGrantNote(q.note);
  return { ...q, note, requirement, verifiedByName: q.verifiedById ? names.get(q.verifiedById) ?? null : null };
}

/** Kurslektion zu einem Kalendereintrag (für den Link «Zur Kurslektion» auf der Anlassseite). */
export async function courseSessionForEvent(tenantId: string, eventId: string) {
  return db.courseSession.findFirst({
    where: { eventId, course: { tenantId } },
    select: { id: true, title: true, courseId: true, course: { select: { name: true } } },
  });
}
