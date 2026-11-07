"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { normalizeLocale, type Locale } from "@/lib/i18n/locales";
import { accessStatusWhere } from "@/lib/membership-access";
import { requirePermission, requireSuperAdmin } from "@/lib/tenant";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { randomCode } from "@/lib/utils";
import {
  ASSOCIATION_CODE_LENGTH,
  associationTransition,
  canManageClubs,
  clubTransition,
  isAssociationAdminRole,
  normalizeAssociationCode,
  type AssociationAction,
} from "./access";
import { associationContextOrNull } from "./queries";
import { associationNotice, type AssociationNoticeKey } from "./texts";

const idSchema = z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/);

// ---------------------------------------------------------------------------
// Benachrichtigungen (pro Empfänger in seiner Sprache)
// ---------------------------------------------------------------------------

async function notifyLocalized(tenantId: string | null, userIds: string[], key: AssociationNoticeKey, vars: { association: string; club?: string }, url: string) {
  try {
    const ids = [...new Set(userIds)];
    if (!ids.length) return;
    const users = await db.user.findMany({ where: { id: { in: ids }, deletedAt: null }, select: { id: true, locale: true } });
    const byLocale = new Map<Locale, string[]>();
    for (const u of users) {
      const l = normalizeLocale(u.locale);
      byLocale.set(l, [...(byLocale.get(l) ?? []), u.id]);
    }
    for (const [locale, group] of byLocale) {
      const { title, body } = associationNotice(locale, key, vars);
      await notify({ tenantId, userIds: group, topic: "system", title, body, url });
    }
  } catch (e) {
    console.warn("[association] Benachrichtigung fehlgeschlagen:", e instanceof Error ? e.message : e);
  }
}

/** Inhaber eines Vereins (mit Zugang, Konto nicht gelöscht). */
async function clubOwnerIds(tenantId: string) {
  const rows = await db.membership.findMany({ where: { tenantId, role: "OWNER", status: accessStatusWhere(), user: { deletedAt: null } }, select: { userId: true } });
  return rows.map((r) => r.userId);
}

/** Verbandsadmins (Rolle ADMIN), die Anfragen bearbeiten können. */
async function associationAdminIds(associationId: string) {
  const rows = await db.associationAdmin.findMany({ where: { associationId, role: "ADMIN", user: { deletedAt: null } }, select: { userId: true } });
  return rows.map((r) => r.userId);
}

function revalidateAssociation(associationId: string) {
  revalidatePath("/association");
  revalidatePath(`/association/${associationId}`, "layout");
  revalidatePath("/admin/association");
  revalidatePath("/super/associations");
  revalidatePath(`/super/associations/${associationId}`);
}

// ---------------------------------------------------------------------------
// Vereinsseite: beitreten, Namen teilen, austreten (tenant.manage)
// ---------------------------------------------------------------------------

const joinSchema = z.object({
  code: z.string().max(32),
  consent: z.literal("on", { message: "Bitte der Datenweitergabe zustimmen." }),
  shareNames: z.string().optional(),
});

