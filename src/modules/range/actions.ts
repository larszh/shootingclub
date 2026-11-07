"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { accessStatusWhere } from "@/lib/membership-access";
import { getCurrentUser } from "@/lib/auth";
import { setActiveTenantCookie } from "@/lib/tenant";
import { audit } from "@/lib/audit";
import { notify, tenantUserIdsWithRole } from "@/lib/notify";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { getRequestLocale, getT, type TFunction } from "@/lib/i18n";

const tr = async () => getT(await getRequestLocale());
import { todayZurich, zurichToUtc } from "@/lib/time";
import { hasValidQualification } from "@/modules/qualifications/service";
import { createWeaponLoan, returnWeaponLoan } from "@/modules/weapons/service";
import { requireRange } from "./guard";
import { ageOn, dayKeyToDbDate, dbDateKey, isPlausibleBirthYear, minorStatusFromBirthYear, parseTimeToMinutes } from "./logic";
import { findOpenLoanForVisit, getActiveRules } from "./queries";
import {
  clientIdSchema, closeFlagsSchema, guestSchema, idSchema, incidentSchema, kindLabel, quotaSchema, rulesSchema, severityInfo, visitUpdateSchema, windowSchema,
} from "./types";

type Ctx = Awaited<ReturnType<typeof requireRange>>;

const DUTY_QUALIFICATIONS = ["SCHUETZENMEISTER", "RANGE_OFFICER"];

const revalidate = () => {
  revalidatePath("/range", "layout");
  revalidatePath("/admin/range", "layout");
};

const isUniqueError = (e: unknown) => typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";

function handle(e: unknown, t: TFunction): ActionResult<never> {
  console.error("Standbetrieb:", e);
  return fail(t("adm2.common.failed"));
}

async function dutyCtx(): Promise<Ctx | null> {
  const ctx = await requireRange();
  return ctx.can("range.duty") ? ctx : null;
}

async function adminCtx(): Promise<Ctx | null> {
  const ctx = await requireRange();
  return ctx.can("range.manage") ? ctx : null;
}

const NO_RIGHT = "adm2.common.noPermission";

/** Aktives Mitglied des Vereins (nicht ausgetreten, Konto nicht gelöscht). */
async function activeMember(tenantId: string, userId: string) {
  return db.membership.findFirst({
    where: { tenantId, userId, status: accessStatusWhere(), user: { deletedAt: null } },
    select: { user: { select: { id: true, name: true, birthDate: true } } },
  });
}

async function openDayOf(tenantId: string, dayId: string) {
  return db.rangeDay.findFirst({ where: { id: dayId, tenantId, closedAt: null }, select: { id: true, date: true, resourceId: true } });
}

/**
 * Besuch anlegen; mit clientId idempotent (Doppeltipp oder Wiederholung nach Verbindungsabbruch
 * ergibt keinen zweiten Eintrag).
 */
async function createVisitOnce(tenantId: string, data: Parameters<typeof db.rangeVisit.create>[0]["data"] & { clientId?: string | null }) {
  if (data.clientId) {
    const existing = await db.rangeVisit.findUnique({ where: { clientId: data.clientId } });
    if (existing) return existing.tenantId === tenantId ? { visit: existing, created: false } : null;
  }
  try {
    return { visit: await db.rangeVisit.create({ data }), created: true };
  } catch (e) {
    if (isUniqueError(e) && data.clientId) {
      const existing = await db.rangeVisit.findUnique({ where: { clientId: data.clientId } });
      if (existing && existing.tenantId === tenantId) return { visit: existing, created: false };
    }
    throw e;
  }
}

/** Standbuch vom Vortag: keine neuen Einträge, sonst landen heutige Besuche im alten Buch (Datum, Halbtage). */
const isStaleDay = (day: { date: Date }) => dbDateKey(day.date) !== todayZurich();
const STALE_DAY = "adm2.range.msg.stale";

// --- Standbuch öffnen / Dienst ----------------------------------------------------------

/** true, wenn die Person eine gültige Qualifikation als Schützenmeister oder Standchef hat. */
export async function checkDutyQualificationAction(userId: string): Promise<ActionResult<{ qualified: boolean }>> {
  const t = await tr();
  const ctx = await dutyCtx();
  if (!ctx) return fail(t(NO_RIGHT));
  if (!idSchema.safeParse(userId).success) return fail(t("adm2.common.invalidRequest"));
  try {
    return ok({ qualified: await hasValidQualification(ctx.tenant.id, userId, DUTY_QUALIFICATIONS) });
  } catch {
    return ok({ qualified: false });
  }
}

const openDaySchema = z.object({
  resourceId: idSchema.nullable(),
  dutyUserId: idSchema.nullable(),
  dutyName: z.string().trim().max(191).optional().transform((v) => (v ? v : null)),
  notes: z.string().trim().max(5000).optional().transform((v) => (v ? v : null)),
});

