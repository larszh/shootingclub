"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/tenant";
import { normalizeHex } from "@/lib/brand";
import { readImageFromForm, storeAvatarImage } from "@/lib/image-upload";
import { deleteStoredFile } from "@/lib/storage";
import { fail, ok, type ActionResult } from "@/lib/action-result";

/** Vereinslogo hochladen (FormData-Feld «file»). Nur Admins des aktiven Vereins. */
export async function uploadTenantLogoAction(formData: FormData): Promise<ActionResult> {
  const ctx = await requirePermission("tenant.manage");
  const img = await readImageFromForm(formData);
  if ("error" in img) return fail(img.error);
  const tenantId = ctx.tenant.id;
  const prev = await db.tenant.findUnique({ where: { id: tenantId }, select: { logoPath: true } });
  const rel = await storeAvatarImage("tenant", tenantId, img);
  try {
    await db.tenant.update({ where: { id: tenantId }, data: { logoPath: rel } });
  } catch {
    await deleteStoredFile(rel);
    return fail("Speichern fehlgeschlagen. Bitte nochmals versuchen.");
  }
  if (prev?.logoPath && prev.logoPath !== rel) await deleteStoredFile(prev.logoPath);
  revalidatePath("/", "layout");
  return ok(undefined, "Logo gespeichert.");
}

export async function removeTenantLogoAction(): Promise<ActionResult> {
  const ctx = await requirePermission("tenant.manage");
  const prev = await db.tenant.findUnique({ where: { id: ctx.tenant.id }, select: { logoPath: true } });
  if (!prev?.logoPath) return ok();
  await db.tenant.update({ where: { id: ctx.tenant.id }, data: { logoPath: null } });
  await deleteStoredFile(prev.logoPath);
  revalidatePath("/", "layout");
  return ok(undefined, "Logo entfernt.");
}

/** Akzentfarbe(n) setzen. Leere Werte setzen auf Standard zurück. */
export async function updateBrandColorsAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requirePermission("tenant.manage");
  const raw1 = String(formData.get("brandColor") ?? "").trim();
  const raw2 = String(formData.get("brandColor2") ?? "").trim();
  const c1 = raw1 ? normalizeHex(raw1) : null;
  const c2 = raw2 ? normalizeHex(raw2) : null;
  if (raw1 && !c1) return fail("Ungültige Akzentfarbe. Bitte im Format #RRGGBB eingeben.", { brandColor: "Format #RRGGBB" });
  if (raw2 && !c2) return fail("Ungültige Zweitfarbe. Bitte im Format #RRGGBB eingeben.", { brandColor2: "Format #RRGGBB" });
  await db.tenant.update({ where: { id: ctx.tenant.id }, data: { brandColor: c1, brandColor2: c1 ? c2 : null } });
  revalidatePath("/", "layout");
  return ok(undefined, c1 ? "Farben gespeichert." : "Standardfarben wiederhergestellt.");
}

export async function resetBrandColorsAction(): Promise<ActionResult> {
  const ctx = await requirePermission("tenant.manage");
  await db.tenant.update({ where: { id: ctx.tenant.id }, data: { brandColor: null, brandColor2: null } });
  revalidatePath("/", "layout");
  return ok(undefined, "Standardfarben wiederhergestellt.");
}
