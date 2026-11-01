"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { destroySession, getCurrentUser, throttle, verifyPassword } from "@/lib/auth";
import { fail, type ActionResult } from "@/lib/action-result";
import { getRequestLocale, getT, type TFunction } from "@/lib/i18n";
import { auditAccountDeletion, pseudonymizeUser, sendAccountDeletedMail, soleOwnerTenants } from "@/modules/core/privacy";

function schema(t: TFunction) {
  return z.object({
    password: z.string().min(1, t("shell.privacy.msg.enterPassword")).max(191),
    confirm: z.literal("on", { message: t("shell.privacy.msg.confirm") }),
  });
}

/** Konto löschen (Pseudonymisierung). Verlangt das Passwort; nicht möglich als einziger Inhaber eines Vereins. */
export async function deleteAccountAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  const t = getT(await getRequestLocale());
  const parsed = schema(t).safeParse({ password: formData.get("password") ?? "", confirm: formData.get("confirm") ?? "" });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = String(issue?.path[0] ?? "password");
    return fail(issue?.message ?? t("shell.privacy.msg.invalid"), { [field]: issue?.message ?? t("shell.privacy.msg.invalidShort") });
  }
  const limited = throttle(`delete-account:${me.id}`, 5, 15 * 60_000);
  if (limited) {
    const m = limited.match(/(\d+) Minute/);
    const minutes = m ? Number(m[1]) : null;
    return fail(minutes === null ? limited : minutes === 1 ? t("shell.msg.throttleOne") : t("shell.msg.throttle", { minutes }));
  }

  const user = await db.user.findUnique({ where: { id: me.id }, select: { passwordHash: true, deletedAt: true } });
  if (!user || user.deletedAt) redirect("/login");
  if (!(await verifyPassword(parsed.data.password, user.passwordHash))) return fail(t("shell.security.msg.passwordWrong"), { password: t("shell.privacy.msg.passwordWrongShort") });

  const blockers = await soleOwnerTenants(me.id);
  if (blockers.length) {
    return fail(t("shell.privacy.msg.soleOwner", { clubs: blockers.map((b) => t("shell.quoted", { text: b.name })).join(", ") }));
  }

  const tenantIds = me.memberships.map((m) => m.tenantId);
  const before = await pseudonymizeUser(me.id);
  if (!before) return fail(t("shell.privacy.msg.failed"));
  await auditAccountDeletion(me.id, tenantIds);
  await sendAccountDeletedMail(before);
  await destroySession().catch(() => undefined);
  redirect("/login?deleted=1");
}