export async function openDayAction(input: { resourceId: string | null; dutyUserId: string | null; dutyName?: string; notes?: string }): Promise<ActionResult<{ id: string; warning: string | null }>> {
  const t = await tr();
  const ctx = await dutyCtx();
  if (!ctx) return fail(t(NO_RIGHT));
  const parsed = openDaySchema.safeParse(input);
  if (!parsed.success) return fail(t(parsed.error.issues[0]?.message ?? "adm2.common.invalidInput"));
  const { resourceId, dutyUserId, notes } = parsed.data;
  const tenantId = ctx.tenant.id;
  if (resourceId && !(await db.resource.count({ where: { id: resourceId, tenantId } }))) return fail(t("adm2.range.msg.resourceNotFound"));
  let dutyName = parsed.data.dutyName;
  if (dutyUserId) {
    const m = await activeMember(tenantId, dutyUserId);
    if (!m) return fail(t("adm2.range.msg.notActiveDuty"));
    dutyName = m.user.name;
  }
  if (!dutyUserId && !dutyName) return fail(t("adm2.range.msg.dutyMissing"));
  const date = dayKeyToDbDate(todayZurich());
  const existing = await db.rangeDay.findFirst({ where: { tenantId, date, resourceId, closedAt: null }, select: { id: true } });
  if (existing) return ok({ id: existing.id, warning: null }, t("adm2.range.msg.alreadyOpen"));
  const day = await db.rangeDay.create({ data: { tenantId, resourceId, date, dutyUserId, dutyName: dutyName!.slice(0, 191), notes } });
  let warning: string | null = null;
  if (dutyUserId) {
    const qualified = await hasValidQualification(tenantId, dutyUserId, DUTY_QUALIFICATIONS).catch(() => false);
    if (!qualified) warning = t("adm2.range.msg.noQual", { name: dutyName ?? "" });
  }
  await audit({ tenantId, actorId: ctx.user.id, actorName: ctx.user.name, action: "range.day.open", entity: "RangeDay", entityId: day.id, detail: `Standdienst: ${dutyName}` });
  revalidate();
  return ok({ id: day.id, warning }, t("adm2.range.msg.opened"));
}

export async function changeDutyAction(dayId: string, dutyUserId: string): Promise<ActionResult<{ warning: string | null }>> {
  const t = await tr();
  const ctx = await dutyCtx();
  if (!ctx) return fail(t(NO_RIGHT));
  if (!idSchema.safeParse(dayId).success || !idSchema.safeParse(dutyUserId).success) return fail(t("adm2.common.invalidRequest"));
  const m = await activeMember(ctx.tenant.id, dutyUserId);
  if (!m) return fail(t("adm2.range.msg.memberNotFound"));
  const res = await db.rangeDay.updateMany({ where: { id: dayId, tenantId: ctx.tenant.id, closedAt: null }, data: { dutyUserId, dutyName: m.user.name } });
  if (res.count === 0) return fail(t("adm2.range.msg.dayNotFound"));
  const qualified = await hasValidQualification(ctx.tenant.id, dutyUserId, DUTY_QUALIFICATIONS).catch(() => false);
  await audit({ tenantId: ctx.tenant.id, actorId: ctx.user.id, actorName: ctx.user.name, action: "range.day.duty", entity: "RangeDay", entityId: dayId, detail: `Standdienst: ${m.user.name}` });
  revalidate();
  return ok({ warning: qualified ? null : t("adm2.range.msg.noQual", { name: m.user.name }) }, t("adm2.range.msg.dutyHandedOver"));
}

export async function saveDayNotesAction(dayId: string, notes: string): Promise<ActionResult> {
  const t = await tr();
  const ctx = await dutyCtx();
  if (!ctx) return fail(t(NO_RIGHT));
  const n = z.string().trim().max(5000).safeParse(notes ?? "");
  if (!idSchema.safeParse(dayId).success || !n.success) return fail(t("adm2.range.msg.notesTooLong"));
  const res = await db.rangeDay.updateMany({ where: { id: dayId, tenantId: ctx.tenant.id, closedAt: null }, data: { notes: n.data || null } });
  if (res.count === 0) return fail(t("adm2.range.msg.dayNotFound"));
  revalidate();
  return ok(undefined, t("adm2.range.msg.notesSaved"));
}

// --- Check-in durch den Standdienst --------------------------------------------------------

export async function checkInMemberAction(input: { dayId: string; userId: string; lane?: string; discipline?: string; clientId: string }): Promise<ActionResult<{ id: string; rulesMissing: boolean }>> {
  const t = await tr();
  const ctx = await dutyCtx();
  if (!ctx) return fail(t(NO_RIGHT));
  const extra = visitUpdateSchema.safeParse({ lane: input.lane, discipline: input.discipline });
  if (!idSchema.safeParse(input.dayId).success || !idSchema.safeParse(input.userId).success || !clientIdSchema.safeParse(input.clientId).success || !extra.success) return fail(t("adm2.common.invalidInput"));
  const tenantId = ctx.tenant.id;
  const [day, member] = await Promise.all([openDayOf(tenantId, input.dayId), activeMember(tenantId, input.userId)]);
  if (!day) return fail(t("adm2.range.msg.dayNotOpen"));
  if (isStaleDay(day)) return fail(t(STALE_DAY));
  if (!member) return fail(t("adm2.range.msg.memberGone"));
  const repeat = await db.rangeVisit.findUnique({ where: { clientId: input.clientId }, select: { id: true, tenantId: true } });
  if (repeat) return repeat.tenantId === tenantId ? ok({ id: repeat.id, rulesMissing: false }, t("adm2.range.board.checkedIn", { name: member.user.name })) : fail(t("adm2.common.invalidRequest"));
  const already = await db.rangeVisit.findFirst({ where: { tenantId, rangeDayId: day.id, userId: input.userId, checkedOutAt: null }, select: { id: true } });
  if (already) return fail(t("adm2.range.msg.alreadyIn", { name: member.user.name }));
  const rules = await getActiveRules(tenantId);
  const acceptance = rules ? await db.rulesAcceptance.findUnique({ where: { rulesId_userId: { rulesId: rules.id, userId: input.userId } } }) : null;
  try {
    const res = await createVisitOnce(tenantId, {
      tenantId, rangeDayId: day.id, userId: input.userId, lane: extra.data.lane, discipline: extra.data.discipline,
      rulesId: acceptance ? rules!.id : null, rulesAcceptedAt: acceptance?.acceptedAt ?? null, clientId: input.clientId,
    });
    if (!res) return fail(t("adm2.common.invalidRequest"));
    revalidate();
    return ok({ id: res.visit.id, rulesMissing: !!rules && !acceptance }, t("adm2.range.board.checkedIn", { name: member.user.name }));
  } catch (e) {
    return handle(e, t);
  }
}

