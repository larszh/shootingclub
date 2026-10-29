import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * TOTP nach RFC 6238 (HMAC-SHA1, 6 Ziffern, 30 Sekunden), kompatibel mit
 * Google Authenticator, Microsoft Authenticator, 1Password, Aegis usw.
 */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const TOTP_PERIOD = 30;
export const TOTP_DIGITS = 6;

export function base32Encode(buf: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error("Ungültiges Base32-Zeichen");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** Neues Geheimnis: 20 zufällige Bytes als Base32 (32 Zeichen). */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** HOTP (RFC 4226) für einen Zähler. */
export function hotp(secret: Buffer, counter: number, digits = TOTP_DIGITS): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", secret).update(msg).digest();
  const offset = h[h.length - 1] & 0x0f;
  const bin = ((h[offset] & 0x7f) << 24) | (h[offset + 1] << 16) | (h[offset + 2] << 8) | h[offset + 3];
  return String(bin % 10 ** digits).padStart(digits, "0");
}

export function totpStep(atMs: number): number {
  return Math.floor(atMs / 1000 / TOTP_PERIOD);
}

export function totpAt(secretB32: string, atMs: number): string {
  return hotp(base32Decode(secretB32), totpStep(atMs));
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Entfernt Leerzeichen/Bindestriche, damit «123 456» funktioniert. */
export function normalizeCode(code: string): string {
  return code.replace(/[\s-]/g, "");
}

/**
 * Prüft einen Code mit ±window Schritten Toleranz (Uhrabweichung).
 * Rückgabe: der passende Zeitschritt (für den Replay-Schutz) oder null.
 * Codes mit Schritt <= lastUsedStep werden abgelehnt.
 */
export function verifyTotp(secretB32: string, code: string, atMs: number, opts?: { window?: number; lastUsedStep?: number | null }): number | null {
  const c = normalizeCode(code);
  if (!/^\d{6}$/.test(c)) return null;
  const key = base32Decode(secretB32);
  const step = totpStep(atMs);
  const window = opts?.window ?? 1;
  let match: number | null = null;
  // Alle Kandidaten prüfen (konstante Laufzeit unabhängig vom Treffer).
  for (let i = -window; i <= window; i++) {
    const s = step + i;
    if (safeEqual(hotp(key, s), c) && match === null) match = s;
  }
  if (match === null) return null;
  if (opts?.lastUsedStep != null && match <= opts.lastUsedStep) return null;
  return match;
}

/** otpauth://-URL für den QR-Code. */
export function otpauthUrl(o: { secret: string; account: string; issuer?: string }): string {
  const issuer = o.issuer ?? "Standchef";
  const label = encodeURIComponent(`${issuer}:${o.account}`);
  const params = new URLSearchParams({ secret: o.secret, issuer, algorithm: "SHA1", digits: String(TOTP_DIGITS), period: String(TOTP_PERIOD) });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** Geheimnis in Vierergruppen zur manuellen Eingabe. */
export function formatSecret(secret: string): string {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}

/** Wiederherstellungscode: 10 Zeichen ohne verwechselbare Zeichen, als xxxxx-xxxxx. */
export function generateRecoveryCode(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(10);
  let s = "";
  for (const b of bytes) s += alphabet[b % alphabet.length];
  return `${s.slice(0, 5)}-${s.slice(5)}`;
}

export function normalizeRecoveryCode(code: string): string {
  return code.toLowerCase().replace(/[^a-z0-9]/g, "");
}
