"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireModule } from "@/lib/tenant";
import { formatDateZurich, formatTimeRange, zurichParts, zurichToUtc } from "@/lib/time";
import { formatMoney } from "@/lib/money";
import { createStandaloneFeeInvoice, finalizeStandaloneFeeInvoices, standaloneInvoiceDefaults } from "@/modules/billing/standalone-invoice";
import { isQualificationKind } from "@/modules/qualifications/types";
import {
  MAX_COPIES, addDayKey, canSelfSignUp, canSelfWithdraw, dayOffset, defaultShiftHours, ersatzCategoryName, ersatzCategoryPrefix, expandTemplateDates, formatHours,
  isAssignmentStatus, roundHours, staffing,
} from "./logic";
import { getWorkSettings, hoursOverview } from "./queries";
import { copySchema, firstIssue, settingsSchema, shiftSchema, workLogSchema } from "./types";

const idSchema = z.string().min(1).max(40);
const NO_RIGHT = "Dafür fehlt dir die Berechtigung.";
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

function handle(e: unknown): ActionResult<never> {
  console.error("Helfereinsätze:", e);
  return fail("Das hat nicht geklappt. Bitte nochmals versuchen.");
}

const isUniqueError = (e: unknown) => typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";

/** Datum + Uhrzeiten (Schweizer Zeit) → Beginn/Ende; Ende vor Beginn = am Folgetag. */
function toRange(date: string, startTime: string, endTime: string) {
  const startsAt = zurichToUtc(date, startTime);
  let endsAt = zurichToUtc(date, endTime);
  if (endsAt.getTime() <= startsAt.getTime()) endsAt = zurichToUtc(addDayKey(date, 1), endTime);
  return { startsAt, endsAt };
}

/** Aktive Mitglieder (nicht ausgetreten, Konto nicht gelöscht) aus einer Liste von Benutzer-IDs. */
async function activeMemberIds(tenantId: string, userIds: string[]) {
  const rows = await db.membership.findMany({
    where: { tenantId, userId: { in: userIds }, status: { not: "LEFT" }, user: { deletedAt: null } },
    select: { userId: true, user: { select: { name: true } } },
  });
  return rows;
}

// ---------------------------------------------------------------------------
// Einsätze planen (shifts.manage)
// ---------------------------------------------------------------------------

export async function saveShiftAction(_prev: ActionResult<{ id: string }> | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const ctx = await manageCtx();
  if (!ctx) return fail(NO_RIGHT);
  const id = str(fd, "id") || null;
  if (id && !idSchema.safeParse(id).success) return fail("Ungültige Anfrage.");
  const parsed = shiftSchema.safeParse({
    title: str(fd, "title"), eventId: str(fd, "eventId"), date: str(fd, "date"), startTime: str(fd, "startTime"), endTime: str(fd, "endTime"),
    capacity: str(fd, "capacity"), requiredQualification: str(fd, "requiredQualification"), hoursCredit: str(fd, "hoursCredit"), note: str(fd, "note"),
  });
  if (!parsed.success) {
    const i = firstIssue(parsed.error);
    return fail(i.message, i.field ? { [i.field]: i.message } : undefined);
  }
  const v = parsed.data;
  const tenantId = ctx.tenant.id;
  if (v.requiredQualification && !isQualificationKind(v.requiredQualification)) return fail("Unbekannte Qualifikation.", { requiredQualification: "Unbekannte Qualifikation." });
  if (v.eventId) {
    const ev = await db.event.findFirst({ where: { id: v.eventId, tenantId }, select: { id: true } });
    if (!ev) return fail("Anlass nicht gefunden.", { eventId: "Anlass nicht gefunden." });
  }
  const { startsAt, endsAt } = toRange(v.date, v.startTime, v.endTime);
  if (endsAt.getTime() - startsAt.getTime() > 24 * 3_600_000) return fail("Ein Einsatz dauert höchstens 24 Stunden.", { endTime: "Höchstens 24 Stunden." });
  const data = { title: v.title, eventId: v.eventId, startsAt, endsAt, capacity: v.capacity, requiredQualification: v.requiredQualification, hoursCredit: v.hoursCredit, note: v.note };
  try {
    if (id) {
      const res = await db.shift.updateMany({ where: { id, tenantId }, data });
      if (!res.count) return fail("Einsatz nicht gefunden.");
      await audit({ tenantId, actorId: ctx.user.id, actorName: ctx.user.name, action: "shifts.update", entity: "Shift", entityId: id, detail: `${v.title} · ${v.date} ${v.startTime}–${v.endTime}` });
      revalidate();
      return ok({ id }, "Gespeichert.");
    }
    const created = await db.shift.create({ data: { ...data, tenantId }, select: { id: true } });
    await audit({ tenantId, actorId: ctx.user.id, actorName: ctx.user.name, action: "shifts.create", entity: "Shift", entityId: created.id, detail: `${v.title} · ${v.date} ${v.startTime}–${v.endTime}` });
    revalidate();
    return ok({ id: created.id }, "Einsatz erfasst.");
  } catch (e) {
    return handle(e);
  }
}

