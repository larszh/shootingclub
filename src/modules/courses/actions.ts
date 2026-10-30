"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireModule } from "@/lib/tenant";
import { todayZurich, zurichParts, zurichToUtc } from "@/lib/time";
import { readCsvBytes } from "@/modules/members/import";
import { grantQualification } from "@/modules/qualifications/service";
import { QUALIFICATION_KINDS } from "@/modules/qualifications/types";
import {
  canComplete,
  completionMatrix,
  courseReferenceDay,
  dayToDbDate,
  dbDay,
  evaluateRule,
  guardianProblem,
  mapImportRows,
  parseIdCsv,
  participantKey,
  qualificationValidity,
  toIdCsv,
  type ImportedParticipant,
} from "./logic";
import { courseSchema, isCourseStatus, isParticipantStatus, participantSchema, resultSchema, ruleSchema, sessionSchema, COURSE_STATUS, PARTICIPANT_STATUS } from "./types";

const idSchema = z.string().min(1).max(40);
const NO_RIGHT = "Dafür fehlt dir die Berechtigung.";
const BAD = "Ungültige Anfrage.";
const str = (fd: FormData, k: string) => (fd.get(k) === null ? "" : String(fd.get(k)));
const bool = (fd: FormData, k: string) => ["on", "true", "1"].includes(str(fd, k));

const revalidate = () => revalidatePath("/courses", "layout");

async function manageCtx() {
  const ctx = await requireModule("courses");
  return ctx.can("courses.manage") ? ctx : null;
}

async function qualCtx() {
  const ctx = await requireModule("courses");
  return ctx.can("courses.manage") || ctx.can("qualifications.manage") ? ctx : null;
}

function zodFail(error: z.ZodError): ActionResult<never> {
  const issue = error.issues[0];
  return fail(issue?.message ?? "Ungültige Eingabe.", issue?.path[0] !== undefined ? { [String(issue.path[0])]: issue.message } : undefined);
}

async function isTenantMember(tenantId: string, userId: string) {
  const m = await db.membership.findFirst({ where: { tenantId, userId, status: { not: "LEFT" }, user: { deletedAt: null } }, select: { id: true } });
  return !!m;
}

async function accessibleProgramIds(tenantId: string, ids: string[]) {
  if (!ids.length) return [];
  const rows = await db.program.findMany({ where: { id: { in: ids }, OR: [{ tenantId: null }, { tenantId }] }, select: { id: true } });
  const ok = new Set(rows.map((r) => r.id));
  return ids.filter((id) => ok.has(id));
}

async function loadParticipant(tenantId: string, id: string) {
  if (!idSchema.safeParse(id).success) return null;
  return db.courseParticipant.findFirst({
    where: { id, course: { tenantId } },
    include: { course: { select: { id: true, name: true, startsOn: true, requiredProgramIds: true, tenantId: true } } },
  });
}

// --- Kurs ----------------------------------------------------------------------------------------------

export async function saveCourseAction(_prev: ActionResult<{ id: string }> | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const ctx = await manageCtx();
  if (!ctx) return fail(NO_RIGHT);
  const tenantId = ctx.tenant.id;
  const id = str(fd, "id") || null;
  if (id && !idSchema.safeParse(id).success) return fail(BAD);
  const parsed = courseSchema.safeParse({
    name: str(fd, "name"), kind: str(fd, "kind"), year: str(fd, "year"), startsOn: str(fd, "startsOn"), endsOn: str(fd, "endsOn"),
    leaderUserId: str(fd, "leaderUserId"), minParticipants: str(fd, "minParticipants"),
    requiredProgramIds: fd.getAll("programIds").map(String).filter(Boolean), notes: str(fd, "notes"), status: str(fd, "status") || "PLANNED",
  });
  if (!parsed.success) return zodFail(parsed.error);
  const v = parsed.data;
  if (v.leaderUserId && !(await isTenantMember(tenantId, v.leaderUserId))) return fail("Die Kursleitung muss Mitglied des Vereins sein.", { leaderUserId: "Bitte aus der Liste wählen." });
  const programIds = await accessibleProgramIds(tenantId, v.requiredProgramIds);
  const data = {
    name: v.name, kind: v.kind, year: v.year, startsOn: v.startsOn ? dayToDbDate(v.startsOn) : null, endsOn: v.endsOn ? dayToDbDate(v.endsOn) : null,
    leaderUserId: v.leaderUserId, minParticipants: v.minParticipants, requiredProgramIds: toIdCsv(programIds), notes: v.notes, status: v.status,
  };
  if (id) {
    const res = await db.course.updateMany({ where: { id, tenantId }, data });
    if (res.count === 0) return fail("Kurs nicht gefunden.");
    await audit({ tenantId, actorId: ctx.user.id, action: "courses.update", entity: "Course", entityId: id, detail: v.name });
    revalidate();
    return ok({ id }, "Gespeichert.");
  }
  const created = await db.course.create({ data: { ...data, tenantId }, select: { id: true } });
  await audit({ tenantId, actorId: ctx.user.id, action: "courses.create", entity: "Course", entityId: created.id, detail: `${v.name} (${v.kind}, ${v.year})` });
  revalidate();
  return ok({ id: created.id }, "Kurs erstellt.");
}

