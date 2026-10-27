"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { requireModule, requirePermission, requireSuperAdmin } from "@/lib/tenant";
import { deleteStoredFile, saveFile } from "@/lib/storage";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES, PAPER_SIZES, targetInputSchema, type TargetInput } from "./types";

function parseTargetForm(formData: FormData) {
  const params: Record<string, unknown> = {};
  for (const k of ["diameterMm", "columns", "rows", "gridMm", "blackFrom"]) {
    const v = formData.get(k);
    if (v !== null && String(v).trim() !== "") params[k] = v;
  }
  if (formData.get("numbers") !== null) params.numbers = formData.get("numbers") === "on" || formData.get("numbers") === "true";
  return targetInputSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    subject: formData.get("subject"),
    paperSizes: PAPER_SIZES.filter((s) => formData.getAll("paperSizes").includes(s)),
    params,
    sharedWithTenant: formData.get("sharedWithTenant") === "on",
  });
}

function targetData(input: TargetInput) {
  return {
    name: input.name,
    description: input.description ?? null,
    subject: input.subject,
    paperSizes: input.paperSizes.join(","),
    paramsJson: JSON.stringify(input.params ?? {}),
    sharedWithTenant: input.sharedWithTenant,
  };
}

async function handleUpload(formData: FormData): Promise<{ filePath: string; mimeType: string } | { error: string } | null> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return null;
  const ext = ALLOWED_UPLOAD_TYPES[file.type];
  if (!ext) return { error: "Nur PNG, JPG, SVG oder PDF." };
  if (file.size > MAX_UPLOAD_BYTES) return { error: "Datei zu gross (max. 8 MB)." };
  const rel = `targets/${randomBytes(12).toString("hex")}.${ext}`;
  await saveFile(rel, Buffer.from(await file.arrayBuffer()));
  return { filePath: rel, mimeType: file.type };
}

/**
 * scope = "global" (Super-Admin), "tenant" (Tenant-Admin) oder "mine" (eigener Upload).
 */
export async function saveTargetAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const scope = String(formData.get("scope") ?? "mine");
  const id = formData.get("id") ? String(formData.get("id")) : null;
  const parsed = parseTargetForm(formData);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return fail(first ? `${first.path.join(".")}: ${first.message}` : "Ungültige Eingabe");
  }
  const input = parsed.data;

  const upload = await handleUpload(formData);
  if (upload && "error" in upload) return fail(upload.error);
  if (input.subject === "UPLOAD" && !upload && !id) return fail("Bitte eine Datei hochladen.");

  const fileFields = upload ? { filePath: upload.filePath, mimeType: upload.mimeType } : {};

  if (scope === "global") {
    const user = await requireSuperAdmin();
    if (id) {
      const ex = await db.targetTemplate.findUnique({ where: { id } });
      if (!ex || ex.tenantId !== null || ex.ownerUserId !== null) return fail("Nicht gefunden");
      if (upload && ex.filePath) await deleteStoredFile(ex.filePath);
      await db.targetTemplate.update({ where: { id }, data: { ...targetData(input), ...fileFields, sharedWithTenant: false } });
    } else {
      await db.targetTemplate.create({ data: { ...targetData(input), ...fileFields, tenantId: null, ownerUserId: null, sharedWithTenant: false } });
    }
    void user;
    revalidatePath("/super/targets");
    revalidatePath("/targets");
    redirect("/super/targets");
  }

  if (scope === "tenant") {
    const ctx = await requirePermission("tenant.targets.manage");
    if (id) {
      const ex = await db.targetTemplate.findUnique({ where: { id } });
      if (!ex || ex.tenantId !== ctx.tenant.id || ex.ownerUserId !== null) return fail("Nicht gefunden");
      if (upload && ex.filePath) await deleteStoredFile(ex.filePath);
      await db.targetTemplate.update({ where: { id }, data: { ...targetData(input), ...fileFields, sharedWithTenant: false } });
    } else {
      await db.targetTemplate.create({ data: { ...targetData(input), ...fileFields, tenantId: ctx.tenant.id, ownerUserId: null, sharedWithTenant: false } });
    }
    revalidatePath("/targets");
    redirect("/targets");
  }

  const ctx = await requireModule("targets");
  if (id) {
    const ex = await db.targetTemplate.findUnique({ where: { id } });
    if (!ex || ex.ownerUserId !== ctx.user.id) return fail("Nicht gefunden");
    if (upload && ex.filePath) await deleteStoredFile(ex.filePath);
    await db.targetTemplate.update({ where: { id }, data: { ...targetData(input), ...fileFields, tenantId: ctx.tenant.id } });
  } else {
    await db.targetTemplate.create({ data: { ...targetData(input), ...fileFields, tenantId: ctx.tenant.id, ownerUserId: ctx.user.id } });
  }
  revalidatePath("/targets");
  redirect("/targets");
}

export async function setTargetHiddenAction(targetId: string, hidden: boolean): Promise<ActionResult> {
  const ctx = await requirePermission("tenant.targets.manage");
  await db.targetTenantSetting.upsert({
    where: { targetId_tenantId: { targetId, tenantId: ctx.tenant.id } },
    create: { targetId, tenantId: ctx.tenant.id, hidden },
    update: { hidden },
  });
  revalidatePath("/targets");
  return ok();
}

export async function toggleTargetFavoriteAction(targetId: string): Promise<ActionResult<{ favorite: boolean }>> {
  const ctx = await requireModule("targets");
  const ex = await db.targetFavorite.findUnique({ where: { userId_targetId: { userId: ctx.user.id, targetId } } });
  if (ex) await db.targetFavorite.delete({ where: { id: ex.id } });
  else await db.targetFavorite.create({ data: { userId: ctx.user.id, targetId } });
  revalidatePath("/targets");
  return ok({ favorite: !ex });
}

export async function deleteTargetAction(targetId: string): Promise<ActionResult> {
  const ctx = await requireModule("targets");
  const t = await db.targetTemplate.findUnique({ where: { id: targetId } });
  if (!t) return fail("Nicht gefunden");
  const allowed =
    (t.ownerUserId && t.ownerUserId === ctx.user.id) ||
    (t.tenantId === ctx.tenant.id && t.ownerUserId === null && ctx.can("tenant.targets.manage")) ||
    (t.tenantId === null && ctx.user.isSuperAdmin);
  if (!allowed) return fail("Keine Berechtigung");
  if (t.filePath) await deleteStoredFile(t.filePath);
  await db.targetTemplate.delete({ where: { id: targetId } });
  revalidatePath("/targets");
  revalidatePath("/super/targets");
  return ok();
}