export async function checkInGuestAction(input: {
  dayId: string; clientId: string; guestName: string; guestBirthYear?: string | number | null; guestPhone?: string; guestEmail?: string;
  hostUserId?: string | null; guestIdChecked: boolean; rulesExplained: boolean; lane?: string; discipline?: string; note?: string;
}): Promise<ActionResult<{ id: string; minor: "minor" | "maybe" | "adult" | null }>> {
  const t = await tr();
  const ctx = await dutyCtx();
  if (!ctx) return fail(t(NO_RIGHT));
  const parsed = guestSchema.safeParse({
    ...input,
    guestBirthYear: input.guestBirthYear === "" || input.guestBirthYear == null ? undefined : input.guestBirthYear,
    hostUserId: input.hostUserId || undefined,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(t(issue?.message ?? "adm2.common.invalidInput"), issue ? { [String(issue.path[0])]: t(issue.message) } : undefined);
  }
  if (!idSchema.safeParse(input.dayId).success || !clientIdSchema.safeParse(input.clientId).success) return fail(t("adm2.common.invalidRequest"));
  const g = parsed.data;
  const tenantId = ctx.tenant.id;
  const year = Number(todayZurich().slice(0, 4));
  if (g.guestBirthYear !== undefined && !isPlausibleBirthYear(g.guestBirthYear, year)) return fail(t("adm2.range.msg.birthYear"), { guestBirthYear: t("adm2.range.msg.birthYear") });
  const day = await openDayOf(tenantId, input.dayId);
  if (!day) return fail(t("adm2.range.msg.dayNotOpen"));
  if (isStaleDay(day)) return fail(t(STALE_DAY));
  if (g.hostUserId && !(await activeMember(tenantId, g.hostUserId))) return fail(t("adm2.range.msg.hostNotFound"));
  const rules = g.rulesExplained ? await getActiveRules(tenantId) : null;
  try {
    const res = await createVisitOnce(tenantId, {
      tenantId, rangeDayId: day.id, userId: null, guestName: g.guestName, guestBirthYear: g.guestBirthYear ?? null, guestPhone: g.guestPhone, guestEmail: g.guestEmail,
      guestIdChecked: g.guestIdChecked, hostUserId: g.hostUserId, lane: g.lane, discipline: g.discipline, note: g.note,
      rulesId: rules?.id ?? null, rulesAcceptedAt: rules ? new Date() : null, clientId: input.clientId,
    });
    if (!res) return fail(t("adm2.common.invalidRequest"));
    revalidate();
    const minor = g.guestBirthYear !== undefined ? minorStatusFromBirthYear(g.guestBirthYear, year) : null;
    return ok({ id: res.visit.id, minor }, t("adm2.range.msg.guestIn", { name: g.guestName }));
  } catch (e) {
    return handle(e, t);
  }
}

export async function updateVisitAction(visitId: string, input: { lane?: string; discipline?: string; note?: string }): Promise<ActionResult> {
  const t = await tr();
  const ctx = await dutyCtx();
  if (!ctx) return fail(t(NO_RIGHT));
  const parsed = visitUpdateSchema.safeParse(input);
  if (!idSchema.safeParse(visitId).success || !parsed.success) return fail(t("adm2.common.invalidInput"));
  const res = await db.rangeVisit.updateMany({ where: { id: visitId, tenantId: ctx.tenant.id, rangeDay: { closedAt: null } }, data: parsed.data });
  if (res.count === 0) return fail(t("adm2.range.msg.entryNotFound"));
  revalidate();
  return ok(undefined, t("adm2.common.saved"));
}

/** Eintrag löschen (Fehlerfassung). Nicht mit ausgegebener Vereinswaffe. */
export async function deleteVisitAction(visitId: string): Promise<ActionResult> {
  const t = await tr();
  const ctx = await dutyCtx();
  if (!ctx) return fail(t(NO_RIGHT));
  if (!idSchema.safeParse(visitId).success) return fail(t("adm2.common.invalidRequest"));
  const v = await db.rangeVisit.findFirst({ where: { id: visitId, tenantId: ctx.tenant.id, rangeDay: { closedAt: null } }, include: { user: { select: { name: true } } } });
  if (!v) return fail(t("adm2.range.msg.entryNotFound"));
  if (await findOpenLoanForVisit(ctx.tenant.id, v)) return fail(t("adm2.range.msg.returnFirst"));
  await db.rangeVisit.deleteMany({ where: { id: v.id, tenantId: ctx.tenant.id } });
  await audit({ tenantId: ctx.tenant.id, actorId: ctx.user.id, actorName: ctx.user.name, action: "range.visit.delete", entity: "RangeVisit", entityId: v.id, detail: v.user?.name ?? v.guestName ?? "" });
  revalidate();
  return ok(undefined, t("adm2.range.msg.removed"));
}

// --- Vereinswaffen --------------------------------------------------------------------------

export async function issueWeaponAction(visitId: string, weaponId: string): Promise<ActionResult> {
  const t = await tr();
  const ctx = await dutyCtx();
  if (!ctx) return fail(t(NO_RIGHT));
  if (!ctx.hasModule("weapons") || !ctx.can("weapons.loan")) return fail(t("adm2.range.msg.weaponsOff"));
  if (!idSchema.safeParse(visitId).success || !idSchema.safeParse(weaponId).success) return fail(t("adm2.common.invalidRequest"));
  const tenantId = ctx.tenant.id;
  const v = await db.rangeVisit.findFirst({
    where: { id: visitId, tenantId, checkedOutAt: null, rangeDay: { closedAt: null } },
    include: { user: { select: { name: true, birthDate: true } }, rangeDay: { select: { date: true } } },
  });
  if (!v) return fail(t("adm2.range.msg.entryOut"));
  if (v.rangeDay && isStaleDay(v.rangeDay)) return fail(t(STALE_DAY));
  if (await findOpenLoanForVisit(tenantId, v)) return fail(t("adm2.range.msg.hasWeapon"));
  const today = todayZurich();
  const year = Number(today.slice(0, 4));
  const isMinor = v.user
    ? v.user.birthDate ? ageOn(dbDateKey(v.user.birthDate), today) < 18 : false
    : v.guestBirthYear ? minorStatusFromBirthYear(v.guestBirthYear, year) !== "adult" : false;
  const res = await createWeaponLoan({
    tenantId, weaponId, userId: v.userId, borrowerName: v.userId ? null : v.guestName, isMinor, onSiteOnly: true, issuedById: ctx.user.id,
    note: t("adm2.range.msg.loanNote", { date: dbDateKey(v.rangeDay?.date ?? new Date()) }),
  });
  if (!res.ok) return fail(res.error);
  await db.rangeVisit.updateMany({ where: { id: v.id, tenantId }, data: { clubWeaponId: weaponId } });
  revalidate();
  return ok(undefined, isMinor ? t("adm2.range.msg.issuedMinor") : t("adm2.range.msg.issued"));
}

async function returnWeaponOfVisit(tenantId: string, visit: { clubWeaponId: string | null; userId: string | null; guestName: string | null }, shots: number | null, t: TFunction) {
  const loan = await findOpenLoanForVisit(tenantId, visit);
  if (!loan) return { ok: true as const };
  const r = await returnWeaponLoan(tenantId, loan.id, shots);
  return r.ok ? { ok: true as const } : { ok: false as const, error: r.error ?? t("adm2.range.msg.returnFailed") };
}

const shotsSchema = z.number().int().min(0).max(100000).nullable();

export async function returnWeaponAction(visitId: string, shots: number | null): Promise<ActionResult> {
  const t = await tr();
  const ctx = await dutyCtx();
  if (!ctx) return fail(t(NO_RIGHT));
  if (!idSchema.safeParse(visitId).success || !shotsSchema.safeParse(shots).success) return fail(t("adm2.range.msg.invalidShots"));
  const v = await db.rangeVisit.findFirst({ where: { id: visitId, tenantId: ctx.tenant.id }, select: { clubWeaponId: true, userId: true, guestName: true } });
  if (!v?.clubWeaponId) return fail(t("adm2.range.msg.noWeaponIssued"));
  const r = await returnWeaponOfVisit(ctx.tenant.id, v, shots, t);
  if (!r.ok) return fail(r.error);
  revalidate();
  return ok(undefined, t("adm2.range.msg.weaponReturned"));
}

export async function checkOutAction(visitId: string, shots: number | null = null): Promise<ActionResult> {
  const t = await tr();
  const ctx = await dutyCtx();
  if (!ctx) return fail(t(NO_RIGHT));
  if (!idSchema.safeParse(visitId).success || !shotsSchema.safeParse(shots).success) return fail(t("adm2.common.invalidInput"));
  const v = await db.rangeVisit.findFirst({ where: { id: visitId, tenantId: ctx.tenant.id }, include: { user: { select: { name: true } } } });
  if (!v) return fail(t("adm2.range.msg.entryMissing"));
  if (v.checkedOutAt) return ok(undefined, t("adm2.range.msg.alreadyOut"));
  if (v.clubWeaponId) {
    const r = await returnWeaponOfVisit(ctx.tenant.id, v, shots, t);
    if (!r.ok) return fail(r.error);
  }
  await db.rangeVisit.updateMany({ where: { id: v.id, tenantId: ctx.tenant.id, checkedOutAt: null }, data: { checkedOutAt: new Date() } });
  revalidate();
  return ok(undefined, t("adm2.range.msg.out", { name: v.user?.name ?? v.guestName ?? t("adm2.range.msg.person") }));
}

// --- Tag abschliessen ----------------------------------------------------------------------

export async function closeDayAction(dayId: string, input: { usedAm: boolean; usedPm: boolean; usedEvening: boolean; notes?: string }): Promise<ActionResult> {
  const t = await tr();
  const ctx = await dutyCtx();
  if (!ctx) return fail(t(NO_RIGHT));
  const parsed = closeFlagsSchema.safeParse(input);
  if (!idSchema.safeParse(dayId).success || !parsed.success) return fail(t("adm2.common.invalidInput"));
  const tenantId = ctx.tenant.id;
  const day = await db.rangeDay.findFirst({ where: { id: dayId, tenantId, closedAt: null }, include: { visits: { where: { checkedOutAt: null }, select: { id: true, clubWeaponId: true, userId: true, guestName: true } } } });
  if (!day) return fail(t("adm2.range.msg.dayNotFound"));
  for (const v of day.visits) {
    if (await findOpenLoanForVisit(tenantId, v)) return fail(t("adm2.range.msg.weaponsStillOut"));
  }
  const now = new Date();
  // Standbuch vom Vortag: offene Besuche höchstens bis Ende jenes Tages, nicht über Nacht bis jetzt.
  const endOfDay = zurichToUtc(dbDateKey(day.date), "23:59");
  const autoOut = now > endOfDay ? endOfDay : now;
  await db.$transaction([
    db.rangeVisit.updateMany({ where: { tenantId, rangeDayId: day.id, checkedOutAt: null }, data: { checkedOutAt: autoOut } }),
    db.rangeDay.updateMany({ where: { id: day.id, tenantId, closedAt: null }, data: { closedAt: now, usedAm: parsed.data.usedAm, usedPm: parsed.data.usedPm, usedEvening: parsed.data.usedEvening, notes: parsed.data.notes } }),
  ]);
  const flags = [parsed.data.usedAm && "Vormittag", parsed.data.usedPm && "Nachmittag", parsed.data.usedEvening && "Abend"].filter(Boolean).join(", ") || "keine Halbtage";
  await audit({ tenantId, actorId: ctx.user.id, actorName: ctx.user.name, action: "range.day.close", entity: "RangeDay", entityId: day.id, detail: `${dbDateKey(day.date)}: ${flags}; ${day.visits.length} automatisch ausgecheckt` });
  revalidate();
  return ok(undefined, t("adm2.range.msg.closed"));
}

/** Abgeschlossenen Tag korrigieren (Halbtage, Notizen). Nur «range.manage». */
export async function updateClosedDayAction(dayId: string, input: { usedAm: boolean; usedPm: boolean; usedEvening: boolean; notes?: string }): Promise<ActionResult> {
  const t = await tr();
  const ctx = await adminCtx();
  if (!ctx) return fail(t(NO_RIGHT));
  const parsed = closeFlagsSchema.safeParse(input);
  if (!idSchema.safeParse(dayId).success || !parsed.success) return fail(t("adm2.common.invalidInput"));
  const before = await db.rangeDay.findFirst({ where: { id: dayId, tenantId: ctx.tenant.id, closedAt: { not: null } } });
  if (!before) return fail(t("adm2.range.msg.dayStillOpen"));
  await db.rangeDay.updateMany({ where: { id: dayId, tenantId: ctx.tenant.id }, data: parsed.data });
  const f = (a: boolean, b: boolean, c: boolean) => `${a ? "V" : "-"}${b ? "N" : "-"}${c ? "A" : "-"}`;
  await audit({
    tenantId: ctx.tenant.id, actorId: ctx.user.id, actorName: ctx.user.name, action: "range.day.correct", entity: "RangeDay", entityId: dayId,
    detail: `${dbDateKey(before.date)}: Halbtage ${f(before.usedAm, before.usedPm, before.usedEvening)} → ${f(parsed.data.usedAm, parsed.data.usedPm, parsed.data.usedEvening)}`,
  });
  revalidate();
  return ok(undefined, t("adm2.range.msg.correctionSaved"));
}

/** Abgeschlossenen Tag wieder öffnen (nur am selben Tag sinnvoll, z.B. versehentlich geschlossen). */
export async function reopenDayAction(dayId: string): Promise<ActionResult> {
  const t = await tr();
  const ctx = await adminCtx();
  if (!ctx) return fail(t(NO_RIGHT));
  if (!idSchema.safeParse(dayId).success) return fail(t("adm2.common.invalidRequest"));
  const day = await db.rangeDay.findFirst({ where: { id: dayId, tenantId: ctx.tenant.id, closedAt: { not: null } }, select: { date: true, resourceId: true } });
  if (!day) return fail(t("adm2.range.msg.dayAlreadyOpen"));
  const other = await db.rangeDay.count({ where: { tenantId: ctx.tenant.id, date: day.date, resourceId: day.resourceId, closedAt: null } });
  if (other > 0) return fail(t("adm2.range.msg.otherOpen"));
  const res = await db.rangeDay.updateMany({ where: { id: dayId, tenantId: ctx.tenant.id, closedAt: { not: null } }, data: { closedAt: null } });
  if (res.count === 0) return fail(t("adm2.range.msg.dayAlreadyOpen"));
  await audit({ tenantId: ctx.tenant.id, actorId: ctx.user.id, actorName: ctx.user.name, action: "range.day.reopen", entity: "RangeDay", entityId: dayId });
  revalidate();
  return ok(undefined, t("adm2.range.msg.reopened"));
}

// --- Selbst-Check-in (Mitglieder) ----------------------------------------------------------

export async function acceptRulesAction(rulesId: string): Promise<ActionResult> {
  const t = await tr();
  const ctx = await requireRange();
  if (!idSchema.safeParse(rulesId).success) return fail(t("adm2.common.invalidRequest"));
  const rules = await db.rangeRules.findFirst({ where: { id: rulesId, tenantId: ctx.tenant.id, isActive: true }, select: { id: true } });
  if (!rules) return fail(t("adm2.range.msg.rulesOutdated"));
  await db.rulesAcceptance.upsert({ where: { rulesId_userId: { rulesId, userId: ctx.user.id } }, create: { rulesId, userId: ctx.user.id }, update: {} });
  revalidate();
  return ok(undefined, t("adm2.range.msg.rulesConfirmed"));
}

/** QR-Code eines anderen Vereins gescannt: aktiven Verein wechseln und zurück zum Check-in. */
export async function switchTenantForCheckInAction(tenantId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!idSchema.safeParse(tenantId).success) redirect("/range/checkin");
  // user.memberships enthält nur Mitgliedschaften mit Zugang (nicht LEFT, Verein nicht gelöscht).
  if (user.memberships.some((m) => m.tenantId === tenantId)) await setActiveTenantCookie(tenantId);
  revalidatePath("/", "layout");
  redirect("/range/checkin");
}