export async function setCourseStatusAction(id: string, status: string): Promise<ActionResult> {
  const ctx = await manageCtx();
  if (!ctx) return fail(NO_RIGHT);
  if (!idSchema.safeParse(id).success || !isCourseStatus(status)) return fail(BAD);
  const res = await db.course.updateMany({ where: { id, tenantId: ctx.tenant.id }, data: { status } });
  if (res.count === 0) return fail("Kurs nicht gefunden.");
  await audit({ tenantId: ctx.tenant.id, actorId: ctx.user.id, action: "courses.status", entity: "Course", entityId: id, detail: status });
  revalidate();
  return ok(undefined, `Status: ${COURSE_STATUS[status].label}.`);
}

export async function deleteCourseAction(id: string): Promise<ActionResult> {
  const ctx = await manageCtx();
  if (!ctx) return fail(NO_RIGHT);
  if (!idSchema.safeParse(id).success) return fail(BAD);
  const tenantId = ctx.tenant.id;
  const c = await db.course.findFirst({ where: { id, tenantId }, select: { name: true, sessions: { select: { eventId: true } } } });
  if (!c) return fail("Kurs nicht gefunden.");
  const eventIds = c.sessions.map((s) => s.eventId).filter((x): x is string => !!x);
  await db.$transaction([
    db.course.deleteMany({ where: { id, tenantId } }),
    db.event.deleteMany({ where: { id: { in: eventIds }, tenantId } }),
  ]);
  await audit({ tenantId, actorId: ctx.user.id, action: "courses.delete", entity: "Course", entityId: id, detail: c.name });
  revalidate();
  revalidatePath("/events", "layout");
  return ok(undefined, "Kurs gelöscht.");
}

// --- Teilnehmende ------------------------------------------------------------------------------------------