export async function deleteShiftAction(id: string): Promise<ActionResult> {
  const ctx = await manageCtx();
  if (!ctx) return fail(NO_RIGHT);
  if (!idSchema.safeParse(id).success) return fail("Ungültige Anfrage.");
  const tenantId = ctx.tenant.id;
  const s = await db.shift.findFirst({ where: { id, tenantId }, select: { title: true, startsAt: true, assignments: { where: { status: "DONE" }, select: { id: true } } } });
  if (!s) return fail("Einsatz nicht gefunden.");
  await db.shift.deleteMany({ where: { id, tenantId } });
  await audit({
    tenantId, actorId: ctx.user.id, actorName: ctx.user.name, action: "shifts.delete", entity: "Shift", entityId: id,
    detail: `${s.title} · ${zurichParts(s.startsAt).dateStr}${s.assignments.length ? ` (${s.assignments.length} bestätigte Einsätze entfernt)` : ""}`,
  });
  revalidate();
  return ok(undefined, "Einsatz gelöscht.");
}

/** Vorlage auf mehrere Daten kopieren (gleiche Uhrzeit, Besetzung, Anforderung; ohne Anlass und ohne Einteilungen). */
export async function copyShiftAction(id: string, input: { from: string; to: string; weekdays: number[]; everyWeeks: number }): Promise<ActionResult<{ count: number }>> {
  const ctx = await manageCtx();
  if (!ctx) return fail(NO_RIGHT);
  if (!idSchema.safeParse(id).success) return fail("Ungültige Anfrage.");
  const parsed = copySchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error).message);
  const tenantId = ctx.tenant.id;
  const s = await db.shift.findFirst({ where: { id, tenantId } });
  if (!s) return fail("Einsatz nicht gefunden.");
  const start = zurichParts(s.startsAt);
  const end = zurichParts(s.endsAt);
  const endOffset = dayOffset(start.dateStr, end.dateStr);
  const dates = expandTemplateDates({ ...parsed.data, exclude: [start.dateStr], max: MAX_COPIES });
  if (!dates.length) return fail("Im gewählten Zeitraum gibt es keine passenden Tage.");
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
  return ok({ count: rows.length }, `${rows.length} ${rows.length === 1 ? "Einsatz" : "Einsätze"} angelegt${skipped ? `, ${skipped} bereits vorhanden` : ""}.`);
}

// ---------------------------------------------------------------------------
// Einteilen und bestätigen (shifts.manage)
// ---------------------------------------------------------------------------

export async function assignMembersAction(shiftId: string, userIds: string[]): Promise<ActionResult> {
  const ctx = await manageCtx();
  if (!ctx) return fail(NO_RIGHT);
  if (!idSchema.safeParse(shiftId).success || !z.array(idSchema).min(1).max(200).safeParse(userIds).success) return fail("Bitte mindestens ein Mitglied wählen.");
  const tenantId = ctx.tenant.id;
  const s = await db.shift.findFirst({ where: { id: shiftId, tenantId }, select: { id: true, title: true, startsAt: true, endsAt: true, assignments: { select: { userId: true } } } });
  if (!s) return fail("Einsatz nicht gefunden.");
  const already = new Set(s.assignments.map((a) => a.userId));
  const members = (await activeMemberIds(tenantId, userIds)).filter((m) => !already.has(m.userId));
  if (!members.length) return fail("Diese Mitglieder sind bereits eingeteilt.");
  await db.shiftAssignment.createMany({ data: members.map((m) => ({ shiftId, userId: m.userId, status: "ASSIGNED" })), skipDuplicates: true });
  await audit({ tenantId, actorId: ctx.user.id, actorName: ctx.user.name, action: "shifts.assign", entity: "Shift", entityId: shiftId, detail: `${s.title}: ${members.map((m) => m.user.name).join(", ")}`.slice(0, 1900) });
  if (s.startsAt > new Date()) {
    await notify({
      tenantId, userIds: members.map((m) => m.userId), topic: "shifts",
      title: "Du bist eingeteilt",
      body: `${s.title}: ${formatDateZurich(s.startsAt)}, ${formatTimeRange(s.startsAt, s.endsAt)} Uhr.`,
      url: "/shifts?tab=mine", tag: `shift:${s.id}`,
    });
  }
  revalidate();
  return ok(undefined, `${members.length} ${members.length === 1 ? "Person" : "Personen"} eingeteilt.`);
}

