"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { getRequestLocale, getT, getTenantLocale, getUserLocale, type TFunction } from "@/lib/i18n";
import { formatDate, formatMoneyLocale } from "@/lib/i18n/core";
import { tMsg } from "@/lib/i18n/extra/admin2/msg";
import { requireModule } from "@/lib/tenant";
import { formatTimeRange, zurichParts, zurichToUtc } from "@/lib/time";
import { formatMoney } from "@/lib/money";
import { createStandaloneFeeInvoice, finalizeStandaloneFeeInvoices, standaloneInvoiceDefaults } from "@/modules/billing/standalone-invoice";
import { isQualificationKind } from "@/modules/qualifications/types";
import {
  MAX_COPIES, addDayKey, canSelfSignUp, canSelfWithdraw, dayOffset, defaultShiftHours, ersatzCategoryName, ersatzCategoryPrefix, expandTemplateDates, formatHours,
  isAssignmentStatus, roundHours, staffing,
} from "./logic";
import { getWorkSettings, hoursOverview } from "./queries";
import { accessStatusWhere } from "@/lib/membership-access";
import { copySchema, firstIssue, settingsSchema, shiftSchema, workLogSchema } from "./types";

const idSchema = z.string().min(1).max(40);
/** Fehlende Berechtigung, in der Sprache der Person. */
async function noRight() {
  return fail(getT(await getRequestLocale())("money.err.noPermission"));
}
const tr = async () => getT(await getRequestLocale());
const issueFail = (t: TFunction, err: z.ZodError) => {
  const i = firstIssue(err);
  const m = tMsg(t, i.message);
  return fail(m, i.field ? { [i.field]: m } : undefined);
};
const str = (fd: FormData, k: string) => (fd.get(k) === null ? "" : String(fd.get(k)));

const revalidate = () => {
  revalidatePath("/shifts", "layout");
  revalidatePath("/admin/shifts", "layout");
};

async function memberCtx() {
  return requireModule("shifts");
}

async function manageCtx() {
  const ctx = await requireModule("shifts");
  return ctx.can("shifts.manage") ? ctx : null;
}

function handle(e: unknown, t: TFunction): ActionResult<never> {
  console.error("Helfereinsätze:", e);
  return fail(t("adm2.common.failed"));
}

const isUniqueError = (e: unknown) => typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";

/** Datum + Uhrzeiten (Schweizer Zeit) → Beginn/Ende; Ende vor Beginn = am Folgetag. */
function toRange(date: string, startTime: string, endTime: string) {
  const startsAt = zurichToUtc(date, startTime);
  let endsAt = zurichToUtc(date, endTime);
  if (endsAt.getTime() <= startsAt.getTime()) endsAt = zurichToUtc(addDayKey(date, 1), endTime);
  return { startsAt, endsAt };
}

/** Aktive Mitglieder (nicht ausgetreten, nicht wartend auf Freigabe, Konto nicht gelöscht) aus einer Liste von Benutzer-IDs. */
async function activeMemberIds(tenantId: string, userIds: string[]) {
  const rows = await db.membership.findMany({
    where: { tenantId, userId: { in: userIds }, status: accessStatusWhere(), user: { deletedAt: null } },
    select: { userId: true, user: { select: { name: true } } },
  });
  return rows;
}

// ---------------------------------------------------------------------------
// Einsätze planen (shifts.manage)
// ---------------------------------------------------------------------------

