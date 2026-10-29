"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireSuperAdmin } from "@/lib/tenant";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { enqueueMail, renderMail } from "@/lib/mail";
import { formatDate as formatDateLocale, getT } from "@/lib/i18n";
import { purgeDateFrom } from "./tenant-purge";

/** Informiert die Inhaber eines Vereins über die geplante Löschung. Wirft nie. */
async function notifyOwnersOfDeletion(tenant: { id: string; name: string; defaultLocale: string }, purgeAfter: Date) {
  try {
    const owners = await db.membership.findMany({
      where: { tenantId: tenant.id, role: "OWNER", status: { not: "LEFT" }, user: { deletedAt: null } },
      select: { user: { select: { email: true, name: true, locale: true } } },
    });
    for (const { user } of owners) {
      const locale = user.locale || tenant.defaultLocale;
      const t = getT(locale);
      const date = formatDateLocale(purgeAfter, locale, { day: "2-digit", month: "2-digit", year: "numeric" });
      const mail = renderMail({
        locale,
        tenantName: tenant.name,
        title: t("ops.tenantDeletion.title"),
        paragraphs: [t("mail.greeting", { name: user.name }), t("ops.tenantDeletion.p1", { tenant: tenant.name }), t("ops.tenantDeletion.p2", { date })],
        footer: t("mail.footer"),
      });
      await enqueueMail({ tenantId: null, kind: "tenant-deletion", to: user.email, toName: user.name, subject: t("ops.tenantDeletion.subject", { tenant: tenant.name }), html: mail.html, text: mail.text, replyTo: null });
    }
  } catch (e) {
    console.warn("[super] Inhaber nicht benachrichtigt:", e instanceof Error ? e.message : e);
  }
}

const idSchema = z.string().min(1).max(191);

/**
 * Löschantrag für einen Verein (Soft-Delete). Der Verein ist sofort für Mitglieder
 * unsichtbar und wird nach 30 Tagen vom Hintergrundjob endgültig gelöscht.
 * confirmSlug muss dem Kürzel des Vereins entsprechen (Schutz vor Versehen).
 */
export async function requestTenantDeletion(tenantId: string, confirmSlug: string): Promise<ActionResult<{ purgeAfter: string }>> {
  const me = await requireSuperAdmin();
  const id = idSchema.safeParse(tenantId);
  if (!id.success) return fail("Ungültiger Verein.");
  const t = await db.tenant.findUnique({ where: { id: id.data }, select: { id: true, slug: true, name: true, deletedAt: true, defaultLocale: true } });
  if (!t) return fail("Verein nicht gefunden.");
  if (t.deletedAt) return fail("Die Löschung ist bereits geplant.");
  if ((confirmSlug ?? "").trim().toLowerCase() !== t.slug.toLowerCase()) return fail(`Bitte zur Bestätigung «${t.slug}» eintippen.`);
  const now = new Date();
  const purgeAfter = purgeDateFrom(now);
  await db.tenant.update({ where: { id: t.id }, data: { deletedAt: now, purgeAfter } });
  await audit({ tenantId: t.id, actorId: me.id, actorName: me.name, action: "tenant.delete.request", entity: "Tenant", entityId: t.id, detail: `${t.name} (${t.slug}), endgültig ab ${purgeAfter.toISOString().slice(0, 10)}` });
  await notifyOwnersOfDeletion(t, purgeAfter);
  revalidatePath("/super/tenants");
  revalidatePath("/", "layout");
  return ok({ purgeAfter: purgeAfter.toISOString() }, "Löschung geplant.");
}

/** Hebt einen Löschantrag auf, solange der Verein noch nicht endgültig gelöscht ist. */
export async function restoreTenant(tenantId: string): Promise<ActionResult> {
  const me = await requireSuperAdmin();
  const id = idSchema.safeParse(tenantId);
  if (!id.success) return fail("Ungültiger Verein.");
  const t = await db.tenant.findUnique({ where: { id: id.data }, select: { id: true, slug: true, name: true, deletedAt: true } });
  if (!t) return fail("Verein nicht gefunden – vermutlich bereits endgültig gelöscht.");
  if (!t.deletedAt) return ok(undefined, "Der Verein ist aktiv.");
  // Nur innerhalb der Frist: ist purgeAfter erreicht, kann der Löschjob bereits laufen
  // (gleiche Bedingung wie in purgeTenantNow). Bedingtes Update statt Lesen-dann-Schreiben.
  const restored = await db.tenant.updateMany({
    where: { id: t.id, deletedAt: { not: null }, OR: [{ purgeAfter: null }, { purgeAfter: { gt: new Date() } }] },
    data: { deletedAt: null, purgeAfter: null },
  });
  if (restored.count === 0) return fail("Die Frist ist abgelaufen, der Verein wird endgültig gelöscht und kann nicht mehr wiederhergestellt werden.");
  await audit({ tenantId: t.id, actorId: me.id, actorName: me.name, action: "tenant.delete.restore", entity: "Tenant", entityId: t.id, detail: `${t.name} (${t.slug})` });
  revalidatePath("/super/tenants");
  revalidatePath("/", "layout");
  return ok(undefined, "Verein wiederhergestellt.");
}

/** Super-Admin-Recht vergeben oder entziehen (mit Audit-Eintrag). */
export async function superSetSuperAdmin(userId: string, value: boolean): Promise<ActionResult> {
  const me = await requireSuperAdmin();
  const id = idSchema.safeParse(userId);
  if (!id.success) return fail("Ungültiges Konto.");
  if (me.id === id.data && !value) return fail("Du kannst dir selbst den Super-Admin nicht entziehen.");
  const u = await db.user.findUnique({ where: { id: id.data }, select: { id: true, email: true, deletedAt: true } });
  if (!u) return fail("Konto nicht gefunden.");
  if (u.deletedAt && value) return fail("Gelöschte Konten können keine Rechte erhalten.");
  await db.user.update({ where: { id: u.id }, data: { isSuperAdmin: value } });
  await audit({ actorId: me.id, actorName: me.name, action: value ? "user.superadmin.grant" : "user.superadmin.revoke", entity: "User", entityId: u.id, detail: u.email });
  revalidatePath("/super/users");
  return ok(undefined, value ? "Super-Admin vergeben." : "Super-Admin entzogen.");
}