export async function saveParticipantAction(_prev: ActionResult<{ id: string }> | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const ctx = await manageCtx();
  if (!ctx) return fail(NO_RIGHT);
  const tenantId = ctx.tenant.id;
  const id = str(fd, "id") || null;
  const courseId = str(fd, "courseId");
  if (!idSchema.safeParse(courseId).success || (id && !idSchema.safeParse(id).success)) return fail(BAD);
  const course = await db.course.findFirst({ where: { id: courseId, tenantId }, select: { id: true, name: true, startsOn: true } });
  if (!course) return fail("Kurs nicht gefunden.");
  const parsed = participantSchema.safeParse({
    userId: str(fd, "userId"), firstName: str(fd, "firstName"), lastName: str(fd, "lastName"), birthDate: str(fd, "birthDate"), email: str(fd, "email"),
    phone: str(fd, "phone"), street: str(fd, "street"), zip: str(fd, "zip"), city: str(fd, "city"), guardianName: str(fd, "guardianName"),
    guardianEmail: str(fd, "guardianEmail"), guardianPhone: str(fd, "guardianPhone"), clubWeaponId: str(fd, "clubWeaponId"),
    status: str(fd, "status") || "REGISTERED", note: str(fd, "note"),
  });
  if (!parsed.success) return zodFail(parsed.error);
  const v = parsed.data;
  const today = todayZurich();
  if (v.birthDate && v.birthDate > today) return fail("Das Geburtsdatum liegt in der Zukunft.", { birthDate: "Bitte prüfen." });
  const gp = guardianProblem(v, courseReferenceDay(dbDay(course.startsOn), today));
  if (gp) return fail(gp, { guardianName: gp });
  if (v.userId) {
    if (!(await isTenantMember(tenantId, v.userId))) return fail("Mitglied nicht gefunden.");
    const dup = await db.courseParticipant.findFirst({ where: { courseId, userId: v.userId, ...(id ? { id: { not: id } } : {}) }, select: { id: true } });
    if (dup) return fail("Dieses Mitglied ist bereits im Kurs eingetragen.");
  }
  const current = id ? await db.courseParticipant.findFirst({ where: { id, courseId }, select: { clubWeaponId: true, status: true } }) : null;
  if (id && !current) return fail("Teilnehmer:in nicht gefunden.");
  if (v.status === "COMPLETED" && current?.status !== "COMPLETED") return fail("Den Abschluss bitte über «Kurs abschliessen» bestätigen.", { status: "Bitte anderen Status wählen." });
  if (v.clubWeaponId && v.clubWeaponId !== current?.clubWeaponId) {
    const w = await db.clubWeapon.findFirst({ where: { id: v.clubWeaponId, tenantId }, select: { status: true } });
    if (!w) return fail("Waffe nicht gefunden.");
    if (w.status !== "AVAILABLE") return fail("Diese Waffe ist zurzeit nicht verfügbar.", { clubWeaponId: "Bitte eine verfügbare Waffe wählen." });
  }
  const data = {
    userId: v.userId, firstName: v.firstName, lastName: v.lastName, birthDate: v.birthDate ? dayToDbDate(v.birthDate) : null, email: v.email, phone: v.phone,
    street: v.street, zip: v.zip, city: v.city, guardianName: v.guardianName, guardianEmail: v.guardianEmail, guardianPhone: v.guardianPhone,
    clubWeaponId: v.clubWeaponId, status: v.status, note: v.note,
  };
  const name = `${v.firstName} ${v.lastName}`;
  if (id) {
    await db.courseParticipant.updateMany({ where: { id, courseId }, data });
    await audit({ tenantId, actorId: ctx.user.id, action: "courses.participant.update", entity: "CourseParticipant", entityId: id, detail: `${course.name}: ${name}` });
    revalidate();
    return ok({ id }, "Gespeichert.");
  }
  const created = await db.courseParticipant.create({ data: { ...data, courseId }, select: { id: true } });
  await audit({ tenantId, actorId: ctx.user.id, action: "courses.participant.add", entity: "CourseParticipant", entityId: created.id, detail: `${course.name}: ${name}` });
  revalidate();
  return ok({ id: created.id }, `${name} hinzugefügt.`);
}

export async function setParticipantStatusAction(id: string, status: string): Promise<ActionResult> {
  const ctx = await manageCtx();
  if (!ctx) return fail(NO_RIGHT);
  if (!isParticipantStatus(status)) return fail(BAD);
  const p = await loadParticipant(ctx.tenant.id, id);
  if (!p) return fail("Teilnehmer:in nicht gefunden.");
  if (status === "COMPLETED") return completeParticipantAction(id);
  await db.courseParticipant.updateMany({ where: { id, courseId: p.courseId }, data: { status } });
  await audit({ tenantId: ctx.tenant.id, actorId: ctx.user.id, action: "courses.participant.status", entity: "CourseParticipant", entityId: id, detail: `${p.firstName} ${p.lastName}: ${p.status} → ${status}` });
  revalidate();
  return ok(undefined, `Status: ${PARTICIPANT_STATUS[status].label}.`);
}

