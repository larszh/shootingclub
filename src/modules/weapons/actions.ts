"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireModule } from "@/lib/tenant";
import { todayZurich, zurichToUtc } from "@/lib/time";
import { dayKeyToDbDate, parseCostToCents, stripBlockReason, withBlockReason } from "./logic";
import { createWeaponLoan, returnWeaponLoan } from "./service";
import { blockReasonSchema, isWeaponStatus, loanSchema, serviceSchema, shotsSchema, weaponSchema, WEAPON_STATUS } from "./types";

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

const NO_RIGHT = "Dafür fehlt dir die Berechtigung.";
const str = (fd: FormData, k: string) => (fd.get(k) === null ? "" : String(fd.get(k)));

// --- Waffe erfassen / bearbeiten --------------------------------------------------------------

export async function saveWeaponAction(_prev: ActionResult<{ id: string }> | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const ctx = await manageCtx();
  if (!ctx) return fail(NO_RIGHT);
  const id = str(fd, "id") || null;
  if (id && !idSchema.safeParse(id).success) return fail("Ungültige Anfrage.");
  const parsed = weaponSchema.safeParse({
    name: str(fd, "name"), discipline: str(fd, "discipline"), manufacturer: str(fd, "manufacturer"), model: str(fd, "model"),
    caliber: str(fd, "caliber"), serialNumber: str(fd, "serialNumber"), shotCount: str(fd, "shotCount"),
    serviceEveryShots: str(fd, "serviceEveryShots"), nextServiceAt: str(fd, "nextServiceAt"), notes: str(fd, "notes"),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(issue?.message ?? "Ungültige Eingabe.", issue?.path[0] ? { [String(issue.path[0])]: issue.message } : undefined);
  }
  const v = parsed.data;
  const tenantId = ctx.tenant.id;
  const data = {
    name: v.name, discipline: v.discipline, manufacturer: v.manufacturer, model: v.model, caliber: v.caliber, serialNumber: v.serialNumber,
    shotCount: v.shotCount, serviceEveryShots: v.serviceEveryShots, nextServiceAt: v.nextServiceAt ? dayKeyToDbDate(v.nextServiceAt) : null,
  };
  if (id) {
    const current = await db.clubWeapon.findFirst({ where: { id, tenantId }, select: { notes: true, shotCount: true } });
    if (!current) return fail("Waffe nicht gefunden.");
    // Sperrgrund (erste Notizzeile) bleibt erhalten, auch wenn das Formular nur die übrigen Notizen zeigt.
    const reason = current.notes?.startsWith("Sperrgrund: ") ? current.notes.split("\n")[0] : null;
    const notes = reason ? [reason, v.notes].filter(Boolean).join("\n") : v.notes;
    await db.clubWeapon.updateMany({ where: { id, tenantId }, data: { ...data, notes } });
    await audit({ tenantId, actorId: ctx.user.id, action: "weapons.update", entity: "ClubWeapon", entityId: id, detail: current.shotCount !== v.shotCount ? `${v.name}, Schusszähler ${current.shotCount} → ${v.shotCount}` : v.name });
    revalidate();
    return ok({ id }, "Gespeichert.");
  }
  const created = await db.clubWeapon.create({ data: { ...data, notes: v.notes, tenantId }, select: { id: true } });
  await audit({ tenantId, actorId: ctx.user.id, action: "weapons.create", entity: "ClubWeapon", entityId: created.id, detail: v.name });
  revalidate();
  return ok({ id: created.id }, "Waffe erfasst.");
}

/** Status setzen: AVAILABLE (freigeben), SERVICE, BLOCKED (mit Grund), RETIRED. Ausgeliehene Waffen zuerst zurücknehmen. */
export async function setWeaponStatusAction(id: string, status: string, reason?: string): Promise<ActionResult> {
  const ctx = await manageCtx();
  if (!ctx) return fail(NO_RIGHT);
  if (!idSchema.safeParse(id).success || !isWeaponStatus(status) || status === "LOANED") return fail("Ungültige Anfrage.");
  const tenantId = ctx.tenant.id;
  const w = await db.clubWeapon.findFirst({ where: { id, tenantId }, select: { status: true, notes: true, name: true } });
  if (!w) return fail("Waffe nicht gefunden.");
  const open = await db.weaponLoan.count({ where: { tenantId, weaponId: id, returnedAt: null } });
  if (open > 0 || w.status === "LOANED") return fail("Die Waffe ist ausgeliehen. Bitte zuerst zurücknehmen.");
  let notes = w.notes;
  if (status === "BLOCKED") {
    const r = blockReasonSchema.safeParse(reason ?? "");
    if (!r.success) return fail(r.error.issues[0]?.message ?? "Bitte einen Grund angeben.");
    notes = withBlockReason(w.notes, r.data);
  } else {
    notes = stripBlockReason(w.notes);
  }
  // Bedingt: nur, wenn sich der Status seit dem Lesen nicht geändert hat (z.B. parallele Ausleihe).
  const res = await db.clubWeapon.updateMany({ where: { id, tenantId, status: w.status }, data: { status, notes } });
  if (res.count === 0) return fail("Der Status hat sich inzwischen geändert. Bitte Seite neu laden.");
  await audit({ tenantId, actorId: ctx.user.id, action: "weapons.status", entity: "ClubWeapon", entityId: id, detail: `${w.name}: ${w.status} → ${status}${status === "BLOCKED" && reason ? ` (${reason.slice(0, 120)})` : ""}` });
  revalidate();
  return ok(undefined, `Status: ${WEAPON_STATUS[status].label}.`);
}

export async function deleteWeaponAction(id: string): Promise<ActionResult> {
  const ctx = await manageCtx();
  if (!ctx) return fail(NO_RIGHT);
  if (!idSchema.safeParse(id).success) return fail("Ungültige Anfrage.");
  const tenantId = ctx.tenant.id;
  const w = await db.clubWeapon.findFirst({ where: { id, tenantId }, select: { name: true, _count: { select: { loans: true } } } });
  if (!w) return fail("Waffe nicht gefunden.");
  if (w._count.loans > 0) return fail("Die Waffe hat eine Ausleihgeschichte. Bitte «Ausmustern» statt löschen, damit die Nachweise erhalten bleiben.");
  await db.clubWeapon.deleteMany({ where: { id, tenantId } });
  await audit({ tenantId, actorId: ctx.user.id, action: "weapons.delete", entity: "ClubWeapon", entityId: id, detail: w.name });
  revalidate();
  return ok(undefined, "Waffe gelöscht.");
}

// --- Ausleihe ----------------------------------------------------------------------------------

export async function lendWeaponAction(input: {
  weaponId: string; userId: string | null; borrowerName: string; isMinor: boolean; onSiteOnly: boolean; dueDate: string; reportDays: string; note: string;
}): Promise<ActionResult<{ id: string }>> {
  const ctx = await loanCtx();
  if (!ctx) return fail(NO_RIGHT);
  const parsed = loanSchema.safeParse({ ...input, userId: input.userId || null });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(issue?.message ?? "Ungültige Eingabe.", issue?.path[0] ? { [String(issue.path[0])]: issue.message } : undefined);
  }
  const v = parsed.data;
  if (v.dueDate && v.dueDate < todayZurich()) return fail("«Rückgabe bis» darf nicht in der Vergangenheit liegen.", { dueDate: "Datum ab heute wählen." });
  const res = await createWeaponLoan({
    tenantId: ctx.tenant.id, weaponId: v.weaponId, userId: v.userId, borrowerName: v.userId ? null : v.borrowerName, isMinor: v.isMinor,
    onSiteOnly: v.onSiteOnly, issuedById: ctx.user.id, note: v.note, dueAt: v.dueDate ? zurichToUtc(v.dueDate, "23:59") : null, reportDays: v.reportDays,
  });
  if (!res.ok) return fail(res.error);
  revalidate();
  const loan = await db.weaponLoan.findFirst({ where: { id: res.id, tenantId: ctx.tenant.id }, select: { isMinor: true } });
  return ok({ id: res.id }, loan?.isMinor ? "Ausgeliehen. Minderjährig: Meldepflicht prüfen." : "Ausgeliehen.");
}

