"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { THROTTLE, clientIp, getCurrentUser, throttle } from "@/lib/auth";
import { requirePermission, requireSuperAdmin, setActiveTenantCookie } from "@/lib/tenant";
import { isModuleKey } from "@/lib/modules";
import { ROLE_LABELS, isTenantRole, type TenantRole } from "@/lib/permissions";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { randomCode, slugify } from "@/lib/utils";
import { todayZurich } from "@/lib/time";
import { removeUserFromTenantChats } from "@/modules/chat/service";
import { audit } from "@/lib/audit";

const TENANT_KINDS = ["CLUB", "RANGE", "PRIVATE"] as const;

const createTenantSchema = z.object({
  name: z.string().trim().min(2, "Mindestens 2 Zeichen").max(80),
  kind: z.enum(TENANT_KINDS),
  city: z.string().trim().max(80).optional(),
  canton: z.string().trim().max(2).toUpperCase().optional(),
});

async function uniqueSlug(base: string) {
  let slug = slugify(base) || "verein";
  let i = 1;
  while (await db.tenant.findUnique({ where: { slug } })) slug = `${slugify(base)}-${++i}`;
  return slug;
}

export async function createTenantAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const parsed = createTenantSchema.safeParse({
    name: formData.get("name"),
    kind: formData.get("kind") ?? "CLUB",
    city: formData.get("city") || undefined,
    canton: formData.get("canton") || undefined,
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Ungültige Eingabe");
  const tenant = await db.tenant.create({
    data: {
      ...parsed.data,
      slug: await uniqueSlug(parsed.data.name),
      joinCode: randomCode(),
      memberships: { create: { userId: user.id, role: "OWNER" } },
    },
  });
  await setActiveTenantCookie(tenant.id);
  redirect("/");
}

export async function joinTenantAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const code = String(formData.get("joinCode") ?? "").trim().toUpperCase();
  if (!code) return fail("Code fehlt.");
  const limited =
    throttle(`join-user:${user.id}`, THROTTLE.joinCode.limit, THROTTLE.joinCode.windowMs) ??
    throttle(`join-ip:${await clientIp()}`, THROTTLE.joinCode.limit, THROTTLE.joinCode.windowMs);
  if (limited) return fail(limited);
  const tenant = await db.tenant.findUnique({ where: { joinCode: code } });
  if (!tenant || tenant.deletedAt) return fail("Beitrittscode nicht gefunden.");
  const existing = await db.membership.findUnique({ where: { userId_tenantId: { userId: user.id, tenantId: tenant.id } }, select: { status: true } });
  if (existing?.status === "LEFT") return fail("Deine Mitgliedschaft in diesem Verein ist beendet. Bitte wende dich an den Vorstand.");
  if (!existing) {
    try {
      await db.membership.create({ data: { userId: user.id, tenantId: tenant.id, role: "MEMBER", status: "ACTIVE", joinedAt: new Date(`${todayZurich()}T00:00:00Z`) } });
    } catch (e) {
      // Doppelklick: Mitgliedschaft wurde inzwischen angelegt
      if ((e as { code?: string }).code !== "P2002") throw e;
    }
  }
  await setActiveTenantCookie(tenant.id);
  redirect("/");
}

export async function switchTenantAction(tenantId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // user.memberships enthält nur Mitgliedschaften mit Zugang (nicht LEFT, Verein nicht gelöscht).
  const member = user.memberships.some((m) => m.tenantId === tenantId);
  if (!user.isSuperAdmin && !member) return;
  await setActiveTenantCookie(tenantId);
  revalidatePath("/", "layout");
  redirect("/");
}