export async function removeAssignmentAction(assignmentId: string): Promise<ActionResult> {
  const ctx = await manageCtx();
  if (!ctx) return fail(NO_RIGHT);
  if (!idSchema.safeParse(assignmentId).success) return fail("Ungültige Anfrage.");
  const tenantId = ctx.tenant.id;
  const a = await db.shiftAssignment.findFirst({ where: { id: assignmentId, shift: { tenantId } }, select: { id: true, status: true, user: { select: { name: true } }, shift: { select: { id: true, title: true } } } });
  if (!a) return fail("Einteilung nicht gefunden.");
  await db.shiftAssignment.delete({ where: { id: a.id } });
  await audit({ tenantId, actorId: ctx.user.id, actorName: ctx.user.name, action: "shifts.unassign", entity: "Shift", entityId: a.shift.id, detail: `${a.shift.title}: ${a.user.name} entfernt${a.status === "DONE" ? " (war bestätigt)" : ""}` });
  revalidate();
  return ok(undefined, "Einteilung entfernt.");
}

const hoursInput = z.number().min(0).max(24).nullable();

/** Einteilung bestätigen: DONE (mit Stunden), NO_SHOW oder zurück auf ASSIGNED. */
export async function setAssignmentStatusAction(assignmentId: string, status: string, hours?: number | null): Promise<ActionResult> {
  const ctx = await manageCtx();
  if (!ctx) return fail(NO_RIGHT);
  if (!idSchema.safeParse(assignmentId).success || !isAssignmentStatus(status)) return fail("Ungültige Anfrage.");
  const h = hoursInput.safeParse(hours ?? null);
  if (!h.success) return fail("Bitte Stunden zwischen 0 und 24 eingeben.");
  const tenantId = ctx.tenant.id;
  const a = await db.shiftAssignment.findFirst({
    where: { id: assignmentId, shift: { tenantId } },
    select: { id: true, status: true, hours: true, user: { select: { name: true } }, shift: { select: { id: true, title: true, startsAt: true, endsAt: true, hoursCredit: true } } },
  });
  if (!a) return fail("Einteilung nicht gefunden.");
  const value = status === "DONE" ? roundHours(h.data ?? defaultShiftHours(a.shift)) : null;
  await db.shiftAssignment.update({ where: { id: a.id }, data: { status, hours: value, confirmedById: status === "ASSIGNED" ? null : ctx.user.id } });
  const label = status === "DONE" ? `erledigt, ${formatHours(value!)} h` : status === "NO_SHOW" ? "nicht erschienen" : "zurückgesetzt";
  await audit({ tenantId, actorId: ctx.user.id, actorName: ctx.user.name, action: "shifts.confirm", entity: "ShiftAssignment", entityId: a.id, detail: `${a.shift.title} · ${a.user.name}: ${label}` });
  revalidate();
  return ok(undefined, status === "DONE" ? `${a.user.name}: ${formatHours(value!)} h bestätigt.` : status === "NO_SHOW" ? `${a.user.name}: nicht erschienen.` : "Zurückgesetzt.");
}

