import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/** Symmetrische Verschlüsselung für Provider-Zugangsdaten (AES-256-GCM, Schlüssel aus AUTH_SECRET). */
function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) throw new Error("AUTH_SECRET fehlt oder ist zu kurz");
  return createHash("sha256").update(secret).digest();
}

export function encryptJson(value: unknown) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64url"), tag.toString("base64url"), data.toString("base64url")].join(".");
}

export function decryptJson<T = Record<string, string>>(payload: string): T {
  const [ivB, tagB, dataB] = payload.split(".");
  if (!ivB || !tagB || !dataB) throw new Error("Ungültige verschlüsselte Daten");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB, "base64url"));
  const out = Buffer.concat([decipher.update(Buffer.from(dataB, "base64url")), decipher.final()]);
  return JSON.parse(out.toString("utf8")) as T;
}
