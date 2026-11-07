"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { getRequestLocale, getT } from "@/lib/i18n";
import { tMsg } from "@/lib/i18n/extra/admin2/msg";
import { requireModule } from "@/lib/tenant";
import { todayZurich, zurichToUtc } from "@/lib/time";
import { blockReasonOf, cleanBlockReason, dayKeyToDbDate, parseCostToCents, stripBlockReason } from "./logic";
import { createWeaponLoan, returnWeaponLoan } from "./service";
import { blockReasonSchema, isWeaponStatus, loanSchema, serviceSchema, shotsSchema, weaponSchema, weaponSettingsSchema, weaponStatusInfo } from "./types";

const idSchema = z.string().min(1).max(40);

const revalidate = () => {
  revalidatePath("/weapons", "layout");
  revalidatePath("/range", "layout");
};

async function loanCtx() {
  const ctx = await requireModule("weapons");
  return ctx.can("weapons.loan") ? ctx : null;
}

async function manageCtx() {
  const ctx = await requireModule("weapons");
  return ctx.can("weapons.manage") ? ctx : null;
}

/** Fehlende Berechtigung, in der Sprache der Person. */
async function noRight() {
  return fail(getT(await getRequestLocale())("money.err.noPermission"));
}
const tr = async () => getT(await getRequestLocale());
/** Erste zod-Meldung übersetzt, mit Feldfehler. */
function zodFail(t: Awaited<ReturnType<typeof tr>>, issues: Array<{ message: string; path: PropertyKey[] }>) {
  const issue = issues[0];
  const m = tMsg(t, issue?.message ?? "adm2.common.invalidInput");
  return fail(m, issue?.path[0] ? { [String(issue.path[0])]: m } : undefined);
}
const str = (fd: FormData, k: string) => (fd.get(k) === null ? "" : String(fd.get(k)));

// --- Waffe erfassen / bearbeiten --------------------------------------------------------------

export async function saveWeaponAction(_prev: ActionResult<{ id: string }> | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const t = await tr();
  const ctx = await manageCtx();
  if (!ctx) return noRight();
  const id = str(fd, "id") || null;
  if (id && !idSchema.safeParse(id).success) return fail(t("adm2.common.invalidRequest"));
  const parsed = weaponSchema.safeParse({
    name: str(fd, "name"), discipline: str(fd, "discipline"), manufacturer: str(fd, "manufacturer"), model: str(fd, "model"),
    caliber: str(fd, "caliber"), serialNumber: str(fd, "serialNumber"), shotCount: str(fd, "shotCount"),
    serviceEveryShots: str(fd, "serviceEveryShots"), nextServiceAt: str(fd, "nextServiceAt"), notes: str(fd, "notes"),
  });
  if (!parsed.success) return zodFail(t, parsed.error.issues);
  const v = parsed.data;
  const tenantId = ctx.tenant.id;
  const data = {
    name: v.name, discipline: v.discipline, manufacturer: v.manufacturer, model: v.model, caliber: v.caliber, serialNumber: v.serialNumber,
    shotCount: v.shotCount, serviceEveryShots: v.serviceEveryShots, nextServiceAt: v.nextServiceAt ? dayKeyToDbDate(v.nextServiceAt) : null,
  };
  if (id) {
    const current = await db.clubWeapon.findFirst({ where: { id, tenantId }, select: { notes: true, shotCount: true, status: true, blockReason: true } });
    if (!current) return fail(t("adm2.weapons.msg.notFound"));
    // Sperrgrund: eigenes Feld, nur bei gesperrten Waffen bearbeitbar. Altdaten (erste Notizzeile «Sperrgrund: …»)
    // werden dabei ins Feld übernommen und aus den Notizen entfernt.
    let blockReason = current.blockReason;
    if (current.status === "BLOCKED") {
      const legacy = blockReasonOf(current.notes);
      const sent = fd.has("blockReason") ? cleanBlockReason(str(fd, "blockReason")) : (current.blockReason ?? legacy);
      if (!sent) return fail(t("adm2.weapons.msg.blockReasonMissing"), { blockReason: t("adm2.weapons.v.reason") });
      blockReason = sent;
    }
    const notes = stripBlockReason(v.notes);
    await db.clubWeapon.updateMany({ where: { id, tenantId }, data: { ...data, notes, blockReason } });
    const changes = [current.shotCount !== v.shotCount ? `Schusszähler ${current.shotCount} → ${v.shotCount}` : null, blockReason !== current.blockReason ? `Sperrgrund: ${blockReason ?? "–"}` : null].filter(Boolean);
    await audit({ tenantId, actorId: ctx.user.id, action: "weapons.update", entity: "ClubWeapon", entityId: id, detail: [v.name, ...changes].join(", ").slice(0, 1900) });
    revalidate();
    return ok({ id }, t("adm2.common.saved"));
  }
  const created = await db.clubWeapon.create({ data: { ...data, notes: v.notes, tenantId }, select: { id: true } });
  await audit({ tenantId, actorId: ctx.user.id, action: "weapons.create", entity: "ClubWeapon", entityId: created.id, detail: v.name });
  revalidate();
  return ok({ id: created.id }, t("adm2.weapons.msg.created"));
}

