"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { requireModule, requirePermission, requireSuperAdmin } from "@/lib/tenant";
import { deleteStoredFile, saveFile } from "@/lib/storage";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { getTarget } from "./queries";
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES, PAPER_SIZES, PARAM_INFO, subjectVariants, targetInputSchema, type ParamKey, type TargetInput } from "./types";

function parseTargetForm(formData: FormData) {
  const subject = String(formData.get("subject") ?? "");
  const params: Record<string, unknown> = {};
  for (const [k, info] of Object.entries(PARAM_INFO) as [ParamKey, (typeof PARAM_INFO)[ParamKey]][]) {
    if (info.kind === "bool") {
      // Checkbox sendet "true"/"on", ein verstecktes Feld "false" – fehlt beides, bleibt der Default.
      const all = formData.getAll(k).map(String);
      if (all.length) params[k] = all.includes("true") || all.includes("on");
      continue;
    }
    const v = formData.get(k);
    if (v !== null && String(v).trim() !== "") params[k] = String(v).trim();
  }
  // Nur Varianten zulassen, die das Sujet kennt
  if (params.variant !== undefined && !subjectVariants(subject).includes(String(params.variant))) delete params.variant;
  return targetInputSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    subject,
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
    if (!first) return fail("Ungültige Eingabe");
    const key = first.path[first.path.length - 1];
    const label = first.path[0] === "params" && typeof key === "string" && key in PARAM_INFO ? PARAM_INFO[key as ParamKey].label : first.path[0] === "name" ? "Name" : first.path[0] === "paperSizes" ? "Formate" : String(first.path.join("."));
    return fail(`${label}: ${first.message}`);
  }
  const input = parsed.data;

  // Zuerst Berechtigung und Besitz prüfen, erst danach Dateien speichern (keine verwaisten Uploads).
  let target: { tenantId: string | null; ownerUserId: string | null; sharedWithTenant?: boolean };
  let existing: { id: string; filePath: string | null } | null = null;
  let redirectTo = "/targets";
  if (scope === "global") {
    await requireSuperAdmin();
    target = { tenantId: null, ownerUserId: null, sharedWithTenant: false };
    redirectTo = "/super/targets";
    if (id) {
      const ex = await db.targetTemplate.findUnique({ where: { id } });
      if (!ex || ex.tenantId !== null || ex.ownerUserId !== null) return fail("Nicht gefunden");
      existing = ex;
    }
  } else if (scope === "tenant") {
    const ctx = await requirePermission("tenant.targets.manage");
    target = { tenantId: ctx.tenant.id, ownerUserId: null, sharedWithTenant: false };
    if (id) {
      const ex = await db.targetTemplate.findUnique({ where: { id } });
      if (!ex || ex.tenantId !== ctx.tenant.id || ex.ownerUserId !== null) return fail("Nicht gefunden");
      existing = ex;
    }
  } else {
    const ctx = await requireModule("targets");
    target = { tenantId: ctx.tenant.id, ownerUserId: ctx.user.id };
    if (id) {
      const ex = await db.targetTemplate.findUnique({ where: { id } });
      if (!ex || ex.ownerUserId !== ctx.user.id) return fail("Nicht gefunden");
      existing = ex;
    }
  }

  const upload = await handleUpload(formData);
  if (upload && "error" in upload) return fail(upload.error);
  if (input.subject === "UPLOAD" && !upload && !existing?.filePath) return fail("Bitte eine Datei hochladen.");

  const fileFields = upload ? { filePath: upload.filePath, mimeType: upload.mimeType } : {};
  const data = { ...targetData(input), ...fileFields, ...target };

  if (existing) {
    if (upload && existing.filePath) await deleteStoredFile(existing.filePath);
    await db.targetTemplate.update({ where: { id: existing.id }, data });
  } else {
    await db.targetTemplate.create({ data });
  }
  revalidatePath("/targets");
  if (scope === "global") revalidatePath("/super/targets");
  redirect(redirectTo);
}

export async function setTargetHiddenAction(targetId: string, hidden: boolean): Promise<ActionResult> {
  const ctx = await requirePermission("tenant.targets.manage");
  if (!(await getTarget(ctx, String(targetId)))) return fail("Nicht gefunden");
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
  if (!(await getTarget(ctx, String(targetId)))) return fail("Nicht gefunden");
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
