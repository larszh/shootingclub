"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { accessStatusWhere } from "@/lib/membership-access";
import { audit } from "@/lib/audit";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { getRequestLocale, getT, type TFunction } from "@/lib/i18n";
import { formatDate } from "@/lib/i18n/core";
import { tMsg } from "@/lib/i18n/extra/admin2/msg";
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
  grantNote,
  guardianProblem,
  mapImportRows,
  parseIdCsv,
  participantKey,
  qualificationValidity,
  toIdCsv,
  type ImportedParticipant,
} from "./logic";
import {
  courseSchema,
  isCourseStatus,
  isParticipantStatus,
  isProtectedQualKind,
  participantSchema,
  resultSchema,
  ruleSchema,
  sessionSchema,
  courseStatusInfo,
  participantStatusInfo,
} from "./types";

const idSchema = z.string().min(1).max(40);
/** Fehlende Berechtigung, in der Sprache der Person. */
async function noRight() {
  return fail(getT(await getRequestLocale())("money.err.noPermission"));
}
const PROTECTED_KIND = "adm2.courses.msg.protectedKind";
const BAD = "adm2.common.invalidRequest";
const tr = async () => getT(await getRequestLocale());
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

function zodFail(error: z.ZodError, t: TFunction): ActionResult<never> {
  const issue = error.issues[0];
  const m = tMsg(t, issue?.message ?? "adm2.common.invalidInput");
  return fail(m, issue?.path[0] !== undefined ? { [String(issue.path[0])]: m } : undefined);
}

async function isTenantMember(tenantId: string, userId: string) {
  const m = await db.membership.findFirst({ where: { tenantId, userId, status: accessStatusWhere(), user: { deletedAt: null } }, select: { id: true } });
  return !!m;
}

async function accessibleProgramIds(tenantId: string, ids: string[]) {
  if (!ids.length) return [];
  const rows = await db.program.findMany({ where: { id: { in: ids }, OR: [{ tenantId: null }, { tenantId }] }, select: { id: true } });
  const ok = new Set(rows.map((r) => r.id));
  return ids.filter((id) => ok.has(id));
}

/**
 * Abgeschlossene Teilnehmende, deren Pflichtprogramme nicht (mehr) alle bestanden sind (Resultat gelöscht,
 * Pflichtprogramme geändert), wieder auf «Aktiv» setzen. Gibt die Anzahl zurückgesetzter Personen zurück.
 */