export async function returnLoanAction(loanId: string, shots: number | null): Promise<ActionResult> {
  const ctx = await loanCtx();
  if (!ctx) return fail(NO_RIGHT);
  const s = shotsSchema.safeParse(shots);
  if (!idSchema.safeParse(loanId).success || !s.success) return fail(s.success ? "Ungültige Anfrage." : (s.error.issues[0]?.message ?? "Ungültige Schusszahl."));
  const r = await returnWeaponLoan(ctx.tenant.id, loanId, s.data);
  if (!r.ok) return fail(r.error ?? "Rückgabe fehlgeschlagen.");
  const loan = await db.weaponLoan.findFirst({ where: { id: loanId, tenantId: ctx.tenant.id }, select: { weaponId: true, weapon: { select: { status: true } } } });
  revalidate();
  return ok(undefined, loan?.weapon.status === "SERVICE" ? "Zurückgenommen. Wartung fällig – Waffe ist «In Wartung»." : "Zurückgenommen.");
}

export async function markReportedAction(loanId: string, reported: boolean): Promise<ActionResult> {
  const ctx = reported ? await loanCtx() : await manageCtx();
  if (!ctx) return fail(NO_RIGHT);
  if (!idSchema.safeParse(loanId).success) return fail("Ungültige Anfrage.");
  const res = await db.weaponLoan.updateMany({
    where: { id: loanId, tenantId: ctx.tenant.id, isMinor: true, ...(reported ? { reportedAt: null } : { reportedAt: { not: null } }) },
    data: { reportedAt: reported ? new Date() : null },
  });
  if (res.count === 0) return fail(reported ? "Bereits als gemeldet markiert." : "Nicht als gemeldet markiert.");
  await audit({ tenantId: ctx.tenant.id, actorId: ctx.user.id, action: reported ? "weapons.loan.reported" : "weapons.loan.unreported", entity: "WeaponLoan", entityId: loanId });
  revalidate();
  return ok(undefined, reported ? "Als gemeldet markiert." : "Markierung entfernt.");
}