export async function updateMemberRoleAction(membershipId: string, role: string): Promise<ActionResult> {
  const ctx = await requirePermission("members.manage");
  if (!isTenantRole(role)) return fail("Ungültige Rolle");
  const m = await db.membership.findUnique({ where: { id: membershipId }, include: { user: { select: { name: true } } } });
  if (!m || m.tenantId !== ctx.tenant.id) return fail("Nicht gefunden");
  if (m.role === role) return ok();
  if (m.role === "OWNER" && !ctx.user.isSuperAdmin && ctx.tenant.role !== "OWNER") return fail("Nur Inhaber können Inhaber ändern.");
  if (role === "OWNER" && !ctx.user.isSuperAdmin && ctx.tenant.role !== "OWNER") return fail("Nur Inhaber können Inhaber ernennen.");
  if (m.userId === ctx.user.id && !ctx.user.isSuperAdmin) return fail("Die eigene Rolle kann nur jemand anderes ändern.");
  if (role === "OWNER" && m.status === "LEFT") return fail("Ausgetretene Mitglieder können nicht Inhaber werden.");
  if (m.role === "OWNER" && role !== "OWNER") {
    const owners = await db.membership.count({ where: { tenantId: ctx.tenant.id, role: "OWNER" } });
    if (owners <= 1) return fail("Der Verein braucht mindestens einen Inhaber. Zuerst eine andere Person zum Inhaber machen.");
  }
  await db.membership.update({ where: { id: membershipId }, data: { role } });
  await audit({
    tenantId: ctx.tenant.id, actorId: ctx.user.id, actorName: ctx.user.name, action: "member.role.change", entity: "Membership", entityId: m.id,
    detail: `${m.user.name}: ${ROLE_LABELS[m.role as TenantRole] ?? m.role} → ${ROLE_LABELS[role]}`,
  });
  revalidatePath("/admin/members", "layout");
  revalidatePath("/members");
  return ok(undefined, "Rolle geändert.");
}

/**
 * Mitgliedschaft endgültig löschen (z.B. falsch erfasst). Für reguläre Austritte stattdessen den
 * Status «Ausgetreten» setzen: dann bleiben Daten und Rechnungen beim Mitglied.
 */
export async function removeMemberAction(membershipId: string): Promise<ActionResult> {
  const ctx = await requirePermission("members.manage");
  const m = await db.membership.findUnique({ where: { id: membershipId }, include: { user: { select: { name: true } } } });
  if (!m || m.tenantId !== ctx.tenant.id) return fail("Nicht gefunden");
  if (m.role === "OWNER") return fail("Inhaber können nicht entfernt werden.");
  if (m.userId === ctx.user.id) return fail("Du kannst dich nicht selbst entfernen.");
  await db.membership.delete({ where: { id: membershipId } });
  // Aus allen Chats dieses Vereins entfernen (Nachrichten bleiben erhalten). Ein Fehler hier darf
  // das Entfernen nicht rückgängig machen: Lesezugriffe prüfen die Mitgliedschaft ohnehin.
  try {
    await removeUserFromTenantChats(m.userId, ctx.tenant.id);
  } catch (e) {
    console.error("Chat-Mitgliedschaften konnten nicht entfernt werden:", e);
  }
  if (m.householdId) {
    const h = await db.household.findUnique({ where: { id: m.householdId }, select: { payerUserId: true, memberships: { select: { userId: true }, take: 1 } } });
    if (h && h.payerUserId === m.userId) await db.household.update({ where: { id: m.householdId }, data: { payerUserId: h.memberships[0]?.userId ?? null } });
  }
  await audit({ tenantId: ctx.tenant.id, actorId: ctx.user.id, actorName: ctx.user.name, action: "member.remove", entity: "Membership", entityId: m.id, detail: m.user.name });
  revalidatePath("/admin/members", "layout");
  revalidatePath("/members");
  return ok(undefined, `${m.user.name} entfernt.`);
}

