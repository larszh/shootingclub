import "server-only";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { describeUserAgent } from "@/lib/user-agent";

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

/** Audit-Aktion beim Anmelden: hält Gerät (aus dem User-Agent) und IP der Sitzung fest (entityId = Sitzung). */
export const SESSION_START_ACTION = "auth.session.start";

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  const session = await db.session.create({ data: { userId, tokenHash: hashToken(token), expiresAt } });
  // Gerät und IP für «Angemeldete Geräte» festhalten (die Sitzung selbst hat dafür keine Felder).
  try {
    const h = await headers();
    const ip = await clientIp();
    await db.auditLog.create({
      data: {
        actorId: userId, action: SESSION_START_ACTION, entity: "Session", entityId: session.id,
        detail: (describeUserAgent(h.get("user-agent")) ?? "Unbekanntes Gerät").slice(0, 200), ip: ip === "unknown" ? null : ip.slice(0, 191),
      },
    });
  } catch {
    // Protokollieren darf die Anmeldung nie verhindern.
  }
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
          // Nur Mitgliedschaften mit Zugang: ausgetretene (status LEFT) und Vereine mit geplanter
          // Löschung (Tenant.deletedAt) zählen nicht. So prüfen auch alle API-Routen, die
          // user.memberships verwenden, automatisch richtig.
          memberships: {
            where: { status: { not: "LEFT" }, tenant: { deletedAt: null } },
            include: { tenant: { select: { id: true, slug: true, name: true, kind: true, logoPath: true, brandColor: true, brandColor2: true, updatedAt: true } } },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });
  if (!session || session.expiresAt < new Date()) return null;
  const u = session.user;
  // Gelöschte (pseudonymisierte) Konten haben keinen Zugang mehr.
  if (u.deletedAt) return null;
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

function trustCloudflare() {
  const v = process.env.TRUST_CLOUDFLARE?.trim().toLowerCase();
  return v === "1" || v === "true";
}

/** IP des Aufrufers (hinter nginx/CloudPanel aus X-Forwarded-For bzw. X-Real-IP). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  // Reihenfolge nach Vertrauenswürdigkeit hinter CloudPanel (nginx) und optional Cloudflare:
  // 1. CF-Connecting-IP: nur mit TRUST_CLOUDFLARE=1. Ohne Cloudflare davor kann jeder Client
  //    diesen Header selbst senden (nginx reicht ihn durch) und so die IP-Drosselung umgehen.
  // 2. X-Real-IP: von nginx aus $remote_addr gesetzt, vom Client nicht fälschbar (ohne Cloudflare).
  // 3. Letzter Eintrag von X-Forwarded-For: vom nächsten Proxy angehängt. Der erste Eintrag
  //    kann vom Client frei gewählt werden und wird deshalb nie verwendet.
  if (trustCloudflare()) {
    const cf = h.get("cf-connecting-ip")?.trim();
    if (cf) return cf;
  }
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
  /** Passwort vergessen: Anfragen pro IP bzw. pro E-Mail */
  resetIp: { limit: 10, windowMs: 60 * 60_000 },
  resetEmail: { limit: 3, windowMs: 60 * 60_000 },
  /** Zweiter Faktor (Code) pro Benutzer */
  twoFactor: { limit: 6, windowMs: 15 * 60_000 },
  /** Beitrittscode-Versuche pro IP bzw. pro Benutzer */
  joinCode: { limit: 10, windowMs: 15 * 60_000 },
} as const;

// ---------------------------------------------------------------------------
// Aufräumen und Zwei-Faktor-Anmeldung (Plattform)

/** Löscht abgelaufene Sessions. Rückgabe: Anzahl gelöschter Zeilen. Vom Job «cleanup» aufgerufen. */
export async function cleanupExpiredSessions(): Promise<number> {
  const res = await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return res.count;
}

/** Alle Sessions eines Benutzers beenden (z.B. nach Passwort-Reset). */
export async function destroyAllSessions(userId: string): Promise<number> {
  const res = await db.session.deleteMany({ where: { userId } });
  return res.count;
}

/** Hash der aktuellen Session (zum Markieren in der Geräteliste). */
export async function currentSessionHash(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  return token ? hashToken(token) : null;
}

const PENDING_2FA_COOKIE = "standchef_2fa";
const PENDING_2FA_MS = 5 * 60_000;

function signPending(payload: string) {
  const secret = process.env.AUTH_SECRET;
  // Ohne geheimen Schlüssel wäre das Cookie fälschbar (2FA umgangen) – lieber abbrechen.
  if (!secret || secret.length < 16) throw new Error("AUTH_SECRET fehlt oder ist zu kurz");
  return createHmac("sha256", `${secret}:2fa`).update(payload).digest("base64url");
}

/**
 * Nach korrektem Passwort, aber vor dem zweiten Faktor: kurzlebiges, signiertes Cookie (5 Min.).
 * Enthält nur Benutzer-ID, Ablaufzeit und Ziel nach der Anmeldung.
 */
export async function setPendingTwoFactor(userId: string, next: string | null) {
  const exp = Date.now() + PENDING_2FA_MS;
  const payload = Buffer.from(JSON.stringify({ u: userId, e: exp, n: next ?? "" })).toString("base64url");
  const jar = await cookies();
  jar.set(PENDING_2FA_COOKIE, `${payload}.${signPending(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: PENDING_2FA_MS / 1000,
    path: "/",
  });
}

export async function getPendingTwoFactor(): Promise<{ userId: string; next: string | null } | null> {
  const jar = await cookies();
  const raw = jar.get(PENDING_2FA_COOKIE)?.value;
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(signPending(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { u?: string; e?: number; n?: string };
    if (!data.u || !data.e || data.e < Date.now()) return null;
    return { userId: data.u, next: data.n || null };
  } catch {
    return null;
  }
}

export async function clearPendingTwoFactor() {
  const jar = await cookies();
  jar.delete(PENDING_2FA_COOKIE);
}

/** Zufälliger Einmal-Token (32 Bytes, base64url) für Links in Mails. */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

/** SHA-256 eines Einmal-Tokens; in der DB wird nur dieser Hash gespeichert. */
export function hashOpaqueToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Mindestlänge für Passwörter (Registrierung, Reset, Einladung). */
export const PASSWORD_MIN_LENGTH = 8;