/** Status setzen: AVAILABLE (freigeben), SERVICE, BLOCKED (mit Grund), RETIRED. Ausgeliehene Waffen zuerst zurücknehmen. */
export async function setWeaponStatusAction(id: string, status: string, reason?: string): Promise<ActionResult> {
  const t = await tr();
  const ctx = await manageCtx();
  if (!ctx) return noRight();
  if (!idSchema.safeParse(id).success || !isWeaponStatus(status) || status === "LOANED") return fail(t("adm2.common.invalidRequest"));
  const tenantId = ctx.tenant.id;
  const w = await db.clubWeapon.findFirst({ where: { id, tenantId }, select: { status: true, notes: true, name: true } });
  if (!w) return fail(t("adm2.weapons.msg.notFound"));
  const open = await db.weaponLoan.count({ where: { tenantId, weaponId: id, returnedAt: null } });
  if (open > 0 || w.status === "LOANED") return fail(t("adm2.weapons.msg.isLoaned"));
  let blockReason: string | null = null;
  if (status === "BLOCKED") {
    const r = blockReasonSchema.safeParse(reason ?? "");
    if (!r.success) return fail(tMsg(t, r.error.issues[0]?.message ?? "adm2.weapons.v.reason"));
    blockReason = cleanBlockReason(r.data);
  }
  // Altdaten: früher stand der Sperrgrund als erste Notizzeile, die wird dabei entfernt.
  const notes = stripBlockReason(w.notes);
  // Bedingt: nur, wenn sich der Status seit dem Lesen nicht geändert hat (z.B. parallele Ausleihe).
  const res = await db.clubWeapon.updateMany({ where: { id, tenantId, status: w.status }, data: { status, notes, blockReason } });
  if (res.count === 0) return fail(t("adm2.weapons.msg.statusChanged"));
  await audit({ tenantId, actorId: ctx.user.id, action: "weapons.status", entity: "ClubWeapon", entityId: id, detail: `${w.name}: ${w.status} → ${status}${blockReason ? ` (${blockReason.slice(0, 120)})` : ""}` });
  revalidate();
  return ok(undefined, w.status === "BLOCKED" && status === "BLOCKED" ? t("adm2.weapons.msg.reasonChanged") : t("adm2.weapons.msg.statusSet", { label: weaponStatusInfo(status, t).label }));
}

export async function deleteWeaponAction(id: string): Promise<ActionResult> {
  const t = await tr();
  const ctx = await manageCtx();
  if (!ctx) return noRight();
  if (!idSchema.safeParse(id).success) return fail(t("adm2.common.invalidRequest"));
  const tenantId = ctx.tenant.id;
  const w = await db.clubWeapon.findFirst({ where: { id, tenantId }, select: { name: true, _count: { select: { loans: true } } } });
  if (!w) return fail(t("adm2.weapons.msg.notFound"));
  if (w._count.loans > 0) return fail(t("adm2.weapons.msg.hasHistory"));
  await db.clubWeapon.deleteMany({ where: { id, tenantId } });
  await audit({ tenantId, actorId: ctx.user.id, action: "weapons.delete", entity: "ClubWeapon", entityId: id, detail: w.name });
  revalidate();
  return ok(undefined, t("adm2.weapons.msg.deleted"));
}

