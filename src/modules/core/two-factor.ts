import "server-only";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { decryptJson, encryptJson } from "@/lib/crypto";
import { hashOpaqueToken } from "@/lib/auth";
import { formatSecret, generateRecoveryCode, generateTotpSecret, normalizeCode, normalizeRecoveryCode, otpauthUrl, verifyTotp } from "@/lib/totp";

/**
 * Zwei-Faktor-Anmeldung (TOTP) – Serverlogik ohne Actions.
 * Absichtlich kein "use server": diese Funktionen dürfen nicht als Endpunkte erreichbar sein.
 * Actions: src/app/(app)/me/security/actions.ts und src/modules/core/auth-actions.ts.
 */

export const RECOVERY_KIND = "RECOVERY";
export const RECOVERY_COUNT = 8;
const ENROLL_MS = 15 * 60_000;
/** Wiederherstellungscodes laufen praktisch nie ab (bis sie benutzt oder neu erzeugt werden). */
const FAR_FUTURE = new Date("2999-12-31T00:00:00Z");

// Replay-Schutz: zuletzt benutzter Zeitschritt pro Benutzer (In-Memory, passt zu einer PM2-Instanz).
type ReplayStore = Map<string, number>;
const replay: ReplayStore = ((globalThis as { __standchefTotpReplay?: ReplayStore }).__standchefTotpReplay ??= new Map());

function rememberStep(userId: string, step: number) {
  if (replay.size > 50_000) replay.clear();
  replay.set(userId, step);
}

export type Enrollment = { secret: string; secretFormatted: string; qrDataUrl: string; ticket: string };

/** Neues Geheimnis für die Einrichtung. Das Ticket (verschlüsselt) trägt das Geheimnis bis zur Bestätigung. */
export async function startEnrollment(user: { id: string; email: string }): Promise<Enrollment> {
  const secret = generateTotpSecret();
  const url = otpauthUrl({ secret, account: user.email, issuer: "Standchef" });
  const qrDataUrl = await QRCode.toDataURL(url, { errorCorrectionLevel: "M", margin: 1, width: 240 });
  const ticket = encryptJson({ u: user.id, s: secret, e: Date.now() + ENROLL_MS });
  return { secret, secretFormatted: formatSecret(secret), qrDataUrl, ticket };
}

/** Liest das Einrichtungs-Ticket; null wenn manipuliert, abgelaufen oder fremd. */
export function readEnrollmentTicket(ticket: string, userId: string): string | null {
  try {
    const t = decryptJson<{ u: string; s: string; e: number }>(ticket);
    if (t.u !== userId || t.e < Date.now() || !/^[A-Z2-7]{32}$/.test(t.s)) return null;
    return t.s;
  } catch {
    return null;
  }
}

/** Prüft einen Code gegen ein Geheimnis (mit Replay-Schutz) und merkt sich den Schritt. */
export function checkTotpForUser(userId: string, secret: string, code: string): boolean {
  const step = verifyTotp(secret, code, Date.now(), { window: 1, lastUsedStep: replay.get(userId) ?? null });
  if (step === null) return false;
  rememberStep(userId, step);
  return true;
}

/** Aktiviert 2FA: Geheimnis verschlüsselt speichern, neue Wiederherstellungscodes erzeugen. */
export async function enableTwoFactor(userId: string, secret: string): Promise<string[]> {
  await db.user.update({ where: { id: userId }, data: { totpSecretEnc: encryptJson({ s: secret }), totpEnabledAt: new Date() } });
  return regenerateRecoveryCodes(userId);
}

export async function disableTwoFactor(userId: string) {
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { totpSecretEnc: null, totpEnabledAt: null } }),
    db.authToken.deleteMany({ where: { userId, kind: RECOVERY_KIND } }),
  ]);
  replay.delete(userId);
}

function recoveryHash(userId: string, code: string) {
  return hashOpaqueToken(`recovery:${userId}:${normalizeRecoveryCode(code)}`);
}

/** Ersetzt alle Wiederherstellungscodes. Rückgabe: Klartext (nur einmal anzeigen). */
export async function regenerateRecoveryCodes(userId: string): Promise<string[]> {
  const codes = Array.from({ length: RECOVERY_COUNT }, () => generateRecoveryCode());
  await db.$transaction([
    db.authToken.deleteMany({ where: { userId, kind: RECOVERY_KIND } }),
    db.authToken.createMany({ data: codes.map((c) => ({ userId, kind: RECOVERY_KIND, tokenHash: recoveryHash(userId, c), expiresAt: FAR_FUTURE })) }),
  ]);
  return codes;
}

export async function countRecoveryCodes(userId: string): Promise<number> {
  return db.authToken.count({ where: { userId, kind: RECOVERY_KIND, usedAt: null } });
}

/**
 * Zweiter Faktor für einen Benutzer mit aktivem 2FA: 6-stelliger Code oder Wiederherstellungscode
 * (wird dabei verbraucht). Rückgabe: Art des Treffers oder null.
 */
export async function verifySecondFactor(userId: string, input: string): Promise<"totp" | "recovery" | null> {
  const raw = input.trim();
  if (!raw || raw.length > 40) return null;
  const user = await db.user.findUnique({ where: { id: userId }, select: { totpSecretEnc: true, totpEnabledAt: true } });
  if (!user?.totpEnabledAt || !user.totpSecretEnc) return null;

  if (/^\d{6}$/.test(normalizeCode(raw))) {
    let secret: string;
    try {
      secret = decryptJson<{ s: string }>(user.totpSecretEnc).s;
    } catch {
      return null;
    }
    return checkTotpForUser(userId, secret, raw) ? "totp" : null;
  }

  const normalized = normalizeRecoveryCode(raw);
  if (normalized.length !== 10) return null;
  const used = await db.authToken.updateMany({
    where: { userId, kind: RECOVERY_KIND, tokenHash: recoveryHash(userId, normalized), usedAt: null },
    data: { usedAt: new Date() },
  });
  return used.count === 1 ? "recovery" : null;
}
