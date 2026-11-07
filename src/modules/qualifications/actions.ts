"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { accessStatusWhere } from "@/lib/membership-access";
import { audit } from "@/lib/audit";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { getRequestLocale, getT } from "@/lib/i18n";
import { msg, tMsg } from "@/lib/i18n/extra/admin2/msg";
import { requireTenant } from "@/lib/tenant";
import { dayToDbDate, QUALIFICATION_KIND_KEYS, qualificationLabel } from "./types";

/** Fehlende Berechtigung, in der Sprache der Person. */
async function noRight() {
  return fail(getT(await getRequestLocale())("money.err.noPermission"));
}

const idSchema = z.string().min(1).max(40);
const optDay = z.string().trim().transform((v) => v || null).pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "adm2.qual.v.date").nullable());
const optText = (max: number) => z.string().trim().max(max, msg("adm2.common.maxChars", { max })).transform((v) => v || null);

const schema = z.object({
  userId: idSchema,
  kind: z.enum(QUALIFICATION_KIND_KEYS as [string, ...string[]], { message: "adm2.qual.v.kind" }),
  label: optText(191),
  number: optText(191),
  validFrom: optDay,
  validUntil: optDay,
  note: optText(191),
}).refine((v) => !v.validFrom || !v.validUntil || v.validFrom <= v.validUntil, { message: "adm2.qual.v.order", path: ["validUntil"] });

const tr = async () => getT(await getRequestLocale());
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
  const t = await tr();
  const ctx = await manageCtx();
  if (!ctx) return noRight();
  const id = str(fd, "id") || null;
  if (id && !idSchema.safeParse(id).success) return fail(t("adm2.common.invalidRequest"));
  const parsed = schema.safeParse({
    userId: str(fd, "userId"), kind: str(fd, "kind"), label: str(fd, "label"), number: str(fd, "number"),
    validFrom: str(fd, "validFrom"), validUntil: str(fd, "validUntil"), note: str(fd, "note"),
  });
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    const field = i?.path[0] != null ? String(i.path[0]) : undefined;
    const m = field === "userId" ? t("adm2.qual.msg.chooseMember") : tMsg(t, i?.message ?? "adm2.common.invalidInput");
    return fail(m, field ? { [field]: m } : undefined);
  }
  const v = parsed.data;
  const tenantId = ctx.tenant.id;
  const member = await db.membership.findFirst({ where: { tenantId, userId: v.userId, status: accessStatusWhere(), user: { deletedAt: null } }, select: { user: { select: { name: true } } } });
  if (!member) return fail(t("adm2.qual.msg.memberNotFound"), { userId: t("adm2.qual.msg.memberNotFound") });
  const data = {
    userId: v.userId, kind: v.kind, label: v.label, number: v.number, note: v.note,
    validFrom: v.validFrom ? dayToDbDate(v.validFrom) : null,
    validUntil: v.validUntil ? dayToDbDate(v.validUntil) : null,
  };
  const detail = `${member.user.name}: ${qualificationLabel(v.kind)}${v.label ? ` (${v.label})` : ""}${v.validUntil ? `, gültig bis ${v.validUntil}` : ""}`;
  if (id) {
    const res = await db.qualification.updateMany({ where: { id, tenantId }, data: { ...data, verifiedById: ctx.user.id } });
    if (!res.count) return fail(t("adm2.qual.msg.notFound"));
    await audit({ tenantId, actorId: ctx.user.id, actorName: ctx.user.name, action: "qualification.update", entity: "Qualification", entityId: id, detail });
  } else {
    const row = await db.qualification.create({ data: { ...data, tenantId, verifiedById: ctx.user.id }, select: { id: true } });
    await audit({ tenantId, actorId: ctx.user.id, actorName: ctx.user.name, action: "qualification.create", entity: "Qualification", entityId: row.id, detail });
  }
  revalidate();
  return ok(undefined, id ? t("adm2.qual.msg.saved") : t("adm2.qual.msg.created"));
}

export async function deleteQualificationAction(id: string): Promise<ActionResult> {
  const t = await tr();
  const ctx = await manageCtx();
  if (!ctx) return noRight();
  if (!idSchema.safeParse(id).success) return fail(t("adm2.common.invalidRequest"));
  const tenantId = ctx.tenant.id;
  const q = await db.qualification.findFirst({ where: { id, tenantId }, select: { kind: true, label: true, user: { select: { name: true } } } });
  if (!q) return fail(t("adm2.qual.msg.notFound"));
  await db.qualification.deleteMany({ where: { id, tenantId } });
  await audit({ tenantId, actorId: ctx.user.id, actorName: ctx.user.name, action: "qualification.delete", entity: "Qualification", entityId: id, detail: `${q.user.name}: ${qualificationLabel(q.kind)}${q.label ? ` (${q.label})` : ""}` });
  revalidate();
  return ok(undefined, t("adm2.qual.msg.deleted"));
}