export async function selfCheckInAction(input: { dayId: string; clientId: string; acceptRulesId?: string | null; lane?: string; discipline?: string }): Promise<ActionResult<{ id: string } | { needsRules: string }>> {
  const t = await tr();
  const ctx = await requireRange();
  const extra = visitUpdateSchema.safeParse({ lane: input.lane, discipline: input.discipline });
  if (!idSchema.safeParse(input.dayId).success || !clientIdSchema.safeParse(input.clientId).success || !extra.success) return fail(t("shooting.checkin.msg.invalid"));
  const tenantId = ctx.tenant.id;
  const userId = ctx.user.id;
  // Wiederholung derselben Anfrage (Doppeltipp, Verbindungsabbruch) → bestehender Eintrag.
  const byClient = await db.rangeVisit.findUnique({ where: { clientId: input.clientId }, select: { id: true, tenantId: true, userId: true } });
  if (byClient) {
    if (byClient.tenantId !== tenantId || byClient.userId !== userId) return fail(t("shooting.checkin.msg.invalid"));
    revalidate(); // Antwort ging evtl. verloren: Seite soll den Check-in anzeigen.
    return ok({ id: byClient.id }, t("shooting.checkin.msg.checkedIn"));
  }
  if (!(await activeMember(tenantId, userId))) return fail(t("shooting.checkin.msg.onlyActive"));
  const day = await openDayOf(tenantId, input.dayId);
  if (!day) return fail(t("shooting.checkin.msg.notOpen"));
  if (isStaleDay(day)) return fail(t("shooting.checkin.msg.stale"));
  const open = await db.rangeVisit.findFirst({ where: { tenantId, userId, rangeDayId: day.id, checkedOutAt: null }, select: { id: true } });
  if (open) {
    revalidate(); // z.B. zweiter Tab oder Check-in durch den Standdienst: Seite aktualisieren.
    return ok({ id: open.id }, t("shooting.checkin.msg.already"));
  }
  const rules = await getActiveRules(tenantId);
  let acceptedAt: Date | null = null;
  if (rules) {
    const acc = await db.rulesAcceptance.findUnique({ where: { rulesId_userId: { rulesId: rules.id, userId } } });
    if (acc) acceptedAt = acc.acceptedAt;
    else if (input.acceptRulesId === rules.id) {
      const created = await db.rulesAcceptance.upsert({ where: { rulesId_userId: { rulesId: rules.id, userId } }, create: { rulesId: rules.id, userId }, update: {} });
      acceptedAt = created.acceptedAt;
    } else {
      return ok({ needsRules: rules.id });
    }
  }
  try {
    const res = await createVisitOnce(tenantId, {
      tenantId, rangeDayId: day.id, userId, lane: extra.data.lane, discipline: extra.data.discipline,
      rulesId: rules?.id ?? null, rulesAcceptedAt: acceptedAt, clientId: input.clientId,
    });
    if (!res) return fail(t("shooting.checkin.msg.invalid"));
    revalidate();
    return ok({ id: res.visit.id }, t("shooting.checkin.msg.done"));
  } catch (e) {
    return handle(e, t);
  }
}

