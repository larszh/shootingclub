"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { THROTTLE, clientIp, createSession, destroySession, hashPassword, resetThrottle, peekThrottle, throttle, verifyPassword } from "@/lib/auth";
import { fail, type ActionResult } from "@/lib/action-result";
import { safeNextPath } from "@/lib/utils";

const registerSchema = z.object({
  name: z.string().trim().min(2, "Mindestens 2 Zeichen").max(80),
  email: z.string().trim().toLowerCase().email("Ungültige E-Mail"),
  password: z.string().min(8, "Mindestens 8 Zeichen").max(200),
  joinCode: z.string().trim().toUpperCase().max(12).optional(),
});

export async function registerAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    joinCode: formData.get("joinCode") || undefined,
  });
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[String(i.path[0])] = i.message;
    return fail("Bitte Eingaben prüfen.", fe);
  }
  const { name, email, password, joinCode } = parsed.data;
  const ip = await clientIp();
  const limited = throttle(`register-ip:${ip}`, THROTTLE.registerIp.limit, THROTTLE.registerIp.windowMs);
  if (limited) return fail(limited);
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return fail("Diese E-Mail ist bereits registriert.", { email: "Bereits registriert" });

  let tenantId: string | null = null;
  if (joinCode) {
    const joinLimited = throttle(`join-ip:${ip}`, THROTTLE.joinCode.limit, THROTTLE.joinCode.windowMs);
    if (joinLimited) return fail(joinLimited);
    const t = await db.tenant.findUnique({ where: { joinCode } });
    if (!t) return fail("Beitrittscode nicht gefunden.", { joinCode: "Unbekannter Code" });
    tenantId = t.id;
  }

  const userCount = await db.user.count();
  const user = await db.user.create({
    data: {
      name,
      email,
      passwordHash: await hashPassword(password),
      // Allererster Benutzer wird automatisch Super-Admin (Bootstrap ohne Seed).
      isSuperAdmin: userCount === 0,
      memberships: tenantId ? { create: { tenantId, role: "MEMBER" } } : undefined,
    },
  });
  await createSession(user.id);
  redirect(tenantId ? "/" : "/onboarding");
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Ungültige E-Mail"),
  password: z.string().min(1, "Passwort fehlt"),
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
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    throttle(ipKey, THROTTLE.loginIp.limit, THROTTLE.loginIp.windowMs);
    throttle(acctKey, THROTTLE.loginAccount.limit, THROTTLE.loginAccount.windowMs);
    return fail("E-Mail oder Passwort stimmt nicht.");
  }
  resetThrottle(`login-acct:${parsed.data.email}`);
  await createSession(user.id);
  redirect(safeNextPath(formData.get("next")) ?? "/");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
