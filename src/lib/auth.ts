import "server-only";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

const SESSION_COOKIE = "standchef_session";
const SESSION_DAYS = 30;

function hashToken(token: string) {
  return createHash("sha256").update(token + (process.env.AUTH_SECRET ?? "")).digest("hex");
}

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}

export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.session.create({ data: { userId, tokenHash: hashToken(token), expiresAt } });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  jar.delete(SESSION_COOKIE);
}

/** Meldet alle anderen Geräte ab (z.B. nach Passwortwechsel). Die aktuelle Sitzung bleibt bestehen. */
export async function destroyOtherSessions(userId: string) {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  const result = await db.session.deleteMany({
    where: { userId, ...(token ? { NOT: { tokenHash: hashToken(token) } } : {}) },
  });
  return result.count;
}

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  isSuperAdmin: boolean;
  locale: string;
  street: string | null;
  zip: string | null;
  city: string | null;
  avatarUrl: string | null;
  themePref: string;
  memberships: Array<{
    tenantId: string;
    role: string;
    tenant: { id: string; slug: string; name: string; kind: string; logoPath: string | null; brandColor: string | null; brandColor2: string | null; updatedAt: Date };
  }>;
};

/** Aktueller Benutzer oder null. Pro Request gecacht. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: {
        include: {
          memberships: {
            include: { tenant: { select: { id: true, slug: true, name: true, kind: true, logoPath: true, brandColor: true, brandColor2: true, updatedAt: true } } },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });
  if (!session || session.expiresAt < new Date()) return null;
  const u = session.user;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    isSuperAdmin: u.isSuperAdmin,
    locale: u.locale,
    street: u.street,
    zip: u.zip,
    city: u.city,
    avatarUrl: u.avatarPath ? `/api/avatars/user/${u.id}?v=${u.updatedAt.getTime()}` : null,
    themePref: u.themePref,
    memberships: u.memberships.map((m) => ({ tenantId: m.tenantId, role: m.role, tenant: m.tenant })),
  };
});

// ---------------------------------------------------------------------------
// Drosselung gegen Durchprobieren (Login, Registrierung, Beitrittscodes).
// In-Memory pro Prozess: passt zum Betrieb mit einer PM2-Instanz (ecosystem.config.cjs).
// Bei mehreren Instanzen zusätzlich am Reverse Proxy begrenzen (nginx limit_req).

type ThrottleBucket = { count: number; resetAt: number };
const throttleStore: Map<string, ThrottleBucket> =
  ((globalThis as { __standchefThrottle?: Map<string, ThrottleBucket> }).__standchefThrottle ??= new Map());

/** IP des Aufrufers (hinter nginx/CloudPanel aus X-Forwarded-For bzw. X-Real-IP). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  // Reihenfolge nach Vertrauenswürdigkeit hinter CloudPanel (nginx) und optional Cloudflare:
  // 1. CF-Connecting-IP: von Cloudflare gesetzt, echte Besucher-IP.
  // 2. X-Real-IP: von nginx aus $remote_addr gesetzt, vom Client nicht fälschbar (ohne Cloudflare).
  // 3. Letzter Eintrag von X-Forwarded-For: vom nächsten Proxy angehängt. Der erste Eintrag
  //    kann vom Client frei gewählt werden und wird deshalb nie verwendet.
  const cf = h.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  const real = h.get("x-real-ip")?.trim();
  if (real) return real;
  const fwd = h.get("x-forwarded-for");
  const last = fwd?.split(",").map((s) => s.trim()).filter(Boolean).pop();
  return last || "unknown";
}

/** Prüft, ob `key` das Limit bereits erreicht hat, ohne einen Versuch zu zählen. */
export function peekThrottle(key: string, limit: number): string | null {
  const bucket = throttleStore.get(key);
  const now = Date.now();
  if (!bucket || bucket.resetAt <= now || bucket.count < limit) return null;
  const minutes = Math.max(1, Math.ceil((bucket.resetAt - now) / 60_000));
  return `Zu viele Versuche. Bitte in ${minutes} ${minutes === 1 ? "Minute" : "Minuten"} erneut versuchen.`;
}

/**
 * Zählt einen Versuch für `key` und meldet, ob das Limit im Zeitfenster überschritten ist.
 * Rückgabe: null = erlaubt, sonst eine deutsche Fehlermeldung für fail().
 */
export function throttle(key: string, limit: number, windowMs: number): string | null {
  const now = Date.now();
  if (throttleStore.size > 10_000) {
    for (const [k, b] of throttleStore) if (b.resetAt <= now) throttleStore.delete(k);
  }
  let bucket = throttleStore.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    throttleStore.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count <= limit) return null;
  const minutes = Math.max(1, Math.ceil((bucket.resetAt - now) / 60_000));
  return `Zu viele Versuche. Bitte in ${minutes} ${minutes === 1 ? "Minute" : "Minuten"} erneut versuchen.`;
}

/** Setzt den Zähler zurück (z.B. nach erfolgreichem Login). */
export function resetThrottle(key: string) {
  throttleStore.delete(key);
}

/** Vorgegebene Limits, damit alle Aufrufer dieselben Werte nutzen. */
export const THROTTLE = {
  /** Fehlversuche pro Konto (E-Mail) */
  loginAccount: { limit: 10, windowMs: 15 * 60_000 },
  /** Login-Versuche pro IP */
  loginIp: { limit: 30, windowMs: 15 * 60_000 },
  /** Registrierungen pro IP */
  registerIp: { limit: 10, windowMs: 60 * 60_000 },
  /** Beitrittscode-Versuche pro IP bzw. pro Benutzer */
  joinCode: { limit: 10, windowMs: 15 * 60_000 },
} as const;