/** Kursabschluss bestätigen: nur wenn alle Pflichtprogramme bestanden sind. */
export async function completeParticipantAction(id: string): Promise<ActionResult> {
  const ctx = await manageCtx();
  if (!ctx) return fail(NO_RIGHT);
  const p = await loadParticipant(ctx.tenant.id, id);
  if (!p) return fail("Teilnehmer:in nicht gefunden.");
  const required = parseIdCsv(p.course.requiredProgramIds);
  const results = await db.courseResult.findMany({ where: { participantId: id }, select: { programId: true, passed: true, score: true, date: true } });
  const row = completionMatrix([id], required, results.map((r) => ({ ...r, participantId: id, date: dbDay(r.date)! })))[0]!;
  if (!canComplete(row, p.status)) {
    if (p.status === "COMPLETED") return fail("Bereits abgeschlossen.");
    if (p.status === "DROPPED") return fail("Ausgetretene Teilnehmende können nicht abgeschlossen werden.");
    return fail(`Noch nicht alle Pflichtprogramme bestanden (${row.passedCount} von ${row.required}).`);
  }
  await db.courseParticipant.updateMany({ where: { id, courseId: p.courseId }, data: { status: "COMPLETED" } });
  await audit({ tenantId: ctx.tenant.id, actorId: ctx.user.id, action: "courses.participant.complete", entity: "CourseParticipant", entityId: id, detail: `${p.course.name}: ${p.firstName} ${p.lastName}` });
  revalidate();
  return ok(undefined, "Kurs als abgeschlossen bestätigt.");
}

export async function deleteParticipantAction(id: string): Promise<ActionResult> {
  const ctx = await manageCtx();
  if (!ctx) return fail(NO_RIGHT);
  const p = await loadParticipant(ctx.tenant.id, id);
  if (!p) return fail("Teilnehmer:in nicht gefunden.");
  await db.courseParticipant.deleteMany({ where: { id, courseId: p.courseId } });
  await audit({ tenantId: ctx.tenant.id, actorId: ctx.user.id, action: "courses.participant.delete", entity: "CourseParticipant", entityId: id, detail: `${p.course.name}: ${p.firstName} ${p.lastName}` });
  revalidate();
  return ok(undefined, "Entfernt.");
}

export type ImportPreview = { rows: (ImportedParticipant & { duplicate: boolean })[]; imported?: number };

/** CSV-Import: zuerst Vorschau (mode=preview), danach Übernahme (mode=import) der fehlerfreien, neuen Zeilen. */
export async function importParticipantsAction(_prev: ActionResult<ImportPreview> | null, fd: FormData): Promise<ActionResult<ImportPreview>> {
  const ctx = await manageCtx();
  if (!ctx) return fail(NO_RIGHT);
  const tenantId = ctx.tenant.id;
  const courseId = str(fd, "courseId");
  if (!idSchema.safeParse(courseId).success) return fail(BAD);
  const course = await db.course.findFirst({ where: { id: courseId, tenantId }, select: { id: true, name: true, startsOn: true, participants: { select: { firstName: true, lastName: true, birthDate: true } } } });
  if (!course) return fail("Kurs nicht gefunden.");
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("Bitte eine CSV-Datei wählen.", { file: "Bitte eine CSV-Datei wählen." });
  let table;
  try {
    table = readCsvBytes(new Uint8Array(await file.arrayBuffer()));
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Datei konnte nicht gelesen werden.");
  }
  if (table.rows.length > 500) return fail("Höchstens 500 Teilnehmende pro Import.");
  const today = todayZurich();
  const mapped = mapImportRows(table.headers, table.rows, courseReferenceDay(dbDay(course.startsOn), today), today);
  const existing = new Set(course.participants.map((p) => participantKey({ ...p, birthDate: dbDay(p.birthDate) })));
  const seen = new Set<string>();
  const rows = mapped.map((r) => {
    const key = participantKey(r);
    const duplicate = existing.has(key) || seen.has(key);
    seen.add(key);
    return { ...r, duplicate };
  });
  if (!rows.length) return fail("Keine Datenzeilen gefunden.");
  if (str(fd, "mode") !== "import") return ok({ rows });
  const good = rows.filter((r) => !r.errors.length && !r.duplicate);
  if (!good.length) return fail("Keine Zeile kann übernommen werden (Fehler oder bereits vorhanden).");
  await db.courseParticipant.createMany({
    data: good.map((r) => ({
      courseId, firstName: r.firstName, lastName: r.lastName, birthDate: r.birthDate ? dayToDbDate(r.birthDate) : null, email: r.email, phone: r.phone,
      guardianName: r.guardianName, guardianEmail: r.guardianEmail, guardianPhone: r.guardianPhone,
    })),
  });
  await audit({ tenantId, actorId: ctx.user.id, action: "courses.participant.import", entity: "Course", entityId: courseId, detail: `${course.name}: ${good.length} Teilnehmende importiert` });
  revalidate();
  return ok({ rows, imported: good.length }, `${good.length} Teilnehmende übernommen.`);
}