export async function selfCheckOutAction(visitId: string): Promise<ActionResult> {
  const t = await tr();
  const ctx = await requireRange();
  if (!idSchema.safeParse(visitId).success) return fail(t("shooting.checkin.msg.invalid"));
  const v = await db.rangeVisit.findFirst({ where: { id: visitId, tenantId: ctx.tenant.id, userId: ctx.user.id }, select: { id: true, checkedOutAt: true, clubWeaponId: true, userId: true, guestName: true } });
  if (!v) return fail(t("shooting.checkin.msg.notFound"));
  if (v.checkedOutAt) {
    revalidate();
    return ok(undefined, t("shooting.checkin.msg.alreadyOut"));
  }
  if (await findOpenLoanForVisit(ctx.tenant.id, v)) return fail(t("shooting.checkin.msg.returnWeapon"));
  await db.rangeVisit.updateMany({ where: { id: v.id, tenantId: ctx.tenant.id, checkedOutAt: null }, data: { checkedOutAt: new Date() } });
  revalidate();
  return ok(undefined, t("shooting.checkin.msg.out"));
}

// --- Standordnung (Verwaltung) ------------------------------------------------------------

export async function createRulesDraftAction(): Promise<ActionResult<{ id: string }>> {
  const t = await tr();
  const ctx = await adminCtx();
  if (!ctx) return fail(t(NO_RIGHT));
  const tenantId = ctx.tenant.id;
  const existingDraft = await db.rangeRules.findFirst({ where: { tenantId, publishedAt: null }, orderBy: { version: "desc" }, select: { id: true } });
  if (existingDraft) return ok({ id: existingDraft.id }, t("adm2.range.msg.draftExists"));
  const [active, last] = await Promise.all([getActiveRules(tenantId), db.rangeRules.findFirst({ where: { tenantId }, orderBy: { version: "desc" }, select: { version: true } })]);
  try {
    const draft = await db.rangeRules.create({
      data: { tenantId, version: (last?.version ?? 0) + 1, title: active?.title ?? t("adm2.range.rules.defaultTitle"), body: active?.body ?? t("adm2.range.rules.template"), isActive: false },
    });
    revalidate();
    return ok({ id: draft.id }, t("adm2.range.msg.draftCreated"));
  } catch (e) {
    if (isUniqueError(e)) return fail(t("adm2.range.msg.draftConcurrent"));
    return handle(e, t);
  }
}

