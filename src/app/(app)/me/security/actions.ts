"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  PASSWORD_MIN_LENGTH,
  THROTTLE,
  currentSessionHash,
  destroyOtherSessions,
  getCurrentUser,
  hashPassword,
  peekThrottle,
  resetThrottle,
  throttle,
  verifyPassword,
} from "@/lib/auth";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { audit } from "@/lib/audit";
import { mailSecurityNotice } from "@/lib/mail/platform-mails";
import {
  checkTotpForUser,
  disableTwoFactor,
  enableTwoFactor,
  readEnrollmentTicket,
  regenerateRecoveryCodes,
  startEnrollment,
  verifySecondFactor,
} from "@/modules/core/two-factor";

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/me/security");
  return user;
}

/** Gemeinsame Drosselung für Passwort- und Code-Prüfungen auf dieser Seite. */
function limitKey(userId: string) {
  return `security:${userId}`;
}
function checkLimit(userId: string) {
  return peekThrottle(limitKey(userId), THROTTLE.twoFactor.limit);
}
function countFailure(userId: string) {
  throttle(limitKey(userId), THROTTLE.twoFactor.limit, THROTTLE.twoFactor.windowMs);
}

function fe(issues: z.core.$ZodIssue[]) {
  const out: Record<string, string> = {};
  for (const i of issues) out[String(i.path[0])] ??= i.message;
  return out;
}

const passwordSchema = z
  .object({
    current: z.string().min(1, "Bitte aktuelles Passwort eingeben").max(200),
    next: z.string().min(PASSWORD_MIN_LENGTH, `Mindestens ${PASSWORD_MIN_LENGTH} Zeichen`).max(200, "Zu lang"),
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, { message: "Die Passwörter stimmen nicht überein", path: ["confirm"] })
  .refine((v) => v.next !== v.current, { message: "Das neue Passwort muss sich vom alten unterscheiden", path: ["next"] });

export async function changePasswordSecureAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = passwordSchema.safeParse({ current: formData.get("current") ?? "", next: formData.get("next") ?? "", confirm: formData.get("confirm") ?? "" });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Bitte Eingaben prüfen.", fe(parsed.error.issues));
  const limited = checkLimit(user.id);
  if (limited) return fail(limited);
  const row = await db.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  if (!row || !(await verifyPassword(parsed.data.current, row.passwordHash))) {
    countFailure(user.id);
    return fail("Das aktuelle Passwort stimmt nicht.", { current: "Stimmt nicht" });
  }
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(parsed.data.next), passwordSetAt: new Date() } });
  // Offene Links (Passwort vergessen / Einladung) entwerten, sonst überschreiben sie das neue Passwort.
  await db.authToken.updateMany({ where: { userId: user.id, kind: { in: ["RESET", "INVITE"] }, usedAt: null }, data: { usedAt: new Date() } });
  const loggedOut = await destroyOtherSessions(user.id);
  resetThrottle(limitKey(user.id));
  await audit({ actorId: user.id, actorName: user.name, action: "auth.password.change", entity: "User", entityId: user.id });
  await mailSecurityNotice(user, "passwordChanged").catch(() => null);
  revalidatePath("/me/security");
  return ok(
    undefined,
    loggedOut > 0 ? `Passwort geändert. ${loggedOut === 1 ? "Ein anderes Gerät wurde" : `${loggedOut} andere Geräte wurden`} abgemeldet.` : "Passwort geändert.",
  );
}

// ---------------------------------------------------------------------------
// Zwei-Faktor

export type EnrollmentData = { qrDataUrl: string; secret: string; ticket: string };

export async function startTwoFactorAction(): Promise<ActionResult<EnrollmentData>> {
  const user = await requireUser();
  const row = await db.user.findUnique({ where: { id: user.id }, select: { totpEnabledAt: true } });
  if (row?.totpEnabledAt) return fail("Die Zwei-Faktor-Anmeldung ist bereits aktiv.");
  const e = await startEnrollment(user);
  return ok({ qrDataUrl: e.qrDataUrl, secret: e.secretFormatted, ticket: e.ticket });
}

