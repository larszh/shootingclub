"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { destroySession, getCurrentUser, throttle, verifyPassword } from "@/lib/auth";
import { fail, type ActionResult } from "@/lib/action-result";
import { auditAccountDeletion, pseudonymizeUser, sendAccountDeletedMail, soleOwnerTenants } from "@/modules/core/privacy";

const schema = z.object({
  password: z.string().min(1, "Bitte Passwort eingeben.").max(191),
  confirm: z.literal("on", { message: "Bitte bestätigen, dass du das Konto löschen möchtest." }),
});

/** Konto löschen (Pseudonymisierung). Verlangt das Passwort; nicht möglich als einziger Inhaber eines Vereins. */
export async function deleteAccountAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  const parsed = schema.safeParse({ password: formData.get("password") ?? "", confirm: formData.get("confirm") ?? "" });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = String(issue?.path[0] ?? "password");
    return fail(issue?.message ?? "Ungültige Eingabe", { [field]: issue?.message ?? "Ungültig" });
  }
  const limited = throttle(`delete-account:${me.id}`, 5, 15 * 60_000);
  if (limited) return fail(limited);

  const user = await db.user.findUnique({ where: { id: me.id }, select: { passwordHash: true, deletedAt: true } });
  if (!user || user.deletedAt) redirect("/login");
  if (!(await verifyPassword(parsed.data.password, user.passwordHash))) return fail("Das Passwort stimmt nicht.", { password: "Passwort stimmt nicht" });

  const blockers = await soleOwnerTenants(me.id);
  if (blockers.length) {
    return fail(`Du bist einzige Inhaberin bzw. einziger Inhaber von ${blockers.map((b) => `«${b.name}»`).join(", ")}. Bitte zuerst eine andere Person zur Inhaberin bzw. zum Inhaber machen oder den Verein löschen lassen.`);
  }

  const tenantIds = me.memberships.map((m) => m.tenantId);
  const before = await pseudonymizeUser(me.id);
  if (!before) return fail("Das Konto konnte nicht gelöscht werden.");
  await auditAccountDeletion(me.id, tenantIds);
  await sendAccountDeletedMail(before);
  await destroySession().catch(() => undefined);
  redirect("/login?deleted=1");
}