// --- Ausleihe ----------------------------------------------------------------------------------

export async function lendWeaponAction(input: {
  weaponId: string; userId: string | null; borrowerName: string; isMinor: boolean; onSiteOnly: boolean; dueDate: string; reportDays: string; note: string;
}): Promise<ActionResult<{ id: string }>> {
  const t = await tr();
  const ctx = await loanCtx();
  if (!ctx) return noRight();
  const parsed = loanSchema.safeParse({ ...input, userId: input.userId || null });
  if (!parsed.success) return zodFail(t, parsed.error.issues);
  const v = parsed.data;
  if (v.dueDate && v.dueDate < todayZurich()) return fail(t("adm2.weapons.msg.duePast"), { dueDate: t("adm2.weapons.msg.dueFromToday") });
  const res = await createWeaponLoan({
    tenantId: ctx.tenant.id, weaponId: v.weaponId, userId: v.userId, borrowerName: v.userId ? null : v.borrowerName, isMinor: v.isMinor,
    onSiteOnly: v.onSiteOnly, issuedById: ctx.user.id, note: v.note, dueAt: v.dueDate ? zurichToUtc(v.dueDate, "23:59") : null, reportDays: v.reportDays,
  });
  if (!res.ok) return fail(t(res.error));
  revalidate();
  const loan = await db.weaponLoan.findFirst({ where: { id: res.id, tenantId: ctx.tenant.id }, select: { isMinor: true } });
  return ok({ id: res.id }, loan?.isMinor ? t("adm2.weapons.msg.lentMinor") : t("adm2.weapons.msg.lent"));
}

export async function returnLoanAction(loanId: string, shots: number | null): Promise<ActionResult> {
  const t = await tr();
  const ctx = await loanCtx();
  if (!ctx) return noRight();
  const s = shotsSchema.safeParse(shots);
  if (!idSchema.safeParse(loanId).success || !s.success) return fail(s.success ? t("adm2.common.invalidRequest") : tMsg(t, s.error.issues[0]?.message ?? "adm2.weapons.msg.invalidShots"));
  const r = await returnWeaponLoan(ctx.tenant.id, loanId, s.data);
  if (!r.ok) return fail(t(r.error ?? "adm2.weapons.msg.returnFailed"));
  const loan = await db.weaponLoan.findFirst({ where: { id: loanId, tenantId: ctx.tenant.id }, select: { weaponId: true, weapon: { select: { status: true } } } });
  revalidate();
  return ok(undefined, loan?.weapon.status === "SERVICE" ? t("adm2.weapons.msg.returnedService") : t("adm2.weapons.msg.returned"));
}

export async function markReportedAction(loanId: string, reported: boolean): Promise<ActionResult> {
  const t = await tr();
  const ctx = reported ? await loanCtx() : await manageCtx();
  if (!ctx) return noRight();
  if (!idSchema.safeParse(loanId).success) return fail(t("adm2.common.invalidRequest"));
  const res = await db.weaponLoan.updateMany({
    where: { id: loanId, tenantId: ctx.tenant.id, isMinor: true, ...(reported ? { reportedAt: null } : { reportedAt: { not: null } }) },
    data: { reportedAt: reported ? new Date() : null },
  });
  if (res.count === 0) return fail(reported ? t("adm2.weapons.msg.alreadyReported") : t("adm2.weapons.msg.notReported"));
  await audit({ tenantId: ctx.tenant.id, actorId: ctx.user.id, action: reported ? "weapons.loan.reported" : "weapons.loan.unreported", entity: "WeaponLoan", entityId: loanId });
  revalidate();
  return ok(undefined, reported ? t("adm2.weapons.msg.markedReported") : t("adm2.weapons.msg.markRemoved"));
}

// --- Wartung -------------------------------------------------------------------------------------