export async function confirmTwoFactorAction(ticket: string, code: string): Promise<ActionResult<{ codes: string[] }>> {
  const user = await requireUser();
  const limited = checkLimit(user.id);
  if (limited) return fail(limited);
  const secret = readEnrollmentTicket(String(ticket ?? ""), user.id);
  if (!secret) return fail("Die Einrichtung ist abgelaufen. Bitte nochmals starten.");
  if (!checkTotpForUser(user.id, secret, String(code ?? ""))) {
    countFailure(user.id);
    return fail("Der Code stimmt nicht. Prüfe, ob die Uhrzeit auf dem Handy stimmt, und gib den aktuellen Code ein.");
  }
  resetThrottle(limitKey(user.id));
  const codes = await enableTwoFactor(user.id, secret);
  await audit({ actorId: user.id, actorName: user.name, action: "auth.2fa.enable", entity: "User", entityId: user.id });
  await mailSecurityNotice(user, "twofaOn").catch(() => null);
  // Kein revalidatePath: Die Seite würde sonst sofort auf «aktiv» umschalten, bevor die
  // Wiederherstellungscodes angezeigt wurden. Der Client lädt nach «Gesichert, fertig» neu.
  return ok({ codes });
}

export async function disableTwoFactorAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const limited = checkLimit(user.id);
  if (limited) return fail(limited);
  const password = String(formData.get("password") ?? "").slice(0, 200);
  const code = String(formData.get("code") ?? "").slice(0, 40);
  if (!password || !code) return fail("Bitte Passwort und Code eingeben.", { ...(password ? {} : { password: "Fehlt" }), ...(code ? {} : { code: "Fehlt" }) });
  const row = await db.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  if (!row || !(await verifyPassword(password, row.passwordHash))) {
    countFailure(user.id);
    return fail("Das Passwort stimmt nicht.", { password: "Stimmt nicht" });
  }
  if (!(await verifySecondFactor(user.id, code))) {
    countFailure(user.id);
    return fail("Der Code stimmt nicht.", { code: "Stimmt nicht" });
  }
  resetThrottle(limitKey(user.id));
  await disableTwoFactor(user.id);
  await audit({ actorId: user.id, actorName: user.name, action: "auth.2fa.disable", entity: "User", entityId: user.id });
  await mailSecurityNotice(user, "twofaOff").catch(() => null);
  revalidatePath("/me/security");
  return ok(undefined, "Zwei-Faktor-Anmeldung ausgeschaltet.");
}

export async function regenerateRecoveryCodesAction(code: string): Promise<ActionResult<{ codes: string[] }>> {
  const user = await requireUser();
  const limited = checkLimit(user.id);
  if (limited) return fail(limited);
  const result = await verifySecondFactor(user.id, String(code ?? "").slice(0, 40));
  if (result !== "totp") {
    countFailure(user.id);
    return fail("Bitte den aktuellen 6-stelligen Code aus der App eingeben.");
  }
  resetThrottle(limitKey(user.id));
  const codes = await regenerateRecoveryCodes(user.id);
  await audit({ actorId: user.id, actorName: user.name, action: "auth.2fa.recovery-regenerate", entity: "User", entityId: user.id });
  revalidatePath("/me/security");
  return ok({ codes });
}

// ---------------------------------------------------------------------------
// Sitzungen

export async function terminateSessionAction(sessionId: string): Promise<ActionResult> {
  const user = await requireUser();
  const current = await currentSessionHash();
  const res = await db.session.deleteMany({
    where: { id: String(sessionId), userId: user.id, ...(current ? { NOT: { tokenHash: current } } : {}) },
  });
  revalidatePath("/me/security");
  return res.count ? ok(undefined, "Gerät abgemeldet.") : fail("Sitzung nicht gefunden.");
}

export async function terminateOtherSessionsAction(): Promise<ActionResult> {
  const user = await requireUser();
  const n = await destroyOtherSessions(user.id);
  if (n > 0) await audit({ actorId: user.id, actorName: user.name, action: "auth.sessions.terminate", entity: "User", entityId: user.id, detail: `${n} Sitzungen beendet` });
  revalidatePath("/me/security");
  return ok(undefined, n === 0 ? "Keine anderen Geräte angemeldet." : n === 1 ? "Ein Gerät abgemeldet." : `${n} Geräte abgemeldet.`);
}