// --- Lektionen & Präsenz -------------------------------------------------------------------------------------

export async function createSessionAction(_prev: ActionResult<{ id: string }> | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const ctx = await manageCtx();
  if (!ctx) return fail(NO_RIGHT);
  const tenantId = ctx.tenant.id;
  const courseId = str(fd, "courseId");
  if (!idSchema.safeParse(courseId).success) return fail(BAD);
  const course = await db.course.findFirst({ where: { id: courseId, tenantId }, select: { id: true, name: true } });
  if (!course) return fail("Kurs nicht gefunden.");
  const parsed = sessionSchema.safeParse({
    title: str(fd, "title"), date: str(fd, "date"), startTime: str(fd, "startTime"), endTime: str(fd, "endTime"), createEvent: bool(fd, "createEvent"), location: str(fd, "location"),
  });
  if (!parsed.success) return zodFail(parsed.error);
  const v = parsed.data;
  const startsAt = zurichToUtc(v.date, v.startTime);
  const endsAt = v.endTime ? zurichToUtc(v.date, v.endTime) : null;
  const canEvents = ctx.hasModule("events");
  let eventId: string | null = null;
  if (v.createEvent && canEvents) {
    const ev = await db.event.create({
      data: {
        tenantId, createdById: ctx.user.id, title: `${course.name}: ${v.title}`.slice(0, 191), kind: "TRAINING", startsAt, endsAt, location: v.location,
        rsvpEnabled: false, description: `Kurslektion «${course.name}». Präsenz wird im Kurs erfasst.`,
      },
      select: { id: true },
    });
    eventId = ev.id;
  }
  const s = await db.courseSession.create({ data: { courseId, title: v.title, startsAt, endsAt, eventId }, select: { id: true } });
  await audit({ tenantId, actorId: ctx.user.id, action: "courses.session.create", entity: "CourseSession", entityId: s.id, detail: `${course.name}: ${v.title} ${v.date}` });
  revalidate();
  if (eventId) revalidatePath("/events", "layout");
  return ok({ id: s.id }, eventId ? "Lektion erstellt und im Kalender eingetragen." : "Lektion erstellt.");
}

export async function deleteSessionAction(id: string): Promise<ActionResult> {
  const ctx = await manageCtx();
  if (!ctx) return fail(NO_RIGHT);
  if (!idSchema.safeParse(id).success) return fail(BAD);
  const tenantId = ctx.tenant.id;
  const s = await db.courseSession.findFirst({ where: { id, course: { tenantId } }, select: { title: true, eventId: true, courseId: true } });
  if (!s) return fail("Lektion nicht gefunden.");
  await db.$transaction([
    db.courseSession.deleteMany({ where: { id, courseId: s.courseId } }),
    ...(s.eventId ? [db.event.deleteMany({ where: { id: s.eventId, tenantId } })] : []),
  ]);
  await audit({ tenantId, actorId: ctx.user.id, action: "courses.session.delete", entity: "CourseSession", entityId: id, detail: s.title });
  revalidate();
  if (s.eventId) revalidatePath("/events", "layout");
  return ok(undefined, "Lektion gelöscht.");
}

const attendanceSchema = z.array(z.object({ participantId: idSchema, present: z.boolean() })).max(500);