async function reopenIncomplete(tenantId: string, actorId: string, course: { id: string; name: string; requiredProgramIds: string | null }, onlyParticipantId?: string): Promise<number> {
  const done = await db.courseParticipant.findMany({
    where: { courseId: course.id, status: "COMPLETED", ...(onlyParticipantId ? { id: onlyParticipantId } : {}) },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!done.length) return 0;
  const results = await db.courseResult.findMany({
    where: { participantId: { in: done.map((p) => p.id) } },
    select: { participantId: true, programId: true, passed: true, score: true, date: true },
  });
  const rows = completionMatrix(done.map((p) => p.id), parseIdCsv(course.requiredProgramIds), results.map((r) => ({ ...r, date: dbDay(r.date)! })));
  const reopen = new Set(rows.filter((r) => !r.allPassed).map((r) => r.participantId));
  if (!reopen.size) return 0;
  await db.courseParticipant.updateMany({ where: { id: { in: [...reopen] }, courseId: course.id, status: "COMPLETED" }, data: { status: "ACTIVE" } });
  for (const p of done.filter((x) => reopen.has(x.id))) {
    await audit({ tenantId, actorId, action: "courses.participant.reopen", entity: "CourseParticipant", entityId: p.id, detail: `${course.name}: ${p.firstName} ${p.lastName} – Pflichtprogramme nicht mehr erfüllt, Abschluss zurückgenommen` });
  }
  return reopen.size;
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
  const t = await tr();
  const ctx = await manageCtx();
  if (!ctx) return noRight();
  const tenantId = ctx.tenant.id;
  const id = str(fd, "id") || null;
  if (id && !idSchema.safeParse(id).success) return fail(t(BAD));
  const parsed = courseSchema.safeParse({
    name: str(fd, "name"), kind: str(fd, "kind"), year: str(fd, "year"), startsOn: str(fd, "startsOn"), endsOn: str(fd, "endsOn"),
    leaderUserId: str(fd, "leaderUserId"), minParticipants: str(fd, "minParticipants"),
    requiredProgramIds: fd.getAll("programIds").map(String).filter(Boolean), notes: str(fd, "notes"), status: str(fd, "status") || "PLANNED",
  });
  if (!parsed.success) return zodFail(parsed.error, t);
  const v = parsed.data;
  if (v.leaderUserId && !(await isTenantMember(tenantId, v.leaderUserId))) return fail(t("adm2.courses.msg.leaderMember"), { leaderUserId: t("adm2.courses.msg.chooseFromList") });
  const programIds = await accessibleProgramIds(tenantId, v.requiredProgramIds);
  const data = {
    name: v.name, kind: v.kind, year: v.year, startsOn: v.startsOn ? dayToDbDate(v.startsOn) : null, endsOn: v.endsOn ? dayToDbDate(v.endsOn) : null,
    leaderUserId: v.leaderUserId, minParticipants: v.minParticipants, requiredProgramIds: toIdCsv(programIds), notes: v.notes, status: v.status,
  };
  if (id) {
    const res = await db.course.updateMany({ where: { id, tenantId }, data });
    if (res.count === 0) return fail(t("adm2.courses.msg.courseNotFound"));
    await audit({ tenantId, actorId: ctx.user.id, action: "courses.update", entity: "Course", entityId: id, detail: v.name });
    const reopened = await reopenIncomplete(tenantId, ctx.user.id, { id, name: v.name, requiredProgramIds: data.requiredProgramIds });
    revalidate();
    return ok({ id }, reopened ? t("adm2.courses.msg.savedReopened", { n: reopened }) : t("adm2.common.saved"));
  }
  const created = await db.course.create({ data: { ...data, tenantId }, select: { id: true } });
  await audit({ tenantId, actorId: ctx.user.id, action: "courses.create", entity: "Course", entityId: created.id, detail: `${v.name} (${v.kind}, ${v.year})` });
  revalidate();
  return ok({ id: created.id }, t("adm2.courses.msg.courseCreated"));
}

export async function setCourseStatusAction(id: string, status: string): Promise<ActionResult> {
  const t = await tr();
  const ctx = await manageCtx();
  if (!ctx) return noRight();
  if (!idSchema.safeParse(id).success || !isCourseStatus(status)) return fail(t(BAD));
  const res = await db.course.updateMany({ where: { id, tenantId: ctx.tenant.id }, data: { status } });
  if (res.count === 0) return fail(t("adm2.courses.msg.courseNotFound"));
  await audit({ tenantId: ctx.tenant.id, actorId: ctx.user.id, action: "courses.status", entity: "Course", entityId: id, detail: status });
  revalidate();
  return ok(undefined, t("adm2.courses.msg.status", { label: courseStatusInfo(status, t).label }));
}

export async function deleteCourseAction(id: string): Promise<ActionResult> {
  const t = await tr();
  const ctx = await manageCtx();
  if (!ctx) return noRight();
  if (!idSchema.safeParse(id).success) return fail(t(BAD));
  const tenantId = ctx.tenant.id;
  const c = await db.course.findFirst({ where: { id, tenantId }, select: { name: true, sessions: { select: { eventId: true } } } });
  if (!c) return fail(t("adm2.courses.msg.courseNotFound"));
  const eventIds = c.sessions.map((s) => s.eventId).filter((x): x is string => !!x);
  await db.$transaction([
    db.course.deleteMany({ where: { id, tenantId } }),
    db.event.deleteMany({ where: { id: { in: eventIds }, tenantId } }),
  ]);
  await audit({ tenantId, actorId: ctx.user.id, action: "courses.delete", entity: "Course", entityId: id, detail: c.name });
  revalidate();
  revalidatePath("/events", "layout");
  return ok(undefined, t("adm2.courses.msg.courseDeleted"));
}

// --- Teilnehmende ------------------------------------------------------------------------------------------

export async function saveParticipantAction(_prev: ActionResult<{ id: string }> | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const t = await tr();
  const ctx = await manageCtx();
  if (!ctx) return noRight();
  const tenantId = ctx.tenant.id;
  const id = str(fd, "id") || null;
  const courseId = str(fd, "courseId");
  if (!idSchema.safeParse(courseId).success || (id && !idSchema.safeParse(id).success)) return fail(t(BAD));
  const course = await db.course.findFirst({ where: { id: courseId, tenantId }, select: { id: true, name: true, startsOn: true } });
  if (!course) return fail(t("adm2.courses.msg.courseNotFound"));
  const parsed = participantSchema.safeParse({
    userId: str(fd, "userId"), firstName: str(fd, "firstName"), lastName: str(fd, "lastName"), birthDate: str(fd, "birthDate"), email: str(fd, "email"),
    phone: str(fd, "phone"), street: str(fd, "street"), zip: str(fd, "zip"), city: str(fd, "city"), guardianName: str(fd, "guardianName"),
    guardianEmail: str(fd, "guardianEmail"), guardianPhone: str(fd, "guardianPhone"), clubWeaponId: str(fd, "clubWeaponId"),
    status: str(fd, "status") || "REGISTERED", note: str(fd, "note"),
  });
  if (!parsed.success) return zodFail(parsed.error, t);
  const v = parsed.data;
  const today = todayZurich();
  if (v.birthDate && v.birthDate > today) return fail(t("adm2.courses.msg.birthFuture"), { birthDate: t("adm2.courses.msg.check") });
  const gp = guardianProblem(v, courseReferenceDay(dbDay(course.startsOn), today), t);
  if (gp) return fail(gp, { guardianName: gp });
  if (v.userId) {
    if (!(await isTenantMember(tenantId, v.userId))) return fail(t("adm2.courses.msg.memberNotFound"));
    const dup = await db.courseParticipant.findFirst({ where: { courseId, userId: v.userId, ...(id ? { id: { not: id } } : {}) }, select: { id: true } });
    if (dup) return fail(t("adm2.courses.msg.memberDup"));
  }
  const current = id ? await db.courseParticipant.findFirst({ where: { id, courseId }, select: { clubWeaponId: true, status: true } }) : null;
  if (id && !current) return fail(t("adm2.courses.msg.participantNotFound"));
  if (v.status === "COMPLETED" && current?.status !== "COMPLETED") return fail(t("adm2.courses.msg.useComplete"), { status: t("adm2.courses.msg.otherStatus") });
  if (v.clubWeaponId && v.clubWeaponId !== current?.clubWeaponId) {
    const w = await db.clubWeapon.findFirst({ where: { id: v.clubWeaponId, tenantId }, select: { status: true } });
    if (!w) return fail(t("adm2.courses.msg.weaponNotFound"));
    if (w.status !== "AVAILABLE") return fail(t("adm2.courses.msg.weaponUnavailable"), { clubWeaponId: t("adm2.courses.msg.chooseAvailable") });
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
    return ok({ id }, t("adm2.common.saved"));
  }
  const created = await db.courseParticipant.create({ data: { ...data, courseId }, select: { id: true } });
  await audit({ tenantId, actorId: ctx.user.id, action: "courses.participant.add", entity: "CourseParticipant", entityId: created.id, detail: `${course.name}: ${name}` });
  revalidate();
  return ok({ id: created.id }, t("adm2.courses.msg.added", { name }));
}

export async function setParticipantStatusAction(id: string, status: string): Promise<ActionResult> {
  const t = await tr();
  const ctx = await manageCtx();
  if (!ctx) return noRight();
  if (!isParticipantStatus(status)) return fail(t(BAD));
  const p = await loadParticipant(ctx.tenant.id, id);
  if (!p) return fail(t("adm2.courses.msg.participantNotFound"));
  if (status === "COMPLETED") return completeParticipantAction(id);
  await db.courseParticipant.updateMany({ where: { id, courseId: p.courseId }, data: { status } });
  await audit({ tenantId: ctx.tenant.id, actorId: ctx.user.id, action: "courses.participant.status", entity: "CourseParticipant", entityId: id, detail: `${p.firstName} ${p.lastName}: ${p.status} → ${status}` });
  revalidate();
  return ok(undefined, t("adm2.courses.msg.status", { label: participantStatusInfo(status, t).label }));
}

/** Kursabschluss bestätigen: nur wenn alle Pflichtprogramme bestanden sind. */
export async function completeParticipantAction(id: string): Promise<ActionResult> {
  const t = await tr();
  const ctx = await manageCtx();
  if (!ctx) return noRight();
  const p = await loadParticipant(ctx.tenant.id, id);
  if (!p) return fail(t("adm2.courses.msg.participantNotFound"));
  const required = parseIdCsv(p.course.requiredProgramIds);
  const results = await db.courseResult.findMany({ where: { participantId: id }, select: { programId: true, passed: true, score: true, date: true } });
  const row = completionMatrix([id], required, results.map((r) => ({ ...r, participantId: id, date: dbDay(r.date)! })))[0]!;
  if (!canComplete(row, p.status)) {
    if (p.status === "COMPLETED") return fail(t("adm2.courses.msg.alreadyDone"));
    if (p.status === "DROPPED") return fail(t("adm2.courses.msg.droppedNo"));
    return fail(t("adm2.courses.msg.notAllPassed", { n: row.passedCount, total: row.required }));
  }
  await db.courseParticipant.updateMany({ where: { id, courseId: p.courseId }, data: { status: "COMPLETED" } });
  await audit({ tenantId: ctx.tenant.id, actorId: ctx.user.id, action: "courses.participant.complete", entity: "CourseParticipant", entityId: id, detail: `${p.course.name}: ${p.firstName} ${p.lastName}` });
  revalidate();
  return ok(undefined, t("adm2.courses.msg.completed"));
}

export async function deleteParticipantAction(id: string): Promise<ActionResult> {
  const t = await tr();
  const ctx = await manageCtx();
  if (!ctx) return noRight();
  const p = await loadParticipant(ctx.tenant.id, id);
  if (!p) return fail(t("adm2.courses.msg.participantNotFound"));
  await db.courseParticipant.deleteMany({ where: { id, courseId: p.courseId } });
  await audit({ tenantId: ctx.tenant.id, actorId: ctx.user.id, action: "courses.participant.delete", entity: "CourseParticipant", entityId: id, detail: `${p.course.name}: ${p.firstName} ${p.lastName}` });
  revalidate();
  return ok(undefined, t("adm2.courses.msg.removed"));
}

export type ImportPreview = { rows: (ImportedParticipant & { duplicate: boolean })[]; imported?: number };

/** CSV-Import: zuerst Vorschau (mode=preview), danach Übernahme (mode=import) der fehlerfreien, neuen Zeilen. */
export async function importParticipantsAction(_prev: ActionResult<ImportPreview> | null, fd: FormData): Promise<ActionResult<ImportPreview>> {
  const t = await tr();
  const ctx = await manageCtx();
  if (!ctx) return noRight();
  const tenantId = ctx.tenant.id;
  const courseId = str(fd, "courseId");
  if (!idSchema.safeParse(courseId).success) return fail(t(BAD));
  const course = await db.course.findFirst({ where: { id: courseId, tenantId }, select: { id: true, name: true, startsOn: true, participants: { select: { firstName: true, lastName: true, birthDate: true } } } });
  if (!course) return fail(t("adm2.courses.msg.courseNotFound"));
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return fail(t("adm2.courses.msg.chooseCsv"), { file: t("adm2.courses.msg.chooseCsv") });
  let table;
  try {
    table = readCsvBytes(new Uint8Array(await file.arrayBuffer()));
  } catch (e) {
    return fail(e instanceof Error ? e.message : t("adm2.courses.msg.readFailed"));
  }
  if (table.rows.length > 500) return fail(t("adm2.courses.msg.max500"));
  const today = todayZurich();
  const mapped = mapImportRows(table.headers, table.rows, courseReferenceDay(dbDay(course.startsOn), today), today, t);
  const existing = new Set(course.participants.map((p) => participantKey({ ...p, birthDate: dbDay(p.birthDate) })));
  const seen = new Set<string>();
  const rows = mapped.map((r) => {
    const key = participantKey(r);
    const duplicate = existing.has(key) || seen.has(key);
    seen.add(key);
    return { ...r, duplicate };
  });
  if (!rows.length) return fail(t("adm2.courses.msg.noRows"));
  if (str(fd, "mode") !== "import") return ok({ rows });
  const good = rows.filter((r) => !r.errors.length && !r.duplicate);
  if (!good.length) return fail(t("adm2.courses.msg.noneImportable"));
  await db.courseParticipant.createMany({
    data: good.map((r) => ({
      courseId, firstName: r.firstName, lastName: r.lastName, birthDate: r.birthDate ? dayToDbDate(r.birthDate) : null, email: r.email, phone: r.phone,
      guardianName: r.guardianName, guardianEmail: r.guardianEmail, guardianPhone: r.guardianPhone,
    })),
  });
  await audit({ tenantId, actorId: ctx.user.id, action: "courses.participant.import", entity: "Course", entityId: courseId, detail: `${course.name}: ${good.length} Teilnehmende importiert` });
  revalidate();
  return ok({ rows, imported: good.length }, t("adm2.courses.msg.imported", { n: good.length }));
}

// --- Lektionen & Präsenz -------------------------------------------------------------------------------------

export async function createSessionAction(_prev: ActionResult<{ id: string }> | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const t = await tr();
  const ctx = await manageCtx();
  if (!ctx) return noRight();
  const tenantId = ctx.tenant.id;
  const courseId = str(fd, "courseId");
  if (!idSchema.safeParse(courseId).success) return fail(t(BAD));
  const course = await db.course.findFirst({ where: { id: courseId, tenantId }, select: { id: true, name: true } });
  if (!course) return fail(t("adm2.courses.msg.courseNotFound"));
  const parsed = sessionSchema.safeParse({
    title: str(fd, "title"), date: str(fd, "date"), startTime: str(fd, "startTime"), endTime: str(fd, "endTime"), createEvent: bool(fd, "createEvent"), location: str(fd, "location"),
  });
  if (!parsed.success) return zodFail(parsed.error, t);
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
  return ok({ id: s.id }, eventId ? t("adm2.courses.msg.sessionCreatedEvent") : t("adm2.courses.msg.sessionCreated"));
}

export async function deleteSessionAction(id: string): Promise<ActionResult> {
  const t = await tr();
  const ctx = await manageCtx();
  if (!ctx) return noRight();
  if (!idSchema.safeParse(id).success) return fail(t(BAD));
  const tenantId = ctx.tenant.id;
  const s = await db.courseSession.findFirst({ where: { id, course: { tenantId } }, select: { title: true, eventId: true, courseId: true } });
  if (!s) return fail(t("adm2.courses.msg.sessionNotFound"));
  await db.$transaction([
    db.courseSession.deleteMany({ where: { id, courseId: s.courseId } }),
    ...(s.eventId ? [db.event.deleteMany({ where: { id: s.eventId, tenantId } })] : []),
  ]);
  await audit({ tenantId, actorId: ctx.user.id, action: "courses.session.delete", entity: "CourseSession", entityId: id, detail: s.title });
  revalidate();
  if (s.eventId) revalidatePath("/events", "layout");
  return ok(undefined, t("adm2.courses.msg.sessionDeleted"));
}

const attendanceSchema = z.array(z.object({ participantId: idSchema, present: z.boolean() })).max(500);

/** Präsenz einer Lektion speichern (alle übergebenen Teilnehmenden). */
export async function saveAttendanceAction(sessionId: string, entries: { participantId: string; present: boolean }[]): Promise<ActionResult> {
  const t = await tr();
  const ctx = await manageCtx();
  if (!ctx) return noRight();
  const parsed = attendanceSchema.safeParse(entries);
  if (!idSchema.safeParse(sessionId).success || !parsed.success) return fail(t(BAD));
  const s = await db.courseSession.findFirst({ where: { id: sessionId, course: { tenantId: ctx.tenant.id } }, select: { id: true, courseId: true, title: true } });
  if (!s) return fail(t("adm2.courses.msg.sessionNotFound"));
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
  return ok(undefined, t("adm2.courses.msg.attendanceSaved", { n: present, total: list.length }));
}

// --- Resultate ---------------------------------------------------------------------------------------------

export async function saveResultAction(input: { participantId: string; programId: string | null; label: string; score: string; passed: boolean; date: string }): Promise<ActionResult> {
  const t = await tr();
  const ctx = await manageCtx();
  if (!ctx) return noRight();
  const parsed = resultSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error, t);
  const v = parsed.data;
  const p = await loadParticipant(ctx.tenant.id, v.participantId);
  if (!p) return fail(t("adm2.courses.msg.participantNotFound"));
  if (v.date > todayZurich()) return fail(t("adm2.courses.msg.dateFuture"), { date: t("adm2.courses.msg.check") });
  let label = v.label;
  if (v.programId) {
    const prog = await db.program.findFirst({ where: { id: v.programId, OR: [{ tenantId: null }, { tenantId: ctx.tenant.id }] }, select: { name: true } });
    if (!prog) return fail(t("adm2.courses.msg.programNotFound"));
    label = prog.name;
  }
  if (!label) return fail(t("adm2.courses.msg.programOrLabel"), { label: t("adm2.courses.msg.labelMissing") });
  const r = await db.courseResult.create({ data: { participantId: p.id, programId: v.programId, label: label.slice(0, 191), score: v.score, passed: v.passed, date: dayToDbDate(v.date) }, select: { id: true } });
  await audit({ tenantId: ctx.tenant.id, actorId: ctx.user.id, action: "courses.result.add", entity: "CourseResult", entityId: r.id, detail: `${p.firstName} ${p.lastName}: ${label} ${v.score ?? ""} ${v.passed ? "bestanden" : "nicht bestanden"}` });
  revalidate();
  return ok(undefined, t("adm2.courses.msg.resultAdded"));
}