export async function saveRulesDraftAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const t = await tr();
  const ctx = await adminCtx();
  if (!ctx) return fail(t(NO_RIGHT));
  const id = String(fd.get("id") ?? "");
  const parsed = rulesSchema.safeParse({ title: fd.get("title") ?? "", body: fd.get("body") ?? "" });
  if (!idSchema.safeParse(id).success) return fail(t("adm2.common.invalidRequest"));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(t(issue?.message ?? "adm2.common.invalidInput"), issue ? { [String(issue.path[0])]: t(issue.message) } : undefined);
  }
  const res = await db.rangeRules.updateMany({ where: { id, tenantId: ctx.tenant.id, publishedAt: null }, data: parsed.data });
  if (res.count === 0) return fail(t("adm2.range.msg.onlyDraftsEdit"));
  revalidate();
  return ok(undefined, t("adm2.range.msg.draftSaved"));
}

export async function publishRulesAction(id: string): Promise<ActionResult> {
  const t = await tr();
  const ctx = await adminCtx();
  if (!ctx) return fail(t(NO_RIGHT));
  if (!idSchema.safeParse(id).success) return fail(t("adm2.common.invalidRequest"));
  const tenantId = ctx.tenant.id;
  const draft = await db.rangeRules.findFirst({ where: { id, tenantId, publishedAt: null } });
  if (!draft) return fail(t("adm2.range.msg.draftNotFound"));
  if (!rulesSchema.safeParse({ title: draft.title, body: draft.body }).success) return fail(t("adm2.range.msg.draftIncomplete"));
  await db.$transaction([
    db.rangeRules.updateMany({ where: { tenantId, isActive: true }, data: { isActive: false } }),
    db.rangeRules.updateMany({ where: { id, tenantId }, data: { isActive: true, publishedAt: new Date() } }),
  ]);
  await audit({ tenantId, actorId: ctx.user.id, actorName: ctx.user.name, action: "range.rules.publish", entity: "RangeRules", entityId: id, detail: `Version ${draft.version}: ${draft.title}` });
  revalidate();
  return ok(undefined, t("adm2.range.msg.published", { n: draft.version }));
}

