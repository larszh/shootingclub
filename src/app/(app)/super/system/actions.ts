"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/tenant";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { audit } from "@/lib/audit";
import { mailTest } from "@/lib/mail/platform-mails";
import { smtpConfigured } from "@/lib/mail/transport";
import { runJobNow } from "@/lib/jobs";
import { getRequestLocale, getT } from "@/lib/i18n";

const tr = async () => getT(await getRequestLocale());

export async function retryMailAction(id: string): Promise<ActionResult> {
  const t = await tr();
  const user = await requireSuperAdmin();
  const res = await db.mailMessage.updateMany({
    where: { id: String(id), status: { in: ["FAILED", "SKIPPED"] } },
    data: { status: "QUEUED", attempts: 0, lastError: null, sendAfter: new Date() },
  });
  if (!res.count) return fail(t("adm2.super.sys.msg.notFound"));
  await audit({ actorId: user.id, actorName: user.name, action: "system.mail.retry", entity: "MailMessage", entityId: String(id) });
  revalidatePath("/super/system");
  return ok(undefined, t("adm2.super.sys.msg.retry"));
}

export async function retryAllFailedMailsAction(): Promise<ActionResult> {
  const t = await tr();
  const user = await requireSuperAdmin();
  const since = new Date(Date.now() - 7 * 86_400_000);
  const res = await db.mailMessage.updateMany({
    where: { status: "FAILED", createdAt: { gte: since } },
    data: { status: "QUEUED", attempts: 0, lastError: null, sendAfter: new Date() },
  });
  await audit({ actorId: user.id, actorName: user.name, action: "system.mail.retry-all", detail: `${res.count} Mails` });
  revalidatePath("/super/system");
  return ok(undefined, res.count ? t("adm2.super.sys.msg.retryAll", { n: res.count }) : t("adm2.super.sys.msg.noFailed"));
}

export async function sendTestMailAction(): Promise<ActionResult> {
  const t = await tr();
  const user = await requireSuperAdmin();
  const queued = await mailTest(user);
  if (!queued) return fail(t("adm2.super.sys.msg.testFailed"));
  await audit({ actorId: user.id, actorName: user.name, action: "system.mail.test" });
  // Sofort versenden, statt auf den nächsten Lauf zu warten.
  await runJobNow("mail.send").catch(() => "skipped");
  revalidatePath("/super/system");
  return ok(
    undefined,
    smtpConfigured() ? t("adm2.super.sys.msg.testSent", { email: user.email }) : t("adm2.super.sys.msg.testSkipped"),
  );
}

export async function runJobAction(name: string): Promise<ActionResult> {
  const t = await tr();
  const user = await requireSuperAdmin();
  const res = await runJobNow(String(name));
  if (res === "unknown") return fail(t("adm2.super.sys.msg.unknownJob"));
  await audit({ actorId: user.id, actorName: user.name, action: "system.job.run", entity: "JobLock", entityId: String(name) });
  revalidatePath("/super/system");
  return res === "ran" ? ok(undefined, t("adm2.super.sys.msg.jobRan")) : fail(t("adm2.super.sys.msg.jobBusy"));
}