export async function saveShiftAction(_prev: ActionResult<{ id: string }> | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const t = await tr();
  const ctx = await manageCtx();
  if (!ctx) return noRight();
  const id = str(fd, "id") || null;
  if (id && !idSchema.safeParse(id).success) return fail(t("adm2.common.invalidRequest"));
  const parsed = shiftSchema.safeParse({
    title: str(fd, "title"), eventId: str(fd, "eventId"), date: str(fd, "date"), startTime: str(fd, "startTime"), endTime: str(fd, "endTime"),
    capacity: str(fd, "capacity"), requiredQualification: str(fd, "requiredQualification"), hoursCredit: str(fd, "hoursCredit"), note: str(fd, "note"),
  });
  if (!parsed.success) return issueFail(t, parsed.error);
  const v = parsed.data;
  const tenantId = ctx.tenant.id;
  if (v.requiredQualification && !isQualificationKind(v.requiredQualification)) return fail(t("adm2.shifts.msg.unknownQual"), { requiredQualification: t("adm2.shifts.msg.unknownQual") });
  if (v.eventId) {
    const ev = await db.event.findFirst({ where: { id: v.eventId, tenantId }, select: { id: true } });
    if (!ev) return fail(t("adm2.shifts.msg.eventNotFound"), { eventId: t("adm2.shifts.msg.eventNotFound") });
  }
  const { startsAt, endsAt } = toRange(v.date, v.startTime, v.endTime);
  if (endsAt.getTime() - startsAt.getTime() > 24 * 3_600_000) return fail(t("adm2.shifts.msg.max24"), { endTime: t("adm2.shifts.msg.max24Short") });
  const data = { title: v.title, eventId: v.eventId, startsAt, endsAt, capacity: v.capacity, requiredQualification: v.requiredQualification, hoursCredit: v.hoursCredit, note: v.note };
  try {
    if (id) {
      const res = await db.shift.updateMany({ where: { id, tenantId }, data });
      if (!res.count) return fail(t("adm2.shifts.msg.notFound"));
      await audit({ tenantId, actorId: ctx.user.id, actorName: ctx.user.name, action: "shifts.update", entity: "Shift", entityId: id, detail: `${v.title} · ${v.date} ${v.startTime}–${v.endTime}` });
      revalidate();
      return ok({ id }, t("adm2.common.saved"));
    }
    const created = await db.shift.create({ data: { ...data, tenantId }, select: { id: true } });
    await audit({ tenantId, actorId: ctx.user.id, actorName: ctx.user.name, action: "shifts.create", entity: "Shift", entityId: created.id, detail: `${v.title} · ${v.date} ${v.startTime}–${v.endTime}` });
    revalidate();
    return ok({ id: created.id }, t("adm2.shifts.msg.created"));
  } catch (e) {
    return handle(e, t);
  }
}

export async function deleteShiftAction(id: string): Promise<ActionResult> {
  const t = await tr();
  const ctx = await manageCtx();
  if (!ctx) return noRight();
  if (!idSchema.safeParse(id).success) return fail(t("adm2.common.invalidRequest"));
  const tenantId = ctx.tenant.id;
  const s = await db.shift.findFirst({ where: { id, tenantId }, select: { title: true, startsAt: true, assignments: { where: { status: "DONE" }, select: { id: true } } } });
  if (!s) return fail(t("adm2.shifts.msg.notFound"));
  await db.shift.deleteMany({ where: { id, tenantId } });
  await audit({
    tenantId, actorId: ctx.user.id, actorName: ctx.user.name, action: "shifts.delete", entity: "Shift", entityId: id,
    detail: `${s.title} · ${zurichParts(s.startsAt).dateStr}${s.assignments.length ? ` (${s.assignments.length} bestätigte Einsätze entfernt)` : ""}`,
  });
  revalidate();
  return ok(undefined, t("adm2.shifts.msg.deleted"));
}