export async function addServiceAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const t = await tr();
  const ctx = await manageCtx();
  if (!ctx) return noRight();
  const parsed = serviceSchema.safeParse({
    weaponId: str(fd, "weaponId"), date: str(fd, "date"), kind: str(fd, "kind") || "SERVICE", note: str(fd, "note"), cost: str(fd, "cost"),
    byName: str(fd, "byName"), release: fd.get("release") === "on", nextServiceAt: str(fd, "nextServiceAt"),
  });
  if (!parsed.success) return zodFail(t, parsed.error.issues);
  const v = parsed.data;
  const costCents = parseCostToCents(v.cost);
  if (costCents === undefined) return fail(t("adm2.weapons.msg.invalidAmount"), { cost: t("adm2.weapons.msg.invalidAmount") });
  const tenantId = ctx.tenant.id;
  const w = await db.clubWeapon.findFirst({ where: { id: v.weaponId, tenantId }, select: { id: true, name: true, status: true, notes: true } });
  if (!w) return fail(t("adm2.weapons.msg.notFound"));
  const release = v.release && (w.status === "SERVICE" || w.status === "BLOCKED");
  let released = false;
  await db.$transaction(async (tx) => {
    await tx.weaponService.create({ data: { weaponId: w.id, date: dayKeyToDbDate(v.date), kind: v.kind, note: v.note, costCents, byName: v.byName ?? ctx.user.name.slice(0, 191) } });
    if (v.nextServiceAt) await tx.clubWeapon.updateMany({ where: { id: w.id, tenantId }, data: { nextServiceAt: dayKeyToDbDate(v.nextServiceAt) } });
    if (release) {
      // Bedingt: nur freigeben, wenn sich der Status seit dem Lesen nicht geändert hat.
      const r = await tx.clubWeapon.updateMany({ where: { id: w.id, tenantId, status: w.status }, data: { status: "AVAILABLE", notes: stripBlockReason(w.notes), blockReason: null } });
      released = r.count > 0;
    }
  });
  await audit({ tenantId, actorId: ctx.user.id, action: "weapons.service", entity: "ClubWeapon", entityId: w.id, detail: `${w.name}: ${v.kind} ${v.date}` });
  revalidate();
  return ok(undefined, released ? t("adm2.weapons.msg.serviceReleased") : t("adm2.weapons.msg.serviceAdded"));
}

export async function deleteServiceAction(serviceId: string): Promise<ActionResult> {
  const t = await tr();
  const ctx = await manageCtx();
  if (!ctx) return noRight();
  if (!idSchema.safeParse(serviceId).success) return fail(t("adm2.common.invalidRequest"));
  const res = await db.weaponService.deleteMany({ where: { id: serviceId, weapon: { tenantId: ctx.tenant.id } } });
  if (res.count === 0) return fail(t("adm2.weapons.msg.entryNotFound"));
  await audit({ tenantId: ctx.tenant.id, actorId: ctx.user.id, action: "weapons.service.delete", entity: "WeaponService", entityId: serviceId });
  revalidate();
  return ok(undefined, t("adm2.weapons.msg.entryDeleted"));
}

// --- Einstellungen -------------------------------------------------------------------------------

/** Meldefrist bei Minderjährigen und Standard-Wartungsintervall für neue Waffen (nur «weapons.manage»). */
export async function saveWeaponSettingsAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const t = await tr();
  const ctx = await manageCtx();
  if (!ctx) return noRight();
  const parsed = weaponSettingsSchema.safeParse({ minorReportDays: str(fd, "minorReportDays"), serviceEveryShotsDefault: str(fd, "serviceEveryShotsDefault") });
  if (!parsed.success) return zodFail(t, parsed.error.issues);
  const v = parsed.data;
  const tenantId = ctx.tenant.id;
  await db.weaponSettings.upsert({ where: { tenantId }, create: { tenantId, ...v }, update: v });
  await audit({
    tenantId, actorId: ctx.user.id, action: "weapons.settings", entity: "WeaponSettings", entityId: tenantId,
    detail: `Meldefrist ${v.minorReportDays} Tage, Wartungsintervall ${v.serviceEveryShotsDefault ? `${v.serviceEveryShotsDefault} Schuss` : "keins"}`,
  });
  revalidate();
  revalidatePath("/admin/weapons", "layout");
  return ok(undefined, t("adm2.weapons.msg.settingsSaved"));
}
