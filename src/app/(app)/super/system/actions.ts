"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/tenant";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { audit } from "@/lib/audit";
import { mailTest } from "@/lib/mail/platform-mails";
import { smtpConfigured } from "@/lib/mail/transport";
import { runJobNow } from "@/lib/jobs";

export async function retryMailAction(id: string): Promise<ActionResult> {
  const user = await requireSuperAdmin();
  const res = await db.mailMessage.updateMany({
    where: { id: String(id), status: { in: ["FAILED", "SKIPPED"] } },
    data: { status: "QUEUED", attempts: 0, lastError: null, sendAfter: new Date() },
  });
  if (!res.count) return fail("Mail nicht gefunden oder nicht fehlgeschlagen.");
  await audit({ actorId: user.id, actorName: user.name, action: "system.mail.retry", entity: "MailMessage", entityId: String(id) });
  revalidatePath("/super/system");
  return ok(undefined, "Mail wird erneut gesendet.");
}

export async function retryAllFailedMailsAction(): Promise<ActionResult> {
  const user = await requireSuperAdmin();
  const since = new Date(Date.now() - 7 * 86_400_000);
  const res = await db.mailMessage.updateMany({
    where: { status: "FAILED", createdAt: { gte: since } },
    data: { status: "QUEUED", attempts: 0, lastError: null, sendAfter: new Date() },
  });
  await audit({ actorId: user.id, actorName: user.name, action: "system.mail.retry-all", detail: `${res.count} Mails` });
  revalidatePath("/super/system");
  return ok(undefined, res.count ? `${res.count} Mails werden erneut gesendet.` : "Keine fehlgeschlagenen Mails.");
}

export async function sendTestMailAction(): Promise<ActionResult> {
  const user = await requireSuperAdmin();
  const queued = await mailTest(user);
  if (!queued) return fail("Testmail konnte nicht erstellt werden.");
  await audit({ actorId: user.id, actorName: user.name, action: "system.mail.test" });
  // Sofort versenden, statt auf den nächsten Lauf zu warten.
  await runJobNow("mail.send").catch(() => "skipped");
  revalidatePath("/super/system");
  return ok(
    undefined,
    smtpConfigured() ? `Testmail an ${user.email} versendet. Bitte Posteingang prüfen.` : "SMTP ist nicht eingerichtet – die Testmail wurde übersprungen.",
  );
}

export async function runJobAction(name: string): Promise<ActionResult> {
  const user = await requireSuperAdmin();
  const res = await runJobNow(String(name));
  if (res === "unknown") return fail("Unbekannter Job.");
  await audit({ actorId: user.id, actorName: user.name, action: "system.job.run", entity: "JobLock", entityId: String(name) });
  revalidatePath("/super/system");
  return res === "ran" ? ok(undefined, "Job ausgeführt.") : fail("Job läuft gerade oder ist gesperrt. Bitte später nochmals.");
}