/** Präsenz einer Lektion speichern (alle übergebenen Teilnehmenden). */
export async function saveAttendanceAction(sessionId: string, entries: { participantId: string; present: boolean }[]): Promise<ActionResult> {
  const ctx = await manageCtx();
  if (!ctx) return fail(NO_RIGHT);
  const parsed = attendanceSchema.safeParse(entries);
  if (!idSchema.safeParse(sessionId).success || !parsed.success) return fail(BAD);
  const s = await db.courseSession.findFirst({ where: { id: sessionId, course: { tenantId: ctx.tenant.id } }, select: { id: true, courseId: true, title: true } });
  if (!s) return fail("Lektion nicht gefunden.");
  const valid = new Set((await db.courseParticipant.findMany({ where: { courseId: s.courseId }, select: { id: true } })).map((p) => p.id));
  const list = parsed.data.filter((e) => valid.has(e.participantId));
  await db.$transaction(
    list.map((e) =>
      db.courseAttendance.upsert({
        where: { sessionId_participantId: { sessionId, participantId: e.participantId } },
        create: { sessionId, participantId: e.participantId, present: e.present },
        update: { present: e.present },
      }),
    ),
  );
  revalidate();
  const present = list.filter((e) => e.present).length;
  return ok(undefined, `Präsenz gespeichert: ${present} von ${list.length} anwesend.`);
}

// --- Resultate ---------------------------------------------------------------------------------------------

export async function saveResultAction(input: { participantId: string; programId: string | null; label: string; score: string; passed: boolean; date: string }): Promise<ActionResult> {
  const ctx = await manageCtx();
  if (!ctx) return fail(NO_RIGHT);
  const parsed = resultSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const v = parsed.data;
  const p = await loadParticipant(ctx.tenant.id, v.participantId);
  if (!p) return fail("Teilnehmer:in nicht gefunden.");
  if (v.date > todayZurich()) return fail("Das Datum liegt in der Zukunft.", { date: "Bitte prüfen." });
  let label = v.label;
  if (v.programId) {
    const prog = await db.program.findFirst({ where: { id: v.programId, OR: [{ tenantId: null }, { tenantId: ctx.tenant.id }] }, select: { name: true } });
    if (!prog) return fail("Programm nicht gefunden.");
    label = prog.name;
  }
  if (!label) return fail("Bitte ein Programm wählen oder eine Bezeichnung angeben.", { label: "Bezeichnung fehlt." });
  const r = await db.courseResult.create({ data: { participantId: p.id, programId: v.programId, label: label.slice(0, 191), score: v.score, passed: v.passed, date: dayToDbDate(v.date) }, select: { id: true } });
  await audit({ tenantId: ctx.tenant.id, actorId: ctx.user.id, action: "courses.result.add", entity: "CourseResult", entityId: r.id, detail: `${p.firstName} ${p.lastName}: ${label} ${v.score ?? ""} ${v.passed ? "bestanden" : "nicht bestanden"}` });
  revalidate();
  return ok(undefined, "Resultat erfasst.");
}

/** Abgeschlossenen Durchgang des Mitglieds als Kursresultat übernehmen. */
export async function linkMatchResultAction(input: { participantId: string; matchParticipantId: string; passed: boolean }): Promise<ActionResult> {
  const ctx = await manageCtx();
  if (!ctx) return fail(NO_RIGHT);
  if (!idSchema.safeParse(input.matchParticipantId).success || typeof input.passed !== "boolean") return fail(BAD);
  const p = await loadParticipant(ctx.tenant.id, input.participantId);
  if (!p) return fail("Teilnehmer:in nicht gefunden.");
  if (!p.userId) return fail("Nur für Teilnehmende mit Konto möglich.");
  const mp = await db.matchParticipant.findFirst({
    where: { id: input.matchParticipantId, userId: p.userId, match: { tenantId: ctx.tenant.id, status: "FINISHED" } },
    select: { id: true, total: true, zeros: true, match: { select: { date: true, finishedAt: true, programId: true, program: { select: { name: true } } } } },
  });
  if (!mp) return fail("Durchgang nicht gefunden oder nicht abgeschlossen.");
  if (!parseIdCsv(p.course.requiredProgramIds).includes(mp.match.programId)) return fail("Dieses Programm ist kein Pflichtprogramm des Kurses.");
  if (await db.courseResult.findFirst({ where: { participantId: p.id, matchParticipantId: mp.id }, select: { id: true } })) return fail("Dieser Durchgang ist bereits verknüpft.");
  const day = zurichParts(mp.match.finishedAt ?? mp.match.date).dateStr;
  const r = await db.courseResult.create({
    data: { participantId: p.id, programId: mp.match.programId, label: mp.match.program.name.slice(0, 191), score: mp.total, passed: input.passed, date: dayToDbDate(day), matchParticipantId: mp.id },
    select: { id: true },
  });
  await audit({ tenantId: ctx.tenant.id, actorId: ctx.user.id, action: "courses.result.link", entity: "CourseResult", entityId: r.id, detail: `${p.firstName} ${p.lastName}: ${mp.match.program.name} ${mp.total ?? ""}` });
  revalidate();
  return ok(undefined, "Durchgang übernommen.");
}