/** Verein beantragt den Beitritt mit dem Code des Verbands (Status PENDING, Zustimmung mit Zeitstempel). */
export async function requestAssociationJoinAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requirePermission("tenant.manage");
  const parsed = joinSchema.safeParse({ code: formData.get("code") ?? "", consent: formData.get("consent") ?? undefined, shareNames: formData.get("shareNames") ?? undefined });
  if (!parsed.success) {
    const consentIssue = parsed.error.issues.find((i) => i.path[0] === "consent");
    if (consentIssue) return fail("Bitte der Datenweitergabe zustimmen.", { consent: "Zustimmung nötig" });
    return fail("Bitte die Eingaben prüfen.");
  }
  const code = normalizeAssociationCode(parsed.data.code);
  if (!code) return fail("Ungültiger Code.", { code: "4 bis 8 Buchstaben oder Ziffern" });
  const association = await db.association.findFirst({ where: { code, deletedAt: null }, select: { id: true, name: true } });
  if (!association) return fail("Kein Verband mit diesem Code gefunden.", { code: "Code unbekannt" });
  const shareNames = parsed.data.shareNames === "on";

  const existing = await db.associationMember.findUnique({ where: { associationId_tenantId: { associationId: association.id, tenantId: ctx.tenant.id } }, select: { id: true, status: true } });
  const tr = clubTransition(existing?.status ?? null, "request");
  if (!tr.ok) return fail(tr.error);
  const now = new Date();
  const data = { status: tr.status, consentAt: now, shareNames, approvedAt: null, revokedAt: null };
  if (existing) {
    // Bedingtes Update: nur wenn der Status inzwischen nicht geändert wurde.
    const res = await db.associationMember.updateMany({ where: { id: existing.id, status: existing.status }, data });
    if (res.count === 0) return fail("Der Status hat sich inzwischen geändert. Bitte neu laden.");
  } else {
    try {
      await db.associationMember.create({ data: { associationId: association.id, tenantId: ctx.tenant.id, ...data } });
    } catch {
      return fail("Die Anfrage ist bereits hängig.");
    }
  }
  await audit({
    tenantId: ctx.tenant.id, actorId: ctx.user.id, actorName: ctx.user.name, action: "association.join.request", entity: "Association", entityId: association.id,
    detail: `${association.name}: Beitritt beantragt, Zustimmung erteilt${shareNames ? ", Namen für Ranglisten freigegeben" : ", nur Zahlen"}`,
  });
  await notifyLocalized(null, await associationAdminIds(association.id), "joinRequested", { association: association.name, club: ctx.tenant.name }, `/association/${association.id}/clubs`);
  revalidateAssociation(association.id);
  return ok(undefined, `Anfrage an «${association.name}» gesendet. Der Verband muss sie noch freigeben.`);
}

async function loadClubLink(tenantId: string, linkId: string) {
  if (!idSchema.safeParse(linkId).success) return null;
  return db.associationMember.findFirst({ where: { id: linkId, tenantId }, select: { id: true, status: true, shareNames: true, consentAt: true, associationId: true, association: { select: { name: true, deletedAt: true } } } });
}

/** Namen für Verbandsranglisten freigeben oder zurückziehen. */
export async function setAssociationShareNamesAction(linkId: string, shareNames: boolean): Promise<ActionResult> {
  const ctx = await requirePermission("tenant.manage");
  const link = await loadClubLink(ctx.tenant.id, linkId);
  if (!link) return fail("Verbindung nicht gefunden.");
  if (link.status === "REVOKED") return fail("Die Verbindung ist beendet.");
  if (link.association.deletedAt) return fail("Der Verband ist aufgelöst.");
  if (shareNames && !link.consentAt) return fail("Bitte zuerst der Datenweitergabe zustimmen.");
  const value = shareNames === true;
  if (link.shareNames === value) return ok(undefined, "Unverändert.");
  // Bedingt: nur solange die Verbindung nicht inzwischen beendet wurde.
  const res = await db.associationMember.updateMany({ where: { id: link.id, status: { not: "REVOKED" } }, data: { shareNames: value } });
  if (res.count === 0) return fail("Der Status hat sich inzwischen geändert. Bitte neu laden.");
  await audit({
    tenantId: ctx.tenant.id, actorId: ctx.user.id, actorName: ctx.user.name, action: value ? "association.share_names.on" : "association.share_names.off", entity: "Association", entityId: link.associationId,
    detail: `${link.association.name}: Namen ${value ? "freigegeben" : "nicht mehr freigegeben"}`,
  });
  revalidateAssociation(link.associationId);
  return ok(undefined, value ? "Namen erscheinen in Verbandsranglisten." : "Der Verband sieht nur noch Zahlen.");
}