/** Alle noch offenen Einteilungen eines (begonnenen) Einsatzes als erledigt mit Standardstunden bestätigen. */
export async function confirmAllDoneAction(shiftId: string): Promise<ActionResult> {
  const ctx = await manageCtx();
  if (!ctx) return fail(NO_RIGHT);
  if (!idSchema.safeParse(shiftId).success) return fail("Ungültige Anfrage.");
  const tenantId = ctx.tenant.id;
  const s = await db.shift.findFirst({ where: { id: shiftId, tenantId }, select: { id: true, title: true, startsAt: true, endsAt: true, hoursCredit: true } });
  if (!s) return fail("Einsatz nicht gefunden.");
  if (s.startsAt > new Date()) return fail("Der Einsatz hat noch nicht begonnen.");
  const hours = roundHours(defaultShiftHours(s));
  const res = await db.shiftAssignment.updateMany({ where: { shiftId, status: "ASSIGNED" }, data: { status: "DONE", hours, confirmedById: ctx.user.id } });
  if (res.count) await audit({ tenantId, actorId: ctx.user.id, actorName: ctx.user.name, action: "shifts.confirm", entity: "Shift", entityId: shiftId, detail: `${s.title}: ${res.count} × erledigt, je ${formatHours(hours)} h` });
  revalidate();
  return ok(undefined, res.count ? `${res.count} ${res.count === 1 ? "Einsatz" : "Einsätze"} bestätigt (je ${formatHours(hours)} h).` : "Nichts mehr offen.");
}

// ---------------------------------------------------------------------------
// Mitglieder: eintragen, austragen
// ---------------------------------------------------------------------------

export async function signUpAction(shiftId: string): Promise<ActionResult> {
  const ctx = await memberCtx();
  if (!idSchema.safeParse(shiftId).success) return fail("Ungültige Anfrage.");
  const tenantId = ctx.tenant.id;
  if (!ctx.tenant.role) return fail("Nur Mitglieder können sich eintragen.");
  try {
    const result = await db.$transaction(async (tx) => {
      // Zeile sperren, damit sich nicht zwei Personen gleichzeitig auf den letzten Platz eintragen.
      await tx.$queryRaw`SELECT id FROM \`Shift\` WHERE id = ${shiftId} FOR UPDATE`;
      const s = await tx.shift.findFirst({ where: { id: shiftId, tenantId }, select: { startsAt: true, capacity: true, title: true, event: { select: { isCancelled: true } }, assignments: { select: { userId: true, status: true } } } });
      if (!s) return { error: "Einsatz nicht gefunden." };
      if (s.event?.isCancelled) return { error: "Der Anlass ist abgesagt." };
      if (s.assignments.some((a) => a.userId === ctx.user.id)) return { error: "Du bist bereits eingetragen." };
      if (!canSelfSignUp(s, staffing(s.capacity, s.assignments), new Date())) return { error: s.startsAt <= new Date() ? "Der Einsatz hat bereits begonnen." : "Leider schon voll." };
      await tx.shiftAssignment.create({ data: { shiftId, userId: ctx.user.id, status: "ASSIGNED" } });
      return { title: s.title };
    });
    if ("error" in result) return fail(result.error!);
    revalidate();
    return ok(undefined, `Danke! Du bist für «${result.title}» eingetragen.`);
  } catch (e) {
    if (isUniqueError(e)) return fail("Du bist bereits eingetragen.");
    return handle(e);
  }
}

export async function withdrawAction(shiftId: string): Promise<ActionResult> {
  const ctx = await memberCtx();
  if (!idSchema.safeParse(shiftId).success) return fail("Ungültige Anfrage.");
  const a = await db.shiftAssignment.findFirst({ where: { shiftId, userId: ctx.user.id, shift: { tenantId: ctx.tenant.id } }, select: { id: true, status: true, shift: { select: { startsAt: true, title: true } } } });
  if (!a) return fail("Du bist nicht eingetragen.");
  if (!canSelfWithdraw(a.shift, a, new Date())) return fail("Austragen ist nur bis zum Beginn möglich. Bitte melde dich bei den Verantwortlichen.");
  await db.shiftAssignment.delete({ where: { id: a.id } });
  revalidate();
  return ok(undefined, `Du bist von «${a.shift.title}» ausgetragen.`);
}

// ---------------------------------------------------------------------------
// Arbeitsrapporte (Stunden erfassen)
// ---------------------------------------------------------------------------

