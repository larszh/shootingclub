"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  PASSWORD_MIN_LENGTH,
  THROTTLE,
  clearPendingTwoFactor,
  clientIp,
  createSession,
  destroyAllSessions,
  destroySession,
  generateOpaqueToken,
  getCurrentUser,
  getPendingTwoFactor,
  hashOpaqueToken,
  hashPassword,
  peekThrottle,
  resetThrottle,
  setPendingTwoFactor,
  throttle,
  verifyPassword,
} from "@/lib/auth";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { safeNextPath } from "@/lib/utils";
import { todayZurich } from "@/lib/time";
import { setActiveTenantCookie } from "@/lib/tenant";
import { audit } from "@/lib/audit";
import { RESET_MINUTES, mailPasswordReset } from "@/lib/mail/platform-mails";
import { acceptInvitationForUser, findInvitation, findValidAuthToken } from "@/modules/core/invitations";
import { verifySecondFactor } from "@/modules/core/two-factor";

const passwordField = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Mindestens ${PASSWORD_MIN_LENGTH} Zeichen`)
  .max(200, "Höchstens 200 Zeichen");

function fieldErrors(issues: z.core.$ZodIssue[]) {
  const fe: Record<string, string> = {};
  for (const i of issues) fe[String(i.path[0])] ??= i.message;
  return fe;
}

const registerSchema = z.object({
  name: z.string().trim().min(2, "Mindestens 2 Zeichen").max(80),
  email: z.string().trim().toLowerCase().email("Ungültige E-Mail").max(191),
  password: passwordField,
  joinCode: z.string().trim().toUpperCase().max(12).optional(),
});

export async function registerAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    joinCode: formData.get("joinCode") || undefined,
  });
  if (!parsed.success) return fail("Bitte Eingaben prüfen.", fieldErrors(parsed.error.issues));
  const { name, email, password, joinCode } = parsed.data;
  const ip = await clientIp();
  const limited = throttle(`register-ip:${ip}`, THROTTLE.registerIp.limit, THROTTLE.registerIp.windowMs);
  if (limited) return fail(limited);
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return fail("Diese E-Mail ist bereits registriert. Bitte melde dich an oder nutze «Passwort vergessen».", { email: "Bereits registriert" });

  let tenantId: string | null = null;
  if (joinCode) {
    const joinLimited = throttle(`join-ip:${ip}`, THROTTLE.joinCode.limit, THROTTLE.joinCode.windowMs);
    if (joinLimited) return fail(joinLimited);
    const t = await db.tenant.findUnique({ where: { joinCode } });
    if (!t || t.deletedAt) return fail("Beitrittscode nicht gefunden.", { joinCode: "Unbekannter Code" });
    tenantId = t.id;
  }

  const userCount = await db.user.count();
  const user = await db.user.create({
    data: {
      name,
      email,
      passwordHash: await hashPassword(password),
      passwordSetAt: new Date(),
      // Allererster Benutzer wird automatisch Super-Admin (Bootstrap ohne Seed).
      isSuperAdmin: userCount === 0,
      memberships: tenantId ? { create: { tenantId, role: "MEMBER", status: "ACTIVE", joinedAt: new Date(`${todayZurich()}T00:00:00Z`) } } : undefined,
    },
  });
  await createSession(user.id);

  // Registrierung aus einer Einladung: bei passender E-Mail direkt beitreten.
  const inviteToken = String(formData.get("invite") ?? "");
  if (inviteToken) {
    const inv = await findInvitation(inviteToken);
    if (inv && inv.state === "open" && inv.email === email) {
      const accepted = await acceptInvitationForUser(inv.id, user.id);
      if (accepted) {
        await setActiveTenantCookie(accepted.tenantId);
        await audit({ tenantId: accepted.tenantId, actorId: user.id, actorName: user.name, action: "invitation.accept", entity: "Invitation", entityId: inv.id, detail: `Rolle ${accepted.role}` });
        redirect("/");
      }
    }
    redirect(`/invite/${encodeURIComponent(inviteToken)}`);
  }
  redirect(safeNextPath(formData.get("next")) ?? (tenantId ? "/" : "/onboarding"));
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Ungültige E-Mail").max(191),
  password: z.string().min(1, "Passwort fehlt").max(200),
});

export async function loginAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return fail("Bitte E-Mail und Passwort eingeben.");
  const ip = await clientIp();
  const ipKey = `login-ip:${ip}`;
  const acctKey = `login-acct:${parsed.data.email}`;
  // Nur Fehlversuche zählen: viele erfolgreiche Logins aus demselben Vereins-WLAN sperren niemanden.
  const limited = peekThrottle(ipKey, THROTTLE.loginIp.limit) ?? peekThrottle(acctKey, THROTTLE.loginAccount.limit);
  if (limited) return fail(limited);
  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  const passwordOk = !!user && !user.deletedAt && !!user.passwordHash && (await verifyPassword(parsed.data.password, user.passwordHash));
  if (!user || !passwordOk) {
    throttle(ipKey, THROTTLE.loginIp.limit, THROTTLE.loginIp.windowMs);
    throttle(acctKey, THROTTLE.loginAccount.limit, THROTTLE.loginAccount.windowMs);
    // Nur die Sperre protokollieren, nicht jeden Fehlversuch.
    if (user && !user.deletedAt && peekThrottle(acctKey, THROTTLE.loginAccount.limit)) {
      await audit({ actorId: user.id, actorName: user.name, action: "auth.login.locked", entity: "User", entityId: user.id, detail: "Zu viele Fehlversuche, Konto 15 Minuten gesperrt" });
    }
    // Importierte Konten haben noch keinen Passwort-Hash; ältere Konten (bcrypt-Hash ohne passwordSetAt) nicht betroffen.
    if (user && !user.deletedAt && !user.passwordSetAt && !user.passwordHash?.startsWith("$2")) {
      return fail("Für dieses Konto ist noch kein Passwort gesetzt. Bitte Passwort über den Link in der Einladung setzen oder ‹Passwort vergessen› nutzen.");
    }
    return fail("E-Mail oder Passwort stimmt nicht.");
  }
  resetThrottle(acctKey);
  // Ältere Konten (vor Einführung von passwordSetAt) nachtragen.
  if (!user.passwordSetAt) await db.user.update({ where: { id: user.id }, data: { passwordSetAt: new Date() } });

  const next = safeNextPath(formData.get("next"));
  if (user.totpEnabledAt && user.totpSecretEnc) {
    await setPendingTwoFactor(user.id, next);
    redirect("/login/2fa");
  }
  await createSession(user.id);
  redirect(next ?? "/");
}

/** Zweiter Schritt der Anmeldung: Code aus der Authenticator-App oder Wiederherstellungscode. */
export async function verifyTwoFactorLoginAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const pending = await getPendingTwoFactor();
  if (!pending) return fail("Die Anmeldung ist abgelaufen. Bitte erneut mit E-Mail und Passwort anmelden.");
  const code = String(formData.get("code") ?? "").trim().slice(0, 40);
  if (!code) return fail("Bitte den Code eingeben.", { code: "Code fehlt" });
  const key = `2fa:${pending.userId}`;
  const limited = peekThrottle(key, THROTTLE.twoFactor.limit);
  if (limited) return fail(limited);
  const user = await db.user.findUnique({ where: { id: pending.userId }, select: { id: true, name: true, deletedAt: true } });
  if (!user || user.deletedAt) {
    await clearPendingTwoFactor();
    return fail("Die Anmeldung ist abgelaufen. Bitte erneut anmelden.");
  }
  const result = await verifySecondFactor(user.id, code);
  if (!result) {
    throttle(key, THROTTLE.twoFactor.limit, THROTTLE.twoFactor.windowMs);
    if (peekThrottle(key, THROTTLE.twoFactor.limit)) {
      await audit({ actorId: user.id, actorName: user.name, action: "auth.2fa.locked", entity: "User", entityId: user.id, detail: "Zu viele falsche Codes" });
    }
    return fail("Der Code stimmt nicht. Bitte den aktuellen Code aus der App eingeben.", { code: "Falscher Code" });
  }
  resetThrottle(key);
  if (result === "recovery") {
    await audit({ actorId: user.id, actorName: user.name, action: "auth.2fa.recovery-used", entity: "User", entityId: user.id });
  }
  await clearPendingTwoFactor();
  await createSession(user.id);
  redirect(pending.next ?? "/");
}

export async function cancelTwoFactorLoginAction() {
  await clearPendingTwoFactor();
  redirect("/login");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

// ---------------------------------------------------------------------------
// Passwort vergessen / zurücksetzen

const RESET_DONE_MESSAGE =
  "Falls ein Konto mit dieser E-Mail existiert, ist ein Link unterwegs. Bitte schau auch im Spam-Ordner nach. Der Link ist 60 Minuten gültig.";

export async function requestPasswordResetAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = z.string().trim().toLowerCase().email().max(191).safeParse(formData.get("email"));
  if (!parsed.success) return fail("Bitte eine gültige E-Mail eingeben.", { email: "Ungültige E-Mail" });
  const email = parsed.data;
  const ip = await clientIp();
  const ipLimited = throttle(`reset-ip:${ip}`, THROTTLE.resetIp.limit, THROTTLE.resetIp.windowMs);
  if (ipLimited) return fail(ipLimited);
  // Pro E-Mail still drosseln: gleiche Antwort, aber keine weitere Mail (kein Mail-Bombing).
  const emailLimited = throttle(`reset-email:${email}`, THROTTLE.resetEmail.limit, THROTTLE.resetEmail.windowMs);
  if (!emailLimited) {
    const user = await db.user.findUnique({ where: { email }, select: { id: true, email: true, name: true, locale: true, deletedAt: true } });
    if (user && !user.deletedAt) {
      const token = generateOpaqueToken();
      await db.$transaction([
        db.authToken.updateMany({ where: { userId: user.id, kind: "RESET", usedAt: null }, data: { usedAt: new Date() } }),
        db.authToken.create({ data: { userId: user.id, kind: "RESET", tokenHash: hashOpaqueToken(token), expiresAt: new Date(Date.now() + RESET_MINUTES * 60_000) } }),
      ]);
      await mailPasswordReset(user, token);
    }
  }
  return ok(undefined, RESET_DONE_MESSAGE);
}

/**
 * Setzt ein neues Passwort über einen Token (RESET aus «Passwort vergessen» oder INVITE für
 * importierte Mitglieder). Beendet alle Sessions, markiert den Token als benutzt und meldet an
 * (bei aktivem 2FA mit zweitem Schritt).
 */
async function setPasswordWithToken(kinds: string[], formData: FormData): Promise<ActionResult> {
  const token = String(formData.get("token") ?? "");
  const parsed = z
    .object({ password: passwordField, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { message: "Die Passwörter stimmen nicht überein", path: ["confirm"] })
    .safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) return fail("Bitte Eingaben prüfen.", fieldErrors(parsed.error.issues));
  const ip = await clientIp();
  const limited = throttle(`token-ip:${ip}`, THROTTLE.resetIp.limit, THROTTLE.resetIp.windowMs);
  if (limited) return fail(limited);
  const row = await findValidAuthToken(token, kinds);
  if (!row) return fail("Dieser Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an.");
  // Atomar: nur ein Request kann den Token verbrauchen.
  const used = await db.authToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
  if (used.count !== 1) return fail("Dieser Link wurde bereits verwendet.");
  await db.user.update({ where: { id: row.userId }, data: { passwordHash: await hashPassword(parsed.data.password), passwordSetAt: new Date() } });
  // Alle anderen offenen Links dieses Benutzers entwerten.
  await db.authToken.updateMany({ where: { userId: row.userId, kind: { in: ["RESET", "INVITE"] }, usedAt: null }, data: { usedAt: new Date() } });
  await destroyAllSessions(row.userId);
  resetThrottle(`login-acct:${row.user.email}`);
  await audit({
    actorId: row.userId,
    actorName: row.user.name,
    action: row.kind === "RESET" ? "auth.password.reset" : "auth.password.set",
    entity: "User",
    entityId: row.userId,
  });
  if (row.user.totpEnabledAt) {
    await setPendingTwoFactor(row.userId, "/");
    redirect("/login/2fa");
  }
  await createSession(row.userId);
  redirect("/");
}

export async function resetPasswordAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return setPasswordWithToken(["RESET"], formData);
}

export async function setInitialPasswordAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return setPasswordWithToken(["INVITE", "RESET"], formData);
}

// ---------------------------------------------------------------------------
// Einladungen

export async function acceptInvitationAction(token: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
  const inv = await findInvitation(token);
  if (!inv) return fail("Diese Einladung gibt es nicht (mehr).");
  if (inv.state === "accepted") return fail("Diese Einladung wurde bereits angenommen.");
  if (inv.state === "expired") return fail("Diese Einladung ist abgelaufen. Bitte den Vorstand um eine neue.");
  if (inv.email !== user.email.toLowerCase()) return fail(`Diese Einladung gilt für ${inv.email}. Bitte melde dich mit dieser Adresse an.`);
  const accepted = await acceptInvitationForUser(inv.id, user.id);
  if (!accepted) return fail("Die Einladung konnte nicht angenommen werden. Bitte Seite neu laden.");
  await setActiveTenantCookie(accepted.tenantId);
  await audit({ tenantId: accepted.tenantId, actorId: user.id, actorName: user.name, action: "invitation.accept", entity: "Invitation", entityId: inv.id, detail: `Rolle ${accepted.role}` });
  redirect("/");
}

/** Abmelden und mit einem anderen Konto die Einladung annehmen. */
export async function switchAccountForInvitationAction(token: string) {
  await destroySession();
  redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
}