/** Verein tritt aus oder zieht die Anfrage zurück: Datenzugriff endet sofort, Zustimmung wird gelöscht. */
export async function leaveAssociationAction(linkId: string): Promise<ActionResult> {
  const ctx = await requirePermission("tenant.manage");
  const link = await loadClubLink(ctx.tenant.id, linkId);
  if (!link) return fail("Verbindung nicht gefunden.");
  const tr = clubTransition(link.status, "leave");
  if (!tr.ok) return fail(tr.error);
  const res = await db.associationMember.updateMany({
    where: { id: link.id, status: link.status },
    data: { status: tr.status, revokedAt: new Date(), consentAt: null, shareNames: false },
  });
  if (res.count === 0) return fail("Der Status hat sich inzwischen geändert. Bitte neu laden.");
  const wasActive = link.status === "APPROVED";
  await audit({
    tenantId: ctx.tenant.id, actorId: ctx.user.id, actorName: ctx.user.name, action: wasActive ? "association.leave" : "association.join.withdraw", entity: "Association", entityId: link.associationId,
    detail: `${link.association.name}: ${wasActive ? "ausgetreten" : "Anfrage zurückgezogen"}, Zustimmung widerrufen`,
  });
  if (wasActive && !link.association.deletedAt) await notifyLocalized(null, await associationAdminIds(link.associationId), "clubLeft", { association: link.association.name, club: ctx.tenant.name }, `/association/${link.associationId}/clubs`);
  revalidateAssociation(link.associationId);
  return ok(undefined, wasActive ? `Ausgetreten. «${link.association.name}» sieht ab sofort keine Daten mehr.` : "Anfrage zurückgezogen.");
}

// ---------------------------------------------------------------------------
// Verbandsbereich: Vereine freigeben, ablehnen, entfernen
// ---------------------------------------------------------------------------

const NOTICE_FOR: Record<AssociationAction, AssociationNoticeKey> = { approve: "approved", reject: "rejected", remove: "removed" };
const AUDIT_FOR: Record<AssociationAction, string> = { approve: "association.member.approve", reject: "association.member.reject", remove: "association.member.remove" };
const MESSAGE_FOR: Record<AssociationAction, string> = { approve: "Verein freigegeben.", reject: "Anfrage abgelehnt.", remove: "Verein entfernt. Seine Daten sind nicht mehr sichtbar." };

async function decide(associationId: string, memberId: string, action: AssociationAction): Promise<ActionResult> {
  const ctx = await associationContextOrNull(associationId);
  if (!ctx || !canManageClubs(ctx.access)) return fail("Keine Berechtigung.");
  if (ctx.association.deletedAt) return fail("Der Verband ist gelöscht.");
  if (!idSchema.safeParse(memberId).success) return fail("Ungültige Anfrage.");
  const m = await db.associationMember.findFirst({ where: { id: memberId, associationId }, select: { id: true, status: true, tenantId: true, tenant: { select: { name: true, deletedAt: true } } } });
  if (!m) return fail("Verein nicht gefunden.");
  if (action === "approve" && m.tenant.deletedAt) return fail("Der Verein ist zur Löschung vorgemerkt.");
  const tr = associationTransition(m.status, action);
  if (!tr.ok) return fail(tr.error);
  const now = new Date();
  // Ablehnen/Entfernen: Zustimmung und Namensfreigabe verfallen; ein neuer Beitritt braucht eine neue Zustimmung.
  const data = action === "approve" ? { status: tr.status, approvedAt: now, revokedAt: null } : { status: tr.status, revokedAt: now, consentAt: null, shareNames: false };
  const res = await db.associationMember.updateMany({ where: { id: m.id, status: m.status }, data });
  if (res.count === 0) return fail("Der Status hat sich inzwischen geändert. Bitte neu laden.");
  // Im Protokoll des Vereins sichtbar (tenantId des Vereins), Akteur ist der Verbandsbenutzer.
  await audit({ tenantId: m.tenantId, actorId: ctx.user.id, actorName: ctx.user.name, action: AUDIT_FOR[action], entity: "Association", entityId: associationId, detail: `${ctx.association.name}: ${m.tenant.name}` });
  await notifyLocalized(m.tenantId, await clubOwnerIds(m.tenantId), NOTICE_FOR[action], { association: ctx.association.name, club: m.tenant.name }, "/admin/association");
  revalidateAssociation(associationId);
  return ok(undefined, MESSAGE_FOR[action]);
}

export async function approveAssociationMemberAction(associationId: string, memberId: string) {
  return decide(associationId, memberId, "approve");
}
export async function rejectAssociationMemberAction(associationId: string, memberId: string) {
  return decide(associationId, memberId, "reject");
}
export async function removeAssociationMemberAction(associationId: string, memberId: string) {
  return decide(associationId, memberId, "remove");
}