export async function addMemberByEmailAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requirePermission("members.manage");
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 191);
  const role = String(formData.get("role") ?? "MEMBER");
  if (!isTenantRole(role) || role === "OWNER") return fail("Ungültige Rolle");
  const user = await db.user.findUnique({ where: { email } });
  if (!user || user.deletedAt) return fail("Kein Konto mit dieser E-Mail. Stattdessen «Mitglied einladen» verwenden.");
  // Bestehende Mitgliedschaften (inkl. Inhaber) nicht über diesen Weg ändern;
  // Rollenwechsel laufen über updateMemberRoleAction mit den Inhaber-Prüfungen.
  const existing = await db.membership.findUnique({ where: { userId_tenantId: { userId: user.id, tenantId: ctx.tenant.id } } });
  if (existing) return fail(existing.status === "LEFT" ? "War schon Mitglied (ausgetreten) – Status in der Mitgliederliste ändern." : "Bereits Mitglied – Rolle unter Mitglieder ändern.");
  const created = await db.membership.create({ data: { userId: user.id, tenantId: ctx.tenant.id, role, status: "ACTIVE", joinedAt: new Date(`${todayZurich()}T00:00:00Z`) } });
  await audit({ tenantId: ctx.tenant.id, actorId: ctx.user.id, actorName: ctx.user.name, action: "member.add", entity: "Membership", entityId: created.id, detail: `${user.name} als ${ROLE_LABELS[role]}` });
  revalidatePath("/admin/members", "layout");
  return ok(undefined, `${user.name} hinzugefügt.`);
}

export async function regenerateJoinCodeAction(): Promise<ActionResult> {
  const ctx = await requirePermission("tenant.manage");
  await db.tenant.update({ where: { id: ctx.tenant.id }, data: { joinCode: randomCode() } });
  revalidatePath("/admin");
  return ok();
}

export async function setModuleEnabledAction(moduleKey: string, enabled: boolean): Promise<ActionResult> {
  const ctx = await requirePermission("tenant.manage");
  if (!isModuleKey(moduleKey)) return fail("Unbekanntes Modul");
  await db.tenantModule.upsert({
    where: { tenantId_moduleKey: { tenantId: ctx.tenant.id, moduleKey } },
    create: { tenantId: ctx.tenant.id, moduleKey, enabled },
    update: { enabled },
  });
  revalidatePath("/", "layout");
  return ok();
}

/** Webseite normalisieren: «verein.ch» → «https://verein.ch». Nur http(s). */
function normalizeWebsite(raw: string): string | null | false {
  const v = raw.trim();
  if (!v) return null;
  const withProto = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withProto);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    if (!u.hostname.includes(".")) return false;
    return u.toString().slice(0, 190);
  } catch {
    return false;
  }
}

const updateTenantSchema = createTenantSchema.extend({
  description: z.string().trim().max(2000, "Beschreibung zu lang (max. 2000 Zeichen)").optional(),
});
export async function updateTenantAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requirePermission("tenant.manage");
  const parsed = updateTenantSchema.safeParse({
    name: formData.get("name"),
    kind: formData.get("kind") ?? "CLUB",
    city: formData.get("city") || undefined,
    canton: formData.get("canton") || undefined,
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Ungültige Eingabe");
  const website = normalizeWebsite(String(formData.get("website") ?? ""));
  if (website === false) return fail("Ungültige Webseite, z.B. «www.sv-beispiel.ch».", { website: "Ungültige Adresse" });
  const { description, ...rest } = parsed.data;
  await db.tenant.update({
    where: { id: ctx.tenant.id },
    data: { ...rest, city: rest.city ?? null, canton: rest.canton ?? null, description: description || null, website },
  });
  revalidatePath("/", "layout");
  return ok(undefined, "Gespeichert.");
}

// --- Super-Admin -----------------------------------------------------------

export async function superCreateTenantAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireSuperAdmin();
  const parsed = createTenantSchema.safeParse({
    name: formData.get("name"),
    kind: formData.get("kind") ?? "CLUB",
    city: formData.get("city") || undefined,
    canton: formData.get("canton") || undefined,
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Ungültige Eingabe");
  await db.tenant.create({ data: { ...parsed.data, slug: await uniqueSlug(parsed.data.name), joinCode: randomCode() } });
  revalidatePath("/super/tenants");
  return ok(undefined, "Tenant angelegt.");
}