export async function deleteRulesDraftAction(id: string): Promise<ActionResult> {
  const t = await tr();
  const ctx = await adminCtx();
  if (!ctx) return fail(t(NO_RIGHT));
  if (!idSchema.safeParse(id).success) return fail(t("adm2.common.invalidRequest"));
  const res = await db.rangeRules.deleteMany({ where: { id, tenantId: ctx.tenant.id, publishedAt: null } });
  if (res.count === 0) return fail(t("adm2.range.msg.onlyDraftsDelete"));
  revalidate();
  return ok(undefined, t("adm2.range.msg.draftDeleted"));
}

// --- Schiesszeiten und Kontingent --------------------------------------------------------

async function resourceOk(tenantId: string, resourceId: string | null) {
  return resourceId === null || (await db.resource.count({ where: { id: resourceId, tenantId } })) > 0;
}

export async function addWindowsAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const t = await tr();
  const ctx = await adminCtx();
  if (!ctx) return fail(t(NO_RIGHT));
  const parsed = windowSchema.safeParse({
    resourceId: fd.get("resourceId") || undefined,
    weekdays: fd.getAll("weekday").map((v) => Number(v)),
    start: fd.get("start") ?? "",
    end: fd.get("end") ?? "",
    note: fd.get("note") || undefined,
  });
  if (!parsed.success) return fail(t(parsed.error.issues[0]?.message ?? "adm2.common.invalidInput"));
  const w = parsed.data;
  const startMinute = parseTimeToMinutes(w.start);
  const endMinute = parseTimeToMinutes(w.end);
  if (startMinute === null || endMinute === null) return fail(t("adm2.common.invalidTime"));
  if (endMinute <= startMinute) return fail(t("adm2.common.endAfterStart"));
  if (!(await resourceOk(ctx.tenant.id, w.resourceId))) return fail(t("adm2.range.msg.resourceNotFound"));
  const weekdays = [...new Set(w.weekdays)];
  await db.shootingWindow.createMany({ data: weekdays.map((weekday) => ({ tenantId: ctx.tenant.id, resourceId: w.resourceId, weekday, startMinute, endMinute, note: w.note })) });
  await audit({ tenantId: ctx.tenant.id, actorId: ctx.user.id, actorName: ctx.user.name, action: "range.window.add", entity: "ShootingWindow", detail: `${weekdays.join(",")} ${w.start}–${w.end}` });
  revalidate();
  return ok(undefined, weekdays.length > 1 ? t("adm2.range.msg.windowsAdded", { n: weekdays.length }) : t("adm2.range.msg.windowAdded"));
}

export async function deleteWindowAction(id: string): Promise<ActionResult> {
  const t = await tr();
  const ctx = await adminCtx();
  if (!ctx) return fail(t(NO_RIGHT));
  if (!idSchema.safeParse(id).success) return fail(t("adm2.common.invalidRequest"));
  const res = await db.shootingWindow.deleteMany({ where: { id, tenantId: ctx.tenant.id } });
  if (res.count === 0) return fail(t("adm2.common.notFound"));
  await audit({ tenantId: ctx.tenant.id, actorId: ctx.user.id, actorName: ctx.user.name, action: "range.window.delete", entity: "ShootingWindow", entityId: id });
  revalidate();
  return ok(undefined, t("adm2.range.msg.windowRemoved"));
}

export async function saveQuotaAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const t = await tr();
  const ctx = await adminCtx();
  if (!ctx) return fail(t(NO_RIGHT));
  const parsed = quotaSchema.safeParse({
    resourceId: fd.get("resourceId") || undefined,
    year: fd.get("year") ?? "",
    maxHalfDays: fd.get("maxHalfDays") ?? "",
    note: fd.get("note") || undefined,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(t(issue?.message ?? "adm2.common.invalidInput"), issue ? { [String(issue.path[0])]: t(issue.message) } : undefined);
  }
  const q = parsed.data;
  if (!(await resourceOk(ctx.tenant.id, q.resourceId))) return fail(t("adm2.range.msg.resourceNotFound"));
  // Unique-Index mit NULL greift in MariaDB nicht → selbst nachschlagen.
  const existing = await db.shootingQuota.findFirst({ where: { tenantId: ctx.tenant.id, resourceId: q.resourceId, year: q.year }, select: { id: true } });
  if (existing) await db.shootingQuota.updateMany({ where: { id: existing.id, tenantId: ctx.tenant.id }, data: { maxHalfDays: q.maxHalfDays, note: q.note } });
  else await db.shootingQuota.create({ data: { tenantId: ctx.tenant.id, resourceId: q.resourceId, year: q.year, maxHalfDays: q.maxHalfDays, note: q.note } });
  await audit({ tenantId: ctx.tenant.id, actorId: ctx.user.id, actorName: ctx.user.name, action: "range.quota.save", entity: "ShootingQuota", detail: `${q.year}: ${q.maxHalfDays} Halbtage` });
  revalidate();
  return ok(undefined, t("adm2.range.msg.quotaSaved"));
}

export async function deleteQuotaAction(id: string): Promise<ActionResult> {
  const t = await tr();
  const ctx = await adminCtx();
  if (!ctx) return fail(t(NO_RIGHT));
  if (!idSchema.safeParse(id).success) return fail(t("adm2.common.invalidRequest"));
  const res = await db.shootingQuota.deleteMany({ where: { id, tenantId: ctx.tenant.id } });
  if (res.count === 0) return fail(t("adm2.common.notFound"));
  await audit({ tenantId: ctx.tenant.id, actorId: ctx.user.id, actorName: ctx.user.name, action: "range.quota.delete", entity: "ShootingQuota", entityId: id });
  revalidate();
  return ok(undefined, t("adm2.range.msg.quotaRemoved"));
}