/** Abgeschlossenen Durchgang des Mitglieds als Kursresultat übernehmen. */
export async function linkMatchResultAction(input: { participantId: string; matchParticipantId: string; passed: boolean }): Promise<ActionResult> {
  const t = await tr();
  const ctx = await manageCtx();
  if (!ctx) return noRight();
  if (!idSchema.safeParse(input.matchParticipantId).success || typeof input.passed !== "boolean") return fail(t(BAD));
  const p = await loadParticipant(ctx.tenant.id, input.participantId);
  if (!p) return fail(t("adm2.courses.msg.participantNotFound"));
  if (!p.userId) return fail(t("adm2.courses.msg.onlyAccounts"));
  const mp = await db.matchParticipant.findFirst({
    where: { id: input.matchParticipantId, userId: p.userId, match: { tenantId: ctx.tenant.id, status: "FINISHED" } },
    select: { id: true, total: true, zeros: true, match: { select: { date: true, finishedAt: true, programId: true, program: { select: { name: true } } } } },
  });
  if (!mp) return fail(t("adm2.courses.msg.matchNotFound"));
  if (!parseIdCsv(p.course.requiredProgramIds).includes(mp.match.programId)) return fail(t("adm2.courses.msg.notRequired"));
  if (await db.courseResult.findFirst({ where: { participantId: p.id, matchParticipantId: mp.id }, select: { id: true } })) return fail(t("adm2.courses.msg.alreadyLinked"));
  const day = zurichParts(mp.match.finishedAt ?? mp.match.date).dateStr;
  const r = await db.courseResult.create({
    data: { participantId: p.id, programId: mp.match.programId, label: mp.match.program.name.slice(0, 191), score: mp.total, passed: input.passed, date: dayToDbDate(day), matchParticipantId: mp.id },
    select: { id: true },
  });
  await audit({ tenantId: ctx.tenant.id, actorId: ctx.user.id, action: "courses.result.link", entity: "CourseResult", entityId: r.id, detail: `${p.firstName} ${p.lastName}: ${mp.match.program.name} ${mp.total ?? ""}` });
  revalidate();
  return ok(undefined, t("adm2.courses.msg.matchTaken"));
}