/** Vorlage auf mehrere Daten kopieren (gleiche Uhrzeit, Besetzung, Anforderung; ohne Anlass und ohne Einteilungen). */
export async function copyShiftAction(id: string, input: { from: string; to: string; weekdays: number[]; everyWeeks: number }): Promise<ActionResult<{ count: number }>> {
  const t = await tr();
  const ctx = await manageCtx();
  if (!ctx) return noRight();
  if (!idSchema.safeParse(id).success) return fail(t("adm2.common.invalidRequest"));
  const parsed = copySchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error).message);
  const tenantId = ctx.tenant.id;
  const s = await db.shift.findFirst({ where: { id, tenantId } });
  if (!s) return fail(t("adm2.shifts.msg.notFound"));
  const start = zurichParts(s.startsAt);
  const end = zurichParts(s.endsAt);
  const endOffset = dayOffset(start.dateStr, end.dateStr);
  const dates = expandTemplateDates({ ...parsed.data, exclude: [start.dateStr], max: MAX_COPIES });
  if (!dates.length) return fail(t("adm2.shifts.msg.noDays"));
  // Bereits vorhandene Einsätze mit gleicher Bezeichnung und Beginn nicht doppelt anlegen
  const planned = dates.map((d) => ({ day: d, startsAt: zurichToUtc(d, start.timeStr), endsAt: zurichToUtc(addDayKey(d, endOffset), end.timeStr) }));
  const existing = await db.shift.findMany({ where: { tenantId, title: s.title, startsAt: { in: planned.map((p) => p.startsAt) } }, select: { startsAt: true } });
  const taken = new Set(existing.map((e) => e.startsAt.getTime()));
  const rows = planned.filter((p) => !taken.has(p.startsAt.getTime()) && p.endsAt > p.startsAt);
  if (rows.length) {
    await db.shift.createMany({
      data: rows.map((p) => ({ tenantId, title: s.title, eventId: null, startsAt: p.startsAt, endsAt: p.endsAt, capacity: s.capacity, requiredQualification: s.requiredQualification, hoursCredit: s.hoursCredit, note: s.note })),
    });
  }
  await audit({ tenantId, actorId: ctx.user.id, actorName: ctx.user.name, action: "shifts.copy", entity: "Shift", entityId: id, detail: `${s.title}: ${rows.length} Kopien (${dates[0]} bis ${dates[dates.length - 1]})` });
  revalidate();
  const skipped = dates.length - rows.length;
  return ok({ count: rows.length }, `${t(rows.length === 1 ? "adm2.shifts.msg.copied.one" : "adm2.shifts.msg.copied.other", { n: rows.length })}${skipped ? t("adm2.shifts.msg.copiedSkipped", { n: skipped }) : ""}.`);
}

// ---------------------------------------------------------------------------
// Einteilen und bestätigen (shifts.manage)
// ---------------------------------------------------------------------------

export async function assignMembersAction(shiftId: string, userIds: string[]): Promise<ActionResult> {
  const t = await tr();
  const ctx = await manageCtx();
  if (!ctx) return noRight();
  if (!idSchema.safeParse(shiftId).success || !z.array(idSchema).min(1).max(200).safeParse(userIds).success) return fail(t("adm2.shifts.msg.chooseMember"));
  const tenantId = ctx.tenant.id;
  const s = await db.shift.findFirst({ where: { id: shiftId, tenantId }, select: { id: true, title: true, startsAt: true, endsAt: true, assignments: { select: { userId: true } } } });
  if (!s) return fail(t("adm2.shifts.msg.notFound"));
  const already = new Set(s.assignments.map((a) => a.userId));
  const members = (await activeMemberIds(tenantId, userIds)).filter((m) => !already.has(m.userId));
  if (!members.length) return fail(t("adm2.shifts.msg.alreadyAssigned"));
  await db.shiftAssignment.createMany({ data: members.map((m) => ({ shiftId, userId: m.userId, status: "ASSIGNED" })), skipDuplicates: true });
  await audit({ tenantId, actorId: ctx.user.id, actorName: ctx.user.name, action: "shifts.assign", entity: "Shift", entityId: shiftId, detail: `${s.title}: ${members.map((m) => m.user.name).join(", ")}`.slice(0, 1900) });
  if (s.startsAt > new Date()) {
    const locale = await getTenantLocale(tenantId);
    const tn = getT(locale);
    await notify({
      tenantId, userIds: members.map((m) => m.userId), topic: "shifts",
      title: tn("adm2.shifts.msg.notifyAssigned"),
      body: tn("adm2.shifts.msg.notifyAssignedBody", { title: s.title, date: formatDate(s.startsAt, locale, { weekday: "short" }), time: formatTimeRange(s.startsAt, s.endsAt) }),
      url: "/shifts?tab=mine", tag: `shift:${s.id}`,
    });
  }
  revalidate();
  return ok(undefined, t(members.length === 1 ? "adm2.shifts.msg.assigned.one" : "adm2.shifts.msg.assigned.other", { n: members.length }));
}