// --- Vorfälle ------------------------------------------------------------------------------

export async function reportIncidentAction(_prev: ActionResult<{ id: string }> | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const t = await tr();
  const ctx = await requireRange();
  const parsed = incidentSchema.safeParse({
    kind: fd.get("kind") ?? "",
    severity: fd.get("severity") ?? "",
    date: fd.get("date") ?? "",
    time: fd.get("time") ?? "",
    location: fd.get("location") || undefined,
    description: fd.get("description") ?? "",
    persons: fd.get("persons") || undefined,
    measures: fd.get("measures") || undefined,
    clientId: fd.get("clientId") || undefined,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue ? String(issue.path[0]) : "";
    const max = issue && issue.code === "too_big" ? Number(issue.maximum) : null;
    const msg = !issue
      ? t("shooting.incident.msg.invalid")
      : max !== null && Number.isFinite(max)
        ? t("shooting.incident.msg.tooLong", { max })
        : field === "date"
          ? t("shooting.incident.msg.dateMissing")
          : field === "time"
            ? t("shooting.incident.msg.timeMissing")
            : field === "description"
              ? t("shooting.incident.msg.describe")
              : t("shooting.incident.msg.invalid");
    return fail(msg, issue ? { [field]: msg } : undefined);
  }
  const i = parsed.data;
  const tenantId = ctx.tenant.id;
  const occurredAt = zurichToUtc(i.date, i.time);
  if (Number.isNaN(occurredAt.getTime())) return fail(t("shooting.incident.msg.badDate"), { date: t("shooting.incident.msg.badDate") });
  if (occurredAt.getTime() > Date.now() + 10 * 60_000) return fail(t("shooting.incident.msg.future"), { date: t("shooting.incident.msg.future") });
  if (i.clientId) {
    const ex = await db.incident.findUnique({ where: { clientId: i.clientId }, select: { id: true, tenantId: true } });
    if (ex) return ex.tenantId === tenantId ? ok({ id: ex.id }, t("shooting.incident.msg.reported")) : fail(t("shooting.incident.msg.invalidRequest"));
  }
  let incident: { id: string };
  try {
    incident = await db.incident.create({
      data: { tenantId, occurredAt, kind: i.kind, severity: i.severity, location: i.location, description: i.description, persons: i.persons, measures: i.measures, reportedById: ctx.user.id, clientId: i.clientId ?? null },
      select: { id: true },
    });
  } catch (e) {
    if (isUniqueError(e) && i.clientId) {
      const ex = await db.incident.findUnique({ where: { clientId: i.clientId }, select: { id: true, tenantId: true } });
      if (ex) return ex.tenantId === tenantId ? ok({ id: ex.id }, t("shooting.incident.msg.reported")) : fail(t("shooting.incident.msg.invalidRequest"));
    }
    return handle(e, t);
  }
  await audit({ tenantId, actorId: ctx.user.id, actorName: ctx.user.name, action: "range.incident.report", entity: "Incident", entityId: incident.id, detail: `${kindLabel(i.kind)}, ${severityInfo(i.severity).label}` });
  if (i.severity === "HIGH") {
    const admins = (await tenantUserIdsWithRole(tenantId, ["OWNER", "ADMIN"])).filter((id) => id !== ctx.user.id);
    void notify({
      tenantId, userIds: admins, topic: "system", urgency: "high",
      title: `Vorfall gemeldet: ${kindLabel(i.kind)} (hoch)`,
      body: `${ctx.user.name} hat einen Vorfall mit hoher Schwere gemeldet${i.location ? ` (${i.location})` : ""}. Bitte prüfen.`,
      url: `/range/incidents/${incident.id}`, tag: `incident:${incident.id}`, dedupeKey: `incident-high:${incident.id}`,
    });
  }
  revalidate();
  return ok({ id: incident.id }, t("shooting.incident.msg.reportedThanks"));
}

export async function closeIncidentAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const t = await tr();
  const ctx = await adminCtx();
  if (!ctx) return fail(t(NO_RIGHT));
  const id = String(fd.get("id") ?? "");
  const measures = z.string().trim().min(3, "adm2.range.incident.measuresMissing").max(5000).safeParse(fd.get("measures") ?? "");
  if (!idSchema.safeParse(id).success) return fail(t("adm2.common.invalidRequest"));
  if (!measures.success) return fail(t(measures.error.issues[0]?.message ?? "adm2.common.invalidInput"), { measures: t(measures.error.issues[0]?.message ?? "adm2.common.invalidInput") });
  const res = await db.incident.updateMany({ where: { id, tenantId: ctx.tenant.id }, data: { measures: measures.data, status: "CLOSED" } });
  if (res.count === 0) return fail(t("adm2.range.msg.incidentNotFound"));
  await audit({ tenantId: ctx.tenant.id, actorId: ctx.user.id, actorName: ctx.user.name, action: "range.incident.close", entity: "Incident", entityId: id });
  revalidate();
  return ok(undefined, t("adm2.range.msg.incidentClosed"));
}

export async function reopenIncidentAction(id: string): Promise<ActionResult> {
  const t = await tr();
  const ctx = await adminCtx();
  if (!ctx) return fail(t(NO_RIGHT));
  if (!idSchema.safeParse(id).success) return fail(t("adm2.common.invalidRequest"));
  const res = await db.incident.updateMany({ where: { id, tenantId: ctx.tenant.id, status: "CLOSED" }, data: { status: "OPEN" } });
  if (res.count === 0) return fail(t("adm2.range.msg.incidentNotFound"));
  await audit({ tenantId: ctx.tenant.id, actorId: ctx.user.id, actorName: ctx.user.name, action: "range.incident.reopen", entity: "Incident", entityId: id });
  revalidate();
  return ok(undefined, t("adm2.range.msg.incidentReopened"));
}
