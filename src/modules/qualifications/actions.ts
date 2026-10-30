"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireTenant } from "@/lib/tenant";
import { dayToDbDate, QUALIFICATION_KIND_KEYS, qualificationLabel } from "./types";

const idSchema = z.string().min(1).max(40);
const optDay = z.string().trim().transform((v) => v || null).pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Bitte ein gültiges Datum wählen.").nullable());
const optText = (max: number) => z.string().trim().max(max, `Höchstens ${max} Zeichen.`).transform((v) => v || null);

const schema = z.object({
  userId: idSchema,
  kind: z.enum(QUALIFICATION_KIND_KEYS as [string, ...string[]], { message: "Bitte eine Art wählen." }),
  label: optText(191),
  number: optText(191),
  validFrom: optDay,
  validUntil: optDay,
  note: optText(191),
}).refine((v) => !v.validFrom || !v.validUntil || v.validFrom <= v.validUntil, { message: "«Gültig bis» liegt vor «Gültig ab».", path: ["validUntil"] });

const str = (fd: FormData, k: string) => (fd.get(k) === null ? "" : String(fd.get(k)));

async function manageCtx() {
  const ctx = await requireTenant();
  return ctx.can("qualifications.manage") ? ctx : null;
}

const revalidate = () => {
  revalidatePath("/admin/qualifications");
  revalidatePath("/shifts", "layout");
  revalidatePath("/admin/shifts", "layout");
  revalidatePath("/range", "layout");
};

/** Qualifikation erfassen oder bearbeiten (qualifications.manage). Erfassende Person gilt als «geprüft von». */
export async function saveQualificationAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await manageCtx();
  if (!ctx) return fail("Dafür fehlt dir die Berechtigung.");
  const id = str(fd, "id") || null;
  if (id && !idSchema.safeParse(id).success) return fail("Ungültige Anfrage.");
  const parsed = schema.safeParse({
    userId: str(fd, "userId"), kind: str(fd, "kind"), label: str(fd, "label"), number: str(fd, "number"),
    validFrom: str(fd, "validFrom"), validUntil: str(fd, "validUntil"), note: str(fd, "note"),
  });
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    const field = i?.path[0] != null ? String(i.path[0]) : undefined;
    return fail(field === "userId" ? "Bitte ein Mitglied wählen." : i?.message ?? "Ungültige Eingabe.", field ? { [field]: field === "userId" ? "Bitte ein Mitglied wählen." : i!.message } : undefined);
  }
  const v = parsed.data;
  const tenantId = ctx.tenant.id;
  const member = await db.membership.findFirst({ where: { tenantId, userId: v.userId, status: { not: "LEFT" }, user: { deletedAt: null } }, select: { user: { select: { name: true } } } });
  if (!member) return fail("Mitglied nicht gefunden.", { userId: "Mitglied nicht gefunden." });
  const data = {
    userId: v.userId, kind: v.kind, label: v.label, number: v.number, note: v.note,
    validFrom: v.validFrom ? dayToDbDate(v.validFrom) : null,
    validUntil: v.validUntil ? dayToDbDate(v.validUntil) : null,
  };
  const detail = `${member.user.name}: ${qualificationLabel(v.kind)}${v.label ? ` (${v.label})` : ""}${v.validUntil ? `, gültig bis ${v.validUntil}` : ""}`;
  if (id) {
    const res = await db.qualification.updateMany({ where: { id, tenantId }, data: { ...data, verifiedById: ctx.user.id } });
    if (!res.count) return fail("Qualifikation nicht gefunden.");
    await audit({ tenantId, actorId: ctx.user.id, actorName: ctx.user.name, action: "qualification.update", entity: "Qualification", entityId: id, detail });
  } else {
    const row = await db.qualification.create({ data: { ...data, tenantId, verifiedById: ctx.user.id }, select: { id: true } });
    await audit({ tenantId, actorId: ctx.user.id, actorName: ctx.user.name, action: "qualification.create", entity: "Qualification", entityId: row.id, detail });
  }
  revalidate();
  return ok(undefined, id ? "Qualifikation gespeichert." : "Qualifikation erfasst.");
}

export async function deleteQualificationAction(id: string): Promise<ActionResult> {
  const ctx = await manageCtx();
  if (!ctx) return fail("Dafür fehlt dir die Berechtigung.");
  if (!idSchema.safeParse(id).success) return fail("Ungültige Anfrage.");
  const tenantId = ctx.tenant.id;
  const q = await db.qualification.findFirst({ where: { id, tenantId }, select: { kind: true, label: true, user: { select: { name: true } } } });
  if (!q) return fail("Qualifikation nicht gefunden.");
  await db.qualification.deleteMany({ where: { id, tenantId } });
  await audit({ tenantId, actorId: ctx.user.id, actorName: ctx.user.name, action: "qualification.delete", entity: "Qualification", entityId: id, detail: `${q.user.name}: ${qualificationLabel(q.kind)}${q.label ? ` (${q.label})` : ""}` });
  revalidate();
  return ok(undefined, "Qualifikation gelöscht.");
}