export async function deleteResultAction(id: string): Promise<ActionResult> {
  const t = await tr();
  const ctx = await manageCtx();
  if (!ctx) return noRight();
  if (!idSchema.safeParse(id).success) return fail(t(BAD));
  const r = await db.courseResult.findFirst({
    where: { id, participant: { course: { tenantId: ctx.tenant.id } } },
    select: { id: true, label: true, participantId: true, participant: { select: { course: { select: { id: true, name: true, requiredProgramIds: true } } } } },
  });
  if (!r) return fail(t("adm2.courses.msg.resultNotFound"));
  await db.courseResult.deleteMany({ where: { id, participantId: r.participantId } });
  await audit({ tenantId: ctx.tenant.id, actorId: ctx.user.id, action: "courses.result.delete", entity: "CourseResult", entityId: id, detail: r.label });
  const reopened = await reopenIncomplete(ctx.tenant.id, ctx.user.id, r.participant.course, r.participantId);
  revalidate();
  return ok(undefined, reopened ? t("adm2.courses.msg.resultDeletedReopened") : t("adm2.courses.msg.resultDeleted"));
}

// --- Qualifikationsschiessen ----------------------------------------------------------------------------------

export async function saveRuleAction(_prev: ActionResult<{ id: string }> | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const t = await tr();
  const ctx = await qualCtx();
  if (!ctx) return noRight();
  const tenantId = ctx.tenant.id;
  const id = str(fd, "id") || null;
  if (id && !idSchema.safeParse(id).success) return fail(t(BAD));
  const parsed = ruleSchema.safeParse({
    programId: str(fd, "programId"), name: str(fd, "name"), kind: str(fd, "kind") || "WEAPON_QUAL", passScore: str(fd, "passScore"), maxZeros: str(fd, "maxZeros"),
    validityMonths: str(fd, "validityMonths"), requireInstructor: bool(fd, "requireInstructor"), isActive: id ? bool(fd, "isActive") : true,
  });
  if (!parsed.success) return zodFail(parsed.error, t);
  const v = parsed.data;
  if (!QUALIFICATION_KINDS.some((k) => k.key === v.kind)) return fail(t("adm2.courses.msg.invalidKind"), { kind: t("adm2.courses.msg.choose") });
  const isQualAdmin = ctx.can("qualifications.manage");
  if (isProtectedQualKind(v.kind) && !isQualAdmin) return fail(t(PROTECTED_KIND), { kind: t("adm2.courses.msg.chooseTrainerKind") });
  // Sicherheits- und Leiterqualifikationen: immer Vier-Augen-Prinzip und eine echte Mindestpunktzahl.
  if (isProtectedQualKind(v.kind)) {
    if (v.passScore <= 0) return fail(t("adm2.courses.msg.passScoreNeeded"), { passScore: t("adm2.courses.msg.enterPassScore") });
    v.requireInstructor = true;
  }
  if (!(await accessibleProgramIds(tenantId, [v.programId])).length) return fail(t("adm2.courses.msg.programNotFound"), { programId: t("adm2.courses.msg.choose") });
  if (id && !isQualAdmin) {
    const cur = await db.qualificationRule.findFirst({ where: { id, tenantId }, select: { kind: true } });
    if (!cur) return fail(t("adm2.courses.msg.ruleNotFound"));
    if (isProtectedQualKind(cur.kind)) return fail(t(PROTECTED_KIND));
  }
  if (id) {
    const res = await db.qualificationRule.updateMany({ where: { id, tenantId }, data: v });
    if (res.count === 0) return fail(t("adm2.courses.msg.ruleNotFound"));
    await audit({ tenantId, actorId: ctx.user.id, action: "qualifications.rule.update", entity: "QualificationRule", entityId: id, detail: `${v.name}: ab ${v.passScore} Pkt., max. ${v.maxZeros ?? "–"} Nuller, ${v.validityMonths} Mt.` });
    revalidate();
    return ok({ id }, t("adm2.common.saved"));
  }
  const created = await db.qualificationRule.create({ data: { ...v, tenantId }, select: { id: true } });
  await audit({ tenantId, actorId: ctx.user.id, action: "qualifications.rule.create", entity: "QualificationRule", entityId: created.id, detail: v.name });
  revalidate();
  return ok({ id: created.id }, t("adm2.courses.msg.ruleCreated"));
}