export async function removeAssignmentAction(assignmentId: string): Promise<ActionResult> {
  const t = await tr();
  const ctx = await manageCtx();
  if (!ctx) return noRight();
  if (!idSchema.safeParse(assignmentId).success) return fail(t("adm2.common.invalidRequest"));
  const tenantId = ctx.tenant.id;
  const a = await db.shiftAssignment.findFirst({ where: { id: assignmentId, shift: { tenantId } }, select: { id: true, status: true, user: { select: { name: true } }, shift: { select: { id: true, title: true } } } });
  if (!a) return fail(t("adm2.shifts.msg.assignmentNotFound"));
  await db.shiftAssignment.delete({ where: { id: a.id } });
  await audit({ tenantId, actorId: ctx.user.id, actorName: ctx.user.name, action: "shifts.unassign", entity: "Shift", entityId: a.shift.id, detail: `${a.shift.title}: ${a.user.name} entfernt${a.status === "DONE" ? " (war bestätigt)" : ""}` });
  revalidate();
  return ok(undefined, t("adm2.shifts.msg.unassigned"));
}

const hoursInput = z.number().min(0).max(24).nullable();

/** Einteilung bestätigen: DONE (mit Stunden), NO_SHOW oder zurück auf ASSIGNED. */
export async function setAssignmentStatusAction(assignmentId: string, status: string, hours?: number | null): Promise<ActionResult> {
  const t = await tr();
  const ctx = await manageCtx();
  if (!ctx) return noRight();
  if (!idSchema.safeParse(assignmentId).success || !isAssignmentStatus(status)) return fail(t("adm2.common.invalidRequest"));
  const h = hoursInput.safeParse(hours ?? null);
  if (!h.success) return fail(t("adm2.shifts.msg.hoursRange"));
  const tenantId = ctx.tenant.id;
  const a = await db.shiftAssignment.findFirst({
    where: { id: assignmentId, shift: { tenantId } },
    select: { id: true, status: true, hours: true, user: { select: { name: true } }, shift: { select: { id: true, title: true, startsAt: true, endsAt: true, hoursCredit: true } } },
  });
  if (!a) return fail(t("adm2.shifts.msg.assignmentNotFound"));
  const value = status === "DONE" ? roundHours(h.data ?? defaultShiftHours(a.shift)) : null;
  await db.shiftAssignment.update({ where: { id: a.id }, data: { status, hours: value, confirmedById: status === "ASSIGNED" ? null : ctx.user.id } });
  const label = status === "DONE" ? `erledigt, ${formatHours(value!)} h` : status === "NO_SHOW" ? "nicht erschienen" : "zurückgesetzt";
  await audit({ tenantId, actorId: ctx.user.id, actorName: ctx.user.name, action: "shifts.confirm", entity: "ShiftAssignment", entityId: a.id, detail: `${a.shift.title} · ${a.user.name}: ${label}` });
  revalidate();
  return ok(undefined, status === "DONE" ? t("adm2.shifts.msg.confirmedHours", { name: a.user.name, h: formatHours(value!) }) : status === "NO_SHOW" ? t("adm2.shifts.msg.noShow", { name: a.user.name }) : t("adm2.shifts.msg.reset"));
}