export async function submitWorkLogAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await memberCtx();
  if (!ctx.tenant.role) return fail("Nur Mitglieder können Stunden erfassen.");
  const parsed = workLogSchema.safeParse({ date: str(fd, "date"), hours: str(fd, "hours"), description: str(fd, "description") });
  if (!parsed.success) {
    const i = firstIssue(parsed.error);
    return fail(i.message, i.field ? { [i.field]: i.message } : undefined);
  }
  const v = parsed.data;
  const today = zurichParts(new Date()).dateStr;
  if (v.date > today) return fail("Das Datum liegt in der Zukunft.", { date: "Datum liegt in der Zukunft." });
  if (v.date < `${Number(today.slice(0, 4)) - 1}-01-01`) return fail("Das Datum liegt zu weit zurück.", { date: "Zu weit zurück." });
  const tenantId = ctx.tenant.id;
  const open = await db.workLog.count({ where: { tenantId, userId: ctx.user.id, approvedAt: null } });
  if (open >= 50) return fail("Du hast schon viele offene Einträge. Bitte warte auf die Bewilligung.");
  await db.workLog.create({ data: { tenantId, userId: ctx.user.id, date: new Date(`${v.date}T00:00:00.000Z`), hours: roundHours(v.hours), description: v.description } });
  revalidate();
  return ok(undefined, "Erfasst. Die Stunden zählen, sobald sie bewilligt sind.");
}

export async function deleteMyWorkLogAction(id: string): Promise<ActionResult> {
  const ctx = await memberCtx();
  if (!idSchema.safeParse(id).success) return fail("Ungültige Anfrage.");
  const res = await db.workLog.deleteMany({ where: { id, tenantId: ctx.tenant.id, userId: ctx.user.id, approvedAt: null } });
  if (!res.count) return fail("Eintrag nicht gefunden oder bereits bewilligt.");
  revalidate();
  return ok(undefined, "Eintrag gelöscht.");
}

/** Verwaltung: Stunden direkt für ein Mitglied erfassen (gilt sofort als bewilligt). */
export async function addWorkLogForMemberAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await manageCtx();
  if (!ctx) return fail(NO_RIGHT);
  const userId = str(fd, "userId");
  if (!idSchema.safeParse(userId).success) return fail("Bitte ein Mitglied wählen.", { userId: "Bitte ein Mitglied wählen." });
  const parsed = workLogSchema.safeParse({ date: str(fd, "date"), hours: str(fd, "hours"), description: str(fd, "description") });
  if (!parsed.success) {
    const i = firstIssue(parsed.error);
    return fail(i.message, i.field ? { [i.field]: i.message } : undefined);
  }
  const tenantId = ctx.tenant.id;
  const [member] = await activeMemberIds(tenantId, [userId]);
  if (!member) return fail("Mitglied nicht gefunden.", { userId: "Mitglied nicht gefunden." });
  const v = parsed.data;
  const log = await db.workLog.create({ data: { tenantId, userId, date: new Date(`${v.date}T00:00:00.000Z`), hours: roundHours(v.hours), description: v.description, approvedById: ctx.user.id, approvedAt: new Date() } });
  await audit({ tenantId, actorId: ctx.user.id, actorName: ctx.user.name, action: "shifts.worklog.add", entity: "WorkLog", entityId: log.id, detail: `${member.user.name}: ${formatHours(log.hours)} h am ${v.date} (${v.description})` });
  revalidate();
  return ok(undefined, `${formatHours(log.hours)} h für ${member.user.name} erfasst.`);
}