export async function deleteRuleAction(id: string): Promise<ActionResult> {
  const t = await tr();
  const ctx = await qualCtx();
  if (!ctx) return noRight();
  if (!idSchema.safeParse(id).success) return fail(t(BAD));
  const r = await db.qualificationRule.findFirst({ where: { id, tenantId: ctx.tenant.id }, select: { name: true, kind: true } });
  if (!r) return fail(t("adm2.courses.msg.ruleNotFound"));
  if (isProtectedQualKind(r.kind) && !ctx.can("qualifications.manage")) return fail(t(PROTECTED_KIND));
  await db.qualificationRule.deleteMany({ where: { id, tenantId: ctx.tenant.id } });
  await audit({ tenantId: ctx.tenant.id, actorId: ctx.user.id, action: "qualifications.rule.delete", entity: "QualificationRule", entityId: id, detail: r.name });
  revalidate();
  return ok(undefined, t("adm2.courses.msg.ruleDeleted"));
}

/**
 * Qualifikation aus einem abgeschlossenen Durchgang erteilen. Nur durch Ausbildner:innen (courses.manage);
 * bei «Ausbildner nötig» nicht für sich selbst. Gültig ab Schiesstag bis Schiesstag + Gültigkeit (Monate).
 */
export async function grantQualificationAction(ruleId: string, matchParticipantId: string): Promise<ActionResult> {
  const t = await tr();
  const ctx = await requireModule("courses");
  if (!ctx.can("courses.manage")) return fail(t("adm2.courses.msg.onlyInstructors"));
  if (!idSchema.safeParse(ruleId).success || !idSchema.safeParse(matchParticipantId).success) return fail(t(BAD));
  const tenantId = ctx.tenant.id;
  const rule = await db.qualificationRule.findFirst({ where: { id: ruleId, tenantId } });
  if (!rule) return fail(t("adm2.courses.msg.ruleNotFound"));
  if (!rule.isActive) return fail(t("adm2.courses.msg.ruleInactive"));
  const protectedKind = isProtectedQualKind(rule.kind);
  if (protectedKind && !ctx.can("qualifications.manage")) return fail(t(PROTECTED_KIND));
  const mp = await db.matchParticipant.findFirst({
    where: { id: matchParticipantId, match: { tenantId, programId: rule.programId, status: "FINISHED" } },
    select: { id: true, userId: true, total: true, zeros: true, user: { select: { name: true, deletedAt: true } }, match: { select: { date: true, finishedAt: true } } },
  });
  if (!mp) return fail(t("adm2.courses.msg.matchNotFound"));
  if (!mp.userId || !mp.user || mp.user.deletedAt) return fail(t("adm2.courses.msg.onlyMembers"));
  if (!(await isTenantMember(tenantId, mp.userId))) return fail(t("adm2.courses.msg.notMember"));
  if ((rule.requireInstructor || protectedKind) && mp.userId === ctx.user.id) return fail(t("adm2.courses.msg.ownQual"));
  const ev = evaluateRule({ passScore: rule.passScore, maxZeros: rule.maxZeros }, { total: mp.total, zeros: mp.zeros }, t);
  if (!ev.ok) return fail(t("adm2.courses.msg.ruleNotMet", { reasons: ev.reasons.join(" ") }));
  const shotDay = zurichParts(mp.match.finishedAt ?? mp.match.date).dateStr;
  const validity = qualificationValidity(shotDay, rule.validityMonths);
  const q = await grantQualification({
    tenantId, userId: mp.userId, kind: rule.kind, label: rule.name, validFrom: dayToDbDate(validity.validFrom), validUntil: dayToDbDate(validity.validUntil),
    verifiedById: ctx.user.id, sourceParticipantId: mp.id, note: grantNote({ total: mp.total, zeros: mp.zeros }, { passScore: rule.passScore, maxZeros: rule.maxZeros }),
  });
  await audit({ tenantId, actorId: ctx.user.id, action: "qualifications.grant", entity: "Qualification", entityId: q.id, detail: `${mp.user.name}: ${rule.name} bis ${validity.validUntil}` });
  revalidate();
  return ok(undefined, t("adm2.courses.msg.granted", { date: formatDate(new Date(`${validity.validUntil}T12:00:00Z`), await getRequestLocale(), { timeZone: "UTC" }) }));
}

/** Aus einem Qualifikationsschiessen erteilte Qualifikation zurückziehen. */
export async function revokeQualificationAction(id: string): Promise<ActionResult> {
  const t = await tr();
  const ctx = await requireModule("courses");
  if (!ctx.can("courses.manage") && !ctx.can("qualifications.manage")) return noRight();
  if (!idSchema.safeParse(id).success) return fail(t(BAD));
  const q = await db.qualification.findFirst({ where: { id, tenantId: ctx.tenant.id, sourceParticipantId: { not: null } }, select: { label: true, user: { select: { name: true } } } });
  if (!q) return fail(t("adm2.courses.msg.qualNotFound"));
  await db.qualification.deleteMany({ where: { id, tenantId: ctx.tenant.id } });
  await audit({ tenantId: ctx.tenant.id, actorId: ctx.user.id, action: "qualifications.revoke", entity: "Qualification", entityId: id, detail: `${q.user.name}: ${q.label ?? ""}` });
  revalidate();
  return ok(undefined, t("adm2.courses.msg.revoked"));
}