// --- Wartung -------------------------------------------------------------------------------------

export async function addServiceAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await manageCtx();
  if (!ctx) return fail(NO_RIGHT);
  const parsed = serviceSchema.safeParse({
    weaponId: str(fd, "weaponId"), date: str(fd, "date"), kind: str(fd, "kind") || "SERVICE", note: str(fd, "note"), cost: str(fd, "cost"),
    byName: str(fd, "byName"), release: fd.get("release") === "on", nextServiceAt: str(fd, "nextServiceAt"),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(issue?.message ?? "Ungültige Eingabe.", issue?.path[0] ? { [String(issue.path[0])]: issue.message } : undefined);
  }
  const v = parsed.data;
  const costCents = parseCostToCents(v.cost);
  if (costCents === undefined) return fail("Ungültiger Betrag.", { cost: "Ungültiger Betrag." });
  const tenantId = ctx.tenant.id;
  const w = await db.clubWeapon.findFirst({ where: { id: v.weaponId, tenantId }, select: { id: true, name: true, status: true, notes: true } });
  if (!w) return fail("Waffe nicht gefunden.");
  const release = v.release && (w.status === "SERVICE" || w.status === "BLOCKED");
  let released = false;
  await db.$transaction(async (tx) => {
    await tx.weaponService.create({ data: { weaponId: w.id, date: dayKeyToDbDate(v.date), kind: v.kind, note: v.note, costCents, byName: v.byName ?? ctx.user.name.slice(0, 191) } });
    if (v.nextServiceAt) await tx.clubWeapon.updateMany({ where: { id: w.id, tenantId }, data: { nextServiceAt: dayKeyToDbDate(v.nextServiceAt) } });
    if (release) {
      // Bedingt: nur freigeben, wenn sich der Status seit dem Lesen nicht geändert hat.
      const r = await tx.clubWeapon.updateMany({ where: { id: w.id, tenantId, status: w.status }, data: { status: "AVAILABLE", notes: stripBlockReason(w.notes) } });
      released = r.count > 0;
    }
  });
  await audit({ tenantId, actorId: ctx.user.id, action: "weapons.service", entity: "ClubWeapon", entityId: w.id, detail: `${w.name}: ${v.kind} ${v.date}` });
  revalidate();
  return ok(undefined, released ? "Wartung erfasst. Waffe ist wieder verfügbar." : "Wartung erfasst.");
}

export async function deleteServiceAction(serviceId: string): Promise<ActionResult> {
  const ctx = await manageCtx();
  if (!ctx) return fail(NO_RIGHT);
  if (!idSchema.safeParse(serviceId).success) return fail("Ungültige Anfrage.");
  const res = await db.weaponService.deleteMany({ where: { id: serviceId, weapon: { tenantId: ctx.tenant.id } } });
  if (res.count === 0) return fail("Eintrag nicht gefunden.");
  await audit({ tenantId: ctx.tenant.id, actorId: ctx.user.id, action: "weapons.service.delete", entity: "WeaponService", entityId: serviceId });
  revalidate();
  return ok(undefined, "Eintrag gelöscht.");
}
