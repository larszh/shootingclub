"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getAppContext, requirePermission, requireSuperAdmin, setActiveTenantCookie } from "@/lib/tenant";
import { isModuleKey } from "@/lib/modules";
import { isTenantRole } from "@/lib/permissions";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { randomCode, slugify } from "@/lib/utils";

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
  const tenant = await db.tenant.findUnique({ where: { joinCode: code } });
  if (!tenant) return fail("Beitrittscode nicht gefunden.");
  await db.membership.upsert({
    where: { userId_tenantId: { userId: user.id, tenantId: tenant.id } },
    create: { userId: user.id, tenantId: tenant.id, role: "MEMBER" },
    update: {},
  });
  await setActiveTenantCookie(tenant.id);
  redirect("/");
}

export async function switchTenantAction(tenantId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const allowed = user.isSuperAdmin || user.memberships.some((m) => m.tenantId === tenantId);
  if (!allowed) return;
  await setActiveTenantCookie(tenantId);
  revalidatePath("/", "layout");
  redirect("/");
}

export async function updateMemberRoleAction(membershipId: string, role: string): Promise<ActionResult> {
  const ctx = await requirePermission("tenant.manage");
  if (!isTenantRole(role)) return fail("Ungültige Rolle");
  const m = await db.membership.findUnique({ where: { id: membershipId } });
  if (!m || m.tenantId !== ctx.tenant.id) return fail("Nicht gefunden");
  if (m.role === "OWNER" && !ctx.user.isSuperAdmin && ctx.tenant.role !== "OWNER") return fail("Nur Inhaber können Inhaber ändern.");
  if (role === "OWNER" && !ctx.user.isSuperAdmin && ctx.tenant.role !== "OWNER") return fail("Nur Inhaber können Inhaber ernennen.");
  await db.membership.update({ where: { id: membershipId }, data: { role } });
  revalidatePath("/admin/members");
  return ok();
}

export async function removeMemberAction(membershipId: string): Promise<ActionResult> {
  const ctx = await requirePermission("tenant.manage");
  const m = await db.membership.findUnique({ where: { id: membershipId } });
  if (!m || m.tenantId !== ctx.tenant.id) return fail("Nicht gefunden");
  if (m.role === "OWNER") return fail("Inhaber können nicht entfernt werden.");
  await db.membership.delete({ where: { id: membershipId } });
  revalidatePath("/admin/members");
  return ok();
}

export async function addMemberByEmailAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requirePermission("tenant.manage");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "MEMBER");
  if (!isTenantRole(role) || role === "OWNER") return fail("Ungültige Rolle");
  const user = await db.user.findUnique({ where: { email } });
  if (!user) return fail("Kein Konto mit dieser E-Mail. Die Person kann sich mit dem Beitrittscode registrieren.");
  await db.membership.upsert({
    where: { userId_tenantId: { userId: user.id, tenantId: ctx.tenant.id } },
    create: { userId: user.id, tenantId: ctx.tenant.id, role },
    update: { role },
  });
  revalidatePath("/admin/members");
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

export async function superSetSuperAdminAction(userId: string, value: boolean): Promise<ActionResult> {
  const me = await requireSuperAdmin();
  if (me.id === userId && !value) return fail("Du kannst dir selbst den Super-Admin nicht entziehen.");
  await db.user.update({ where: { id: userId }, data: { isSuperAdmin: value } });
  revalidatePath("/super/users");
  return ok();
}

export async function superDeleteTenantAction(tenantId: string): Promise<ActionResult> {
  await requireSuperAdmin();
  await db.tenant.delete({ where: { id: tenantId } });
  revalidatePath("/super/tenants");
  return ok();
}

export async function updateProfileAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await getAppContext();
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return fail("Name zu kurz");
  const opt = (k: string) => { const v = String(formData.get(k) ?? "").trim(); return v ? v.slice(0, 80) : null; };
  await db.user.update({ where: { id: ctx.user.id }, data: { name, street: opt("street"), zip: opt("zip"), city: opt("city") } });
  revalidatePath("/", "layout");
  return ok(undefined, "Gespeichert.");
}