// ---------------------------------------------------------------------------
// Super-Admin: Verbände und Verbandsadmins
// ---------------------------------------------------------------------------

const associationSchema = z.object({
  name: z.string().trim().min(2, "Mindestens 2 Zeichen").max(191),
  region: z.string().trim().max(191).optional(),
  code: z.string().trim().max(32).optional(),
});

async function uniqueCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = randomCode(ASSOCIATION_CODE_LENGTH);
    if (!(await db.association.findUnique({ where: { code }, select: { id: true } }))) return code;
  }
  throw new Error("Kein freier Code gefunden");
}

export async function createAssociationAction(_prev: ActionResult<{ id: string }> | null, formData: FormData): Promise<ActionResult<{ id: string }>> {
  const me = await requireSuperAdmin();
  const parsed = associationSchema.safeParse({ name: formData.get("name") ?? "", region: formData.get("region") ?? undefined, code: formData.get("code") ?? undefined });
  if (!parsed.success) return fail("Bitte die Eingaben prüfen.", Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
  let code: string;
  if (parsed.data.code) {
    const c = normalizeAssociationCode(parsed.data.code);
    if (!c) return fail("Ungültiger Code.", { code: "4 bis 8 Buchstaben oder Ziffern" });
    if (await db.association.findUnique({ where: { code: c }, select: { id: true } })) return fail("Dieser Code ist bereits vergeben.", { code: "Bereits vergeben" });
    code = c;
  } else code = await uniqueCode();
  const a = await db.association.create({ data: { name: parsed.data.name, region: parsed.data.region || null, code } });
  await audit({ tenantId: null, actorId: me.id, actorName: me.name, action: "association.create", entity: "Association", entityId: a.id, detail: `${a.name} (${a.code})` });
  revalidatePath("/super/associations");
  return ok({ id: a.id }, `Verband «${a.name}» angelegt. Code: ${a.code}`);
}

export async function updateAssociationAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const me = await requireSuperAdmin();
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return fail("Ungültiger Verband.");
  const parsed = associationSchema.safeParse({ name: formData.get("name") ?? "", region: formData.get("region") ?? undefined });
  if (!parsed.success) return fail("Bitte die Eingaben prüfen.", Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
  const a = await db.association.findUnique({ where: { id: id.data }, select: { id: true } });
  if (!a) return fail("Verband nicht gefunden.");
  await db.association.update({ where: { id: a.id }, data: { name: parsed.data.name, region: parsed.data.region || null } });
  await audit({ tenantId: null, actorId: me.id, actorName: me.name, action: "association.update", entity: "Association", entityId: a.id, detail: parsed.data.name });
  revalidateAssociation(a.id);
  return ok(undefined, "Gespeichert.");
}

/** Neuer Beitrittscode (der alte gilt sofort nicht mehr; bestehende Verbindungen bleiben). */
export async function regenerateAssociationCodeAction(associationId: string): Promise<ActionResult<{ code: string }>> {
  const me = await requireSuperAdmin();
  if (!idSchema.safeParse(associationId).success) return fail("Ungültiger Verband.");
  const a = await db.association.findUnique({ where: { id: associationId }, select: { id: true, name: true } });
  if (!a) return fail("Verband nicht gefunden.");
  const code = await uniqueCode();
  await db.association.update({ where: { id: a.id }, data: { code } });
  await audit({ tenantId: null, actorId: me.id, actorName: me.name, action: "association.code.regenerate", entity: "Association", entityId: a.id, detail: a.name });
  revalidateAssociation(a.id);
  return ok({ code }, `Neuer Code: ${code}`);
}

/** Soft-Delete: Verbandsbereich gesperrt, kein Beitritt mehr möglich. Wiederherstellbar. */
export async function setAssociationDeletedAction(associationId: string, deleted: boolean): Promise<ActionResult> {
  const me = await requireSuperAdmin();
  if (!idSchema.safeParse(associationId).success) return fail("Ungültiger Verband.");
  const a = await db.association.findUnique({ where: { id: associationId }, select: { id: true, name: true, deletedAt: true } });
  if (!a) return fail("Verband nicht gefunden.");
  if (!!a.deletedAt === deleted) return ok(undefined, "Unverändert.");
  await db.association.update({ where: { id: a.id }, data: { deletedAt: deleted ? new Date() : null } });
  await audit({ tenantId: null, actorId: me.id, actorName: me.name, action: deleted ? "association.delete" : "association.restore", entity: "Association", entityId: a.id, detail: a.name });
  revalidateAssociation(a.id);
  return ok(undefined, deleted ? "Verband gelöscht." : "Verband wiederhergestellt.");
}

const adminSchema = z.object({
  associationId: idSchema,
  email: z.string().trim().toLowerCase().email("Ungültige E-Mail").max(191),
  role: z.string().refine(isAssociationAdminRole, "Ungültige Rolle"),
});

/** Bestehendes Konto (per E-Mail) als Verbandsadmin oder Leser eintragen. */
export async function addAssociationAdminAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const me = await requireSuperAdmin();
  const parsed = adminSchema.safeParse({ associationId: formData.get("associationId"), email: formData.get("email") ?? "", role: formData.get("role") ?? "ADMIN" });
  if (!parsed.success) return fail("Bitte die Eingaben prüfen.", Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
  const a = await db.association.findUnique({ where: { id: parsed.data.associationId }, select: { id: true, name: true } });
  if (!a) return fail("Verband nicht gefunden.");
  const user = await db.user.findFirst({ where: { email: parsed.data.email, deletedAt: null }, select: { id: true, name: true } });
  if (!user) return fail("Kein Konto mit dieser E-Mail. Die Person muss sich zuerst registrieren.", { email: "Kein Konto gefunden" });
  const existing = await db.associationAdmin.findUnique({ where: { associationId_userId: { associationId: a.id, userId: user.id } }, select: { id: true } });
  if (existing) return fail(`${user.name} hat bereits Zugang.`);
  await db.associationAdmin.create({ data: { associationId: a.id, userId: user.id, role: parsed.data.role } });
  await audit({ tenantId: null, actorId: me.id, actorName: me.name, action: "association.admin.add", entity: "Association", entityId: a.id, detail: `${a.name}: ${user.name} (${parsed.data.role})` });
  await notifyLocalized(null, [user.id], "adminAssigned", { association: a.name }, `/association/${a.id}`);
  revalidateAssociation(a.id);
  return ok(undefined, `${user.name} hat jetzt Zugang.`);
}

export async function setAssociationAdminRoleAction(adminId: string, role: string): Promise<ActionResult> {
  const me = await requireSuperAdmin();
  if (!idSchema.safeParse(adminId).success || !isAssociationAdminRole(role)) return fail("Ungültige Eingabe.");
  const row = await db.associationAdmin.findUnique({ where: { id: adminId }, select: { id: true, role: true, associationId: true, association: { select: { name: true } }, user: { select: { name: true } } } });
  if (!row) return fail("Eintrag nicht gefunden.");
  if (row.role === role) return ok(undefined, "Unverändert.");
  await db.associationAdmin.update({ where: { id: row.id }, data: { role } });
  await audit({ tenantId: null, actorId: me.id, actorName: me.name, action: "association.admin.role", entity: "Association", entityId: row.associationId, detail: `${row.association.name}: ${row.user.name} ${row.role} → ${role}` });
  revalidateAssociation(row.associationId);
  return ok(undefined, "Rolle geändert.");
}

export async function removeAssociationAdminAction(adminId: string): Promise<ActionResult> {
  const me = await requireSuperAdmin();
  if (!idSchema.safeParse(adminId).success) return fail("Ungültige Eingabe.");
  const row = await db.associationAdmin.findUnique({ where: { id: adminId }, select: { id: true, associationId: true, association: { select: { name: true } }, user: { select: { name: true } } } });
  if (!row) return fail("Eintrag nicht gefunden.");
  await db.associationAdmin.delete({ where: { id: row.id } });
  await audit({ tenantId: null, actorId: me.id, actorName: me.name, action: "association.admin.remove", entity: "Association", entityId: row.associationId, detail: `${row.association.name}: ${row.user.name}` });
  revalidateAssociation(row.associationId);
  return ok(undefined, "Zugang entfernt.");
}