/** Alle noch offenen Einteilungen eines (begonnenen) Einsatzes als erledigt mit Standardstunden bestätigen. */
export async function confirmAllDoneAction(shiftId: string): Promise<ActionResult> {
  const t = await tr();
  const ctx = await manageCtx();
  if (!ctx) return noRight();
  if (!idSchema.safeParse(shiftId).success) return fail(t("adm2.common.invalidRequest"));
  const tenantId = ctx.tenant.id;
  const s = await db.shift.findFirst({ where: { id: shiftId, tenantId }, select: { id: true, title: true, startsAt: true, endsAt: true, hoursCredit: true } });
  if (!s) return fail(t("adm2.shifts.msg.notFound"));
  if (s.startsAt > new Date()) return fail(t("adm2.shifts.msg.notStarted"));
  const hours = roundHours(defaultShiftHours(s));
  const res = await db.shiftAssignment.updateMany({ where: { shiftId, status: "ASSIGNED" }, data: { status: "DONE", hours, confirmedById: ctx.user.id } });
  if (res.count) await audit({ tenantId, actorId: ctx.user.id, actorName: ctx.user.name, action: "shifts.confirm", entity: "Shift", entityId: shiftId, detail: `${s.title}: ${res.count} × erledigt, je ${formatHours(hours)} h` });
  revalidate();
  return ok(undefined, res.count ? t(res.count === 1 ? "adm2.shifts.msg.confirmedAll.one" : "adm2.shifts.msg.confirmedAll.other", { n: res.count, h: formatHours(hours) }) : t("adm2.shifts.msg.nothingOpen"));
}

// ---------------------------------------------------------------------------
// Mitglieder: eintragen, austragen
// ---------------------------------------------------------------------------

export async function signUpAction(shiftId: string): Promise<ActionResult> {
  const t = await tr();
  const ctx = await memberCtx();
  if (!idSchema.safeParse(shiftId).success) return fail(t("adm2.common.invalidRequest"));
  const tenantId = ctx.tenant.id;
  if (!ctx.tenant.role) return fail(t("adm2.shifts.msg.onlyMembers"));
  try {
    const result = await db.$transaction(async (tx) => {
      // Zeile sperren, damit sich nicht zwei Personen gleichzeitig auf den letzten Platz eintragen.
      await tx.$queryRaw`SELECT id FROM \`Shift\` WHERE id = ${shiftId} FOR UPDATE`;
      const s = await tx.shift.findFirst({ where: { id: shiftId, tenantId }, select: { startsAt: true, capacity: true, title: true, event: { select: { isCancelled: true } }, assignments: { select: { userId: true, status: true } } } });
      if (!s) return { error: t("adm2.shifts.msg.notFound") };
      if (s.event?.isCancelled) return { error: t("adm2.shifts.msg.cancelled") };
      if (s.assignments.some((a) => a.userId === ctx.user.id)) return { error: t("adm2.shifts.msg.alreadySigned") };
      if (!canSelfSignUp(s, staffing(s.capacity, s.assignments), new Date())) return { error: s.startsAt <= new Date() ? t("adm2.shifts.msg.started") : t("adm2.shifts.msg.full") };
      await tx.shiftAssignment.create({ data: { shiftId, userId: ctx.user.id, status: "ASSIGNED" } });
      return { title: s.title };
    });
    if ("error" in result) return fail(result.error!);
    revalidate();
    return ok(undefined, t("adm2.shifts.msg.signedUp", { title: result.title }));
  } catch (e) {
    if (isUniqueError(e)) return fail(t("adm2.shifts.msg.alreadySigned"));
    return handle(e, t);
  }
}