export async function deleteResultAction(id: string): Promise<ActionResult> {
  const ctx = await manageCtx();
  if (!ctx) return fail(NO_RIGHT);
  if (!idSchema.safeParse(id).success) return fail(BAD);
  const r = await db.courseResult.findFirst({ where: { id, participant: { course: { tenantId: ctx.tenant.id } } }, select: { id: true, label: true, participantId: true } });
  if (!r) return fail("Resultat nicht gefunden.");
  await db.courseResult.deleteMany({ where: { id, participantId: r.participantId } });
  await audit({ tenantId: ctx.tenant.id, actorId: ctx.user.id, action: "courses.result.delete", entity: "CourseResult", entityId: id, detail: r.label });
  revalidate();
  return ok(undefined, "Resultat gelöscht.");
}

// --- Qualifikationsschiessen ----------------------------------------------------------------------------------

export async function saveRuleAction(_prev: ActionResult<{ id: string }> | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const ctx = await qualCtx();
  if (!ctx) return fail(NO_RIGHT);
  const tenantId = ctx.tenant.id;
  const id = str(fd, "id") || null;
  if (id && !idSchema.safeParse(id).success) return fail(BAD);
  const parsed = ruleSchema.safeParse({
    programId: str(fd, "programId"), name: str(fd, "name"), kind: str(fd, "kind") || "WEAPON_QUAL", passScore: str(fd, "passScore"), maxZeros: str(fd, "maxZeros"),
    validityMonths: str(fd, "validityMonths"), requireInstructor: bool(fd, "requireInstructor"), isActive: id ? bool(fd, "isActive") : true,
  });
  if (!parsed.success) return zodFail(parsed.error);
  const v = parsed.data;
  if (!QUALIFICATION_KINDS.some((k) => k.key === v.kind)) return fail("Ungültige Art.", { kind: "Bitte wählen." });
  if (!(await accessibleProgramIds(tenantId, [v.programId])).length) return fail("Programm nicht gefunden.", { programId: "Bitte wählen." });
  if (id) {
    const res = await db.qualificationRule.updateMany({ where: { id, tenantId }, data: v });
    if (res.count === 0) return fail("Regel nicht gefunden.");
    await audit({ tenantId, actorId: ctx.user.id, action: "qualifications.rule.update", entity: "QualificationRule", entityId: id, detail: `${v.name}: ab ${v.passScore} Pkt., max. ${v.maxZeros ?? "–"} Nuller, ${v.validityMonths} Mt.` });
    revalidate();
    return ok({ id }, "Gespeichert.");
  }
  const created = await db.qualificationRule.create({ data: { ...v, tenantId }, select: { id: true } });
  await audit({ tenantId, actorId: ctx.user.id, action: "qualifications.rule.create", entity: "QualificationRule", entityId: created.id, detail: v.name });
  revalidate();
  return ok({ id: created.id }, "Regel erstellt.");
}

export async function deleteRuleAction(id: string): Promise<ActionResult> {
  const ctx = await qualCtx();
  if (!ctx) return fail(NO_RIGHT);
  if (!idSchema.safeParse(id).success) return fail(BAD);
  const r = await db.qualificationRule.findFirst({ where: { id, tenantId: ctx.tenant.id }, select: { name: true } });
  if (!r) return fail("Regel nicht gefunden.");
  await db.qualificationRule.deleteMany({ where: { id, tenantId: ctx.tenant.id } });
  await audit({ tenantId: ctx.tenant.id, actorId: ctx.user.id, action: "qualifications.rule.delete", entity: "QualificationRule", entityId: id, detail: r.name });
  revalidate();
  return ok(undefined, "Regel gelöscht. Erteilte Qualifikationen bleiben bestehen.");
}