export async function approveWorkLogAction(id: string, approve: boolean): Promise<ActionResult> {
  const ctx = await manageCtx();
  if (!ctx) return fail(NO_RIGHT);
  if (!idSchema.safeParse(id).success) return fail("Ungültige Anfrage.");
  const tenantId = ctx.tenant.id;
  const log = await db.workLog.findFirst({ where: { id, tenantId }, select: { id: true, userId: true, hours: true, date: true, description: true, approvedAt: true, user: { select: { name: true } } } });
  if (!log) return fail("Eintrag nicht gefunden.");
  const day = log.date.toISOString().slice(0, 10);
  if (approve) {
    if (log.approvedAt) return ok(undefined, "Bereits bewilligt.");
    await db.workLog.update({ where: { id }, data: { approvedById: ctx.user.id, approvedAt: new Date() } });
  } else {
    await db.workLog.delete({ where: { id } });
  }
  await audit({ tenantId, actorId: ctx.user.id, actorName: ctx.user.name, action: approve ? "shifts.worklog.approve" : "shifts.worklog.reject", entity: "WorkLog", entityId: id, detail: `${log.user.name}: ${formatHours(log.hours)} h am ${day} (${log.description})` });
  await notify({
    tenantId, userIds: [log.userId], topic: "shifts",
    title: approve ? "Arbeitsstunden bewilligt" : "Arbeitsstunden nicht bewilligt",
    body: `${formatHours(log.hours)} h vom ${new Intl.DateTimeFormat("de-CH", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" }).format(log.date)} (${log.description})${approve ? " werden angerechnet." : " wurden nicht angerechnet. Bei Fragen melde dich bitte beim Vorstand."}`,
    url: "/shifts?tab=hours", tag: `worklog:${id}`, email: false,
  });
  revalidate();
  return ok(undefined, approve ? "Bewilligt." : "Abgelehnt und entfernt.");
}

// ---------------------------------------------------------------------------
// Einstellungen Arbeitsstunden
// ---------------------------------------------------------------------------

export async function saveWorkSettingsAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await manageCtx();
  if (!ctx) return fail(NO_RIGHT);
  const parsed = settingsSchema.safeParse({ enabled: fd.get("enabled") === "on", requiredHours: str(fd, "requiredHours"), rate: str(fd, "rate"), statuses: fd.getAll("statuses").map(String) });
  if (!parsed.success) {
    const i = firstIssue(parsed.error);
    return fail(i.message, i.field ? { [i.field]: i.message } : undefined);
  }
  const v = parsed.data;
  if (v.enabled && !v.statuses.length) return fail("Bitte mindestens einen Mitgliederstatus wählen.", { statuses: "Mindestens einen Status wählen." });
  const tenantId = ctx.tenant.id;
  const data = { enabled: v.enabled, requiredHours: roundHours(v.requiredHours), ratePerMissingHourCents: Math.round(v.rate * 100), appliesToStatuses: v.statuses.join(",") || "ACTIVE" };
  await db.workHoursSettings.upsert({ where: { tenantId }, create: { tenantId, ...data }, update: data });
  await audit({
    tenantId, actorId: ctx.user.id, actorName: ctx.user.name, action: "shifts.settings", entity: "WorkHoursSettings", entityId: tenantId,
    detail: `${v.enabled ? "aktiv" : "aus"}, Soll ${formatHours(data.requiredHours)} h, ${formatMoney(data.ratePerMissingHourCents)} pro fehlende Stunde, Status ${data.appliesToStatuses}`,
  });
  revalidate();
  return ok(undefined, "Einstellungen gespeichert.");
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
  const ctx = await manageCtx();
  if (!ctx) return fail(NO_RIGHT);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return fail("Ungültiges Jahr.");
  if (!z.array(idSchema).min(1).max(5000).safeParse(userIds).success) return fail("Keine Mitglieder ausgewählt.");
  if (!ctx.hasModule("billing")) return fail("Bitte zuerst das Modul «Mitgliederbeiträge» aktivieren: die Rechnungen erscheinen dort und unter «Zahlungen».");
  const tenantId = ctx.tenant.id;
  const settings = await getWorkSettings(tenantId);
  if (!settings.enabled) return fail("Die Arbeitsstundenpflicht ist ausgeschaltet.");
  if (settings.ratePerMissingHourCents <= 0) return fail("Bitte zuerst einen Ansatz pro fehlende Stunde festlegen.");
  const defaults = await standaloneInvoiceDefaults(db, tenantId, year);
  if (!defaults.profileComplete) return fail("Bitte zuerst das Rechnungsprofil (Zahlungsempfänger und IBAN) ausfüllen.");

  const { rows } = await hoursOverview(tenantId, year);
  const wanted = new Set(userIds);
  const due = rows.filter((r) => wanted.has(r.userId) && r.subject && r.amountCents > 0 && !r.invoice);
  if (!due.length) return fail("Keine offenen Ersatzabgaben (bereits verrechnet oder keine fehlenden Stunden).");

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
    return ok({ count: created.length }, `${created.length} ${created.length === 1 ? "Rechnung" : "Rechnungen"} erstellt (total ${formatMoney(total)}).`);
  } catch (e) {
    return handle(e);
  }
}