export async function withdrawAction(shiftId: string): Promise<ActionResult> {
  const t = await tr();
  const ctx = await memberCtx();
  if (!idSchema.safeParse(shiftId).success) return fail(t("adm2.common.invalidRequest"));
  const a = await db.shiftAssignment.findFirst({ where: { shiftId, userId: ctx.user.id, shift: { tenantId: ctx.tenant.id } }, select: { id: true, status: true, shift: { select: { startsAt: true, title: true } } } });
  if (!a) return fail(t("adm2.shifts.msg.notSigned"));
  if (!canSelfWithdraw(a.shift, a, new Date())) return fail(t("adm2.shifts.msg.withdrawLate"));
  await db.shiftAssignment.delete({ where: { id: a.id } });
  revalidate();
  return ok(undefined, t("adm2.shifts.msg.withdrawn", { title: a.shift.title }));
}

// ---------------------------------------------------------------------------
// Arbeitsrapporte (Stunden erfassen)
// ---------------------------------------------------------------------------

export async function submitWorkLogAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const t = await tr();
  const ctx = await memberCtx();
  if (!ctx.tenant.role) return fail(t("adm2.shifts.msg.onlyMembersHours"));
  const parsed = workLogSchema.safeParse({ date: str(fd, "date"), hours: str(fd, "hours"), description: str(fd, "description") });
  if (!parsed.success) return issueFail(t, parsed.error);
  const v = parsed.data;
  const today = zurichParts(new Date()).dateStr;
  if (v.date > today) return fail(t("adm2.shifts.msg.future"), { date: t("adm2.shifts.msg.futureShort") });
  if (v.date < `${Number(today.slice(0, 4)) - 1}-01-01`) return fail(t("adm2.shifts.msg.tooOld"), { date: t("adm2.shifts.msg.tooOldShort") });
  const tenantId = ctx.tenant.id;
  const open = await db.workLog.count({ where: { tenantId, userId: ctx.user.id, approvedAt: null } });
  if (open >= 50) return fail(t("adm2.shifts.msg.tooMany"));
  await db.workLog.create({ data: { tenantId, userId: ctx.user.id, date: new Date(`${v.date}T00:00:00.000Z`), hours: roundHours(v.hours), description: v.description } });
  revalidate();
  return ok(undefined, t("adm2.shifts.msg.logged"));
}

export async function deleteMyWorkLogAction(id: string): Promise<ActionResult> {
  const t = await tr();
  const ctx = await memberCtx();
  if (!idSchema.safeParse(id).success) return fail(t("adm2.common.invalidRequest"));
  const res = await db.workLog.deleteMany({ where: { id, tenantId: ctx.tenant.id, userId: ctx.user.id, approvedAt: null } });
  if (!res.count) return fail(t("adm2.shifts.msg.logNotFoundOrApproved"));
  revalidate();
  return ok(undefined, t("adm2.shifts.msg.logDeleted"));
}

/** Verwaltung: Stunden direkt für ein Mitglied erfassen (gilt sofort als bewilligt). */
export async function addWorkLogForMemberAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const t = await tr();
  const ctx = await manageCtx();
  if (!ctx) return noRight();
  const userId = str(fd, "userId");
  if (!idSchema.safeParse(userId).success) return fail(t("adm2.shifts.msg.chooseOne"), { userId: t("adm2.shifts.msg.chooseOne") });
  const parsed = workLogSchema.safeParse({ date: str(fd, "date"), hours: str(fd, "hours"), description: str(fd, "description") });
  if (!parsed.success) return issueFail(t, parsed.error);
  const tenantId = ctx.tenant.id;
  const [member] = await activeMemberIds(tenantId, [userId]);
  if (!member) return fail(t("adm2.shifts.msg.memberNotFound"), { userId: t("adm2.shifts.msg.memberNotFound") });
  const v = parsed.data;
  const log = await db.workLog.create({ data: { tenantId, userId, date: new Date(`${v.date}T00:00:00.000Z`), hours: roundHours(v.hours), description: v.description, approvedById: ctx.user.id, approvedAt: new Date() } });
  await audit({ tenantId, actorId: ctx.user.id, actorName: ctx.user.name, action: "shifts.worklog.add", entity: "WorkLog", entityId: log.id, detail: `${member.user.name}: ${formatHours(log.hours)} h am ${v.date} (${v.description})` });
  revalidate();
  return ok(undefined, t("adm2.shifts.msg.loggedFor", { h: formatHours(log.hours), name: member.user.name }));
}