/**
 * Qualifikation aus einem abgeschlossenen Durchgang erteilen. Nur durch Ausbildner:innen (courses.manage);
 * bei «Ausbildner nötig» nicht für sich selbst. Gültig ab Schiesstag bis Schiesstag + Gültigkeit (Monate).
 */
export async function grantQualificationAction(ruleId: string, matchParticipantId: string): Promise<ActionResult> {
  const ctx = await requireModule("courses");
  if (!ctx.can("courses.manage")) return fail("Nur Ausbildner:innen (Kursleitung) können Qualifikationen erteilen.");
  if (!idSchema.safeParse(ruleId).success || !idSchema.safeParse(matchParticipantId).success) return fail(BAD);
  const tenantId = ctx.tenant.id;
  const rule = await db.qualificationRule.findFirst({ where: { id: ruleId, tenantId } });
  if (!rule) return fail("Regel nicht gefunden.");
  if (!rule.isActive) return fail("Diese Regel ist deaktiviert.");
  const mp = await db.matchParticipant.findFirst({
    where: { id: matchParticipantId, match: { tenantId, programId: rule.programId, status: "FINISHED" } },
    select: { id: true, userId: true, total: true, zeros: true, user: { select: { name: true, deletedAt: true } }, match: { select: { date: true, finishedAt: true } } },
  });
  if (!mp) return fail("Durchgang nicht gefunden oder nicht abgeschlossen.");
  if (!mp.userId || !mp.user || mp.user.deletedAt) return fail("Qualifikationen können nur Mitgliedern mit Konto erteilt werden.");
  if (!(await isTenantMember(tenantId, mp.userId))) return fail("Die Person ist nicht (mehr) Mitglied des Vereins.");
  if (rule.requireInstructor && mp.userId === ctx.user.id) return fail("Eine eigene Qualifikation muss von einer anderen Ausbildnerin bzw. einem anderen Ausbildner erteilt werden.");
  const ev = evaluateRule({ passScore: rule.passScore, maxZeros: rule.maxZeros }, { total: mp.total, zeros: mp.zeros });
  if (!ev.ok) return fail(`Regel nicht erfüllt: ${ev.reasons.join(" ")}`);
  const shotDay = zurichParts(mp.match.finishedAt ?? mp.match.date).dateStr;
  const validity = qualificationValidity(shotDay, rule.validityMonths);
  const q = await grantQualification({
    tenantId, userId: mp.userId, kind: rule.kind, label: rule.name, validFrom: dayToDbDate(validity.validFrom), validUntil: dayToDbDate(validity.validUntil),
    verifiedById: ctx.user.id, sourceParticipantId: mp.id, note: `${mp.total ?? "–"} Pkt., ${mp.zeros ?? "–"} Nuller`,
  });
  await audit({ tenantId, actorId: ctx.user.id, action: "qualifications.grant", entity: "Qualification", entityId: q.id, detail: `${mp.user.name}: ${rule.name} bis ${validity.validUntil}` });
  revalidate();
  return ok(undefined, `Qualifikation erteilt (gültig bis ${validity.validUntil.split("-").reverse().join(".")}).`);
}

/** Aus einem Qualifikationsschiessen erteilte Qualifikation zurückziehen. */
export async function revokeQualificationAction(id: string): Promise<ActionResult> {
  const ctx = await requireModule("courses");
  if (!ctx.can("courses.manage") && !ctx.can("qualifications.manage")) return fail(NO_RIGHT);
  if (!idSchema.safeParse(id).success) return fail(BAD);
  const q = await db.qualification.findFirst({ where: { id, tenantId: ctx.tenant.id, sourceParticipantId: { not: null } }, select: { label: true, user: { select: { name: true } } } });
  if (!q) return fail("Qualifikation nicht gefunden.");
  await db.qualification.deleteMany({ where: { id, tenantId: ctx.tenant.id } });
  await audit({ tenantId: ctx.tenant.id, actorId: ctx.user.id, action: "qualifications.revoke", entity: "Qualification", entityId: id, detail: `${q.user.name}: ${q.label ?? ""}` });
  revalidate();
  return ok(undefined, "Qualifikation zurückgezogen.");
}