export async function approveWorkLogAction(id: string, approve: boolean): Promise<ActionResult> {
  const t = await tr();
  const ctx = await manageCtx();
  if (!ctx) return noRight();
  if (!idSchema.safeParse(id).success) return fail(t("adm2.common.invalidRequest"));
  const tenantId = ctx.tenant.id;
  const log = await db.workLog.findFirst({ where: { id, tenantId }, select: { id: true, userId: true, hours: true, date: true, description: true, approvedAt: true, user: { select: { name: true } } } });
  if (!log) return fail(t("adm2.shifts.msg.logNotFound"));
  const day = log.date.toISOString().slice(0, 10);
  if (approve) {
    if (log.approvedAt) return ok(undefined, t("adm2.shifts.msg.alreadyApproved"));
    await db.workLog.update({ where: { id }, data: { approvedById: ctx.user.id, approvedAt: new Date() } });
  } else {
    await db.workLog.delete({ where: { id } });
  }
  await audit({ tenantId, actorId: ctx.user.id, actorName: ctx.user.name, action: approve ? "shifts.worklog.approve" : "shifts.worklog.reject", entity: "WorkLog", entityId: id, detail: `${log.user.name}: ${formatHours(log.hours)} h am ${day} (${log.description})` });
  const userLocale = await getUserLocale(log.userId);
  const tu = getT(userLocale);
  const vars = { h: formatHours(log.hours), date: formatDate(log.date, userLocale, { timeZone: "UTC" }), text: log.description };
  await notify({
    tenantId, userIds: [log.userId], topic: "shifts",
    title: approve ? tu("adm2.shifts.msg.notifyApproved") : tu("adm2.shifts.msg.notifyRejected"),
    body: approve ? tu("adm2.shifts.msg.notifyApprovedBody", vars) : tu("adm2.shifts.msg.notifyRejectedBody", vars),
    url: "/shifts?tab=hours", tag: `worklog:${id}`, email: false,
  });
  revalidate();
  return ok(undefined, approve ? t("adm2.shifts.msg.approved") : t("adm2.shifts.msg.rejected"));
}

// ---------------------------------------------------------------------------
// Einstellungen Arbeitsstunden
// ---------------------------------------------------------------------------

export async function saveWorkSettingsAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const t = await tr();
  const ctx = await manageCtx();
  if (!ctx) return noRight();
  const parsed = settingsSchema.safeParse({ enabled: fd.get("enabled") === "on", proRata: fd.get("proRata") === "on", requiredHours: str(fd, "requiredHours"), rate: str(fd, "rate"), statuses: fd.getAll("statuses").map(String) });
  if (!parsed.success) return issueFail(t, parsed.error);
  const v = parsed.data;
  if (v.enabled && !v.statuses.length) return fail(t("adm2.shifts.msg.chooseStatus"), { statuses: t("adm2.shifts.msg.chooseStatusShort") });
  const tenantId = ctx.tenant.id;
  const data = { enabled: v.enabled, proRata: v.proRata, requiredHours: roundHours(v.requiredHours), ratePerMissingHourCents: Math.round(v.rate * 100), appliesToStatuses: v.statuses.join(",") || "ACTIVE" };
  await db.workHoursSettings.upsert({ where: { tenantId }, create: { tenantId, ...data }, update: data });
  await audit({
    tenantId, actorId: ctx.user.id, actorName: ctx.user.name, action: "shifts.settings", entity: "WorkHoursSettings", entityId: tenantId,
    detail: `${v.enabled ? "aktiv" : "aus"}, Soll ${formatHours(data.requiredHours)} h, ${formatMoney(data.ratePerMissingHourCents)} pro fehlende Stunde, Status ${data.appliesToStatuses}${data.proRata ? ", pro rata bei Eintritt/Austritt" : ""}`,
  });
  revalidate();
  return ok(undefined, t("adm2.shifts.msg.settingsSaved"));
}

// ---------------------------------------------------------------------------
// Ersatzabgabe verrechnen
// ---------------------------------------------------------------------------

/**
 * Erstellt pro Mitglied mit fehlenden Stunden eine Beitragsrechnung «Ersatzabgabe Arbeitsstunden <Jahr> (x h)».
 * Idempotent: Mitglieder mit bestehender (nicht stornierter) Ersatzabgabe-Rechnung für das Jahr werden übersprungen.
 * `userIds` stammt aus der bestätigten Vorschau; Beträge werden serverseitig neu berechnet.
 */
export async function billErsatzAction(year: number, userIds: string[]): Promise<ActionResult<{ count: number }>> {
  const t = await tr();
  const ctx = await manageCtx();
  if (!ctx) return noRight();
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return fail(t("adm2.shifts.msg.invalidYear"));
  if (!z.array(idSchema).min(1).max(5000).safeParse(userIds).success) return fail(t("adm2.shifts.msg.noneSelected"));
  if (!ctx.hasModule("billing")) return fail(t("adm2.shifts.msg.billingOff"));
  const tenantId = ctx.tenant.id;
  const settings = await getWorkSettings(tenantId);
  if (!settings.enabled) return fail(t("adm2.shifts.msg.dutyOff"));
  if (settings.ratePerMissingHourCents <= 0) return fail(t("adm2.shifts.msg.noRate"));
  const defaults = await standaloneInvoiceDefaults(db, tenantId, year);
  if (!defaults.profileComplete) return fail(t("adm2.shifts.msg.profile"));

  const { rows } = await hoursOverview(tenantId, year);
  const wanted = new Set(userIds);
  const due = rows.filter((r) => wanted.has(r.userId) && r.subject && r.amountCents > 0 && !r.invoice);
  if (!due.length) return fail(t("adm2.shifts.msg.noErsatz"));

  try {
    const created = await db.$transaction(async (tx) => {
      // Einstellungen sperren: zwei gleichzeitige Klicks laufen nacheinander und verrechnen nicht doppelt.
      await tx.$queryRaw`SELECT id FROM \`WorkHoursSettings\` WHERE tenantId = ${tenantId} FOR UPDATE`;
      const out = [];
      for (const r of due) {
        const exists = await tx.feeInvoice.count({ where: { tenantId, userId: r.userId, year, categoryName: { startsWith: ersatzCategoryPrefix(year) }, status: { not: "CANCELLED" } } });
        if (exists) continue;
        out.push(await createStandaloneFeeInvoice(tx, { tenantId, userId: r.userId, year, categoryName: ersatzCategoryName(year, r.missing), amountCents: r.amountCents }));
      }
      return out;
    }, { maxWait: 15_000, timeout: 120_000 });
    await finalizeStandaloneFeeInvoices(tenantId, created);
    const total = created.reduce((s, i) => s + i.amountCents, 0);
    await audit({
      tenantId, actorId: ctx.user.id, actorName: ctx.user.name, action: "shifts.ersatz.bill", entity: "WorkHoursSettings", entityId: tenantId,
      detail: `Ersatzabgabe ${year}: ${created.length} Rechnungen, total ${formatMoney(total)} (${created.map((i) => i.number).join(", ")})`.slice(0, 1900),
    });
    revalidate();
    revalidatePath("/admin/billing");
    revalidatePath("/payments");
    return ok({ count: created.length }, t(created.length === 1 ? "adm2.shifts.msg.invoices.one" : "adm2.shifts.msg.invoices.other", { n: created.length, total: formatMoneyLocale(total, await getRequestLocale()) }));
  } catch (e) {
    return handle(e, t);
  }
}
