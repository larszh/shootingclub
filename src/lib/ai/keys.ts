import "server-only";
import { db } from "@/lib/db";
import { encryptJson } from "@/lib/crypto";
import { createAiClient, loadStoredApiKey, type AiScopeRef } from "./client";
import { toAiError } from "./errors";
import { isPlausibleApiKey, keyHintOf, type AiErrorCode } from "./types";

export type SaveKeyResult = { ok: true; keyHint: string } | { ok: false; error: "invalidFormat" };

/** Verschlüsselt den Schlüssel ({ apiKey }) für die Spalte apiKeyEnc. */
export function encryptApiKey(apiKey: string): string {
  return encryptJson({ apiKey: apiKey.trim() });
}

/**
 * Speichert einen Claude-API-Schlüssel verschlüsselt (Hinweis = letzte 4 Zeichen).
 * Legt die Einstellungszeile bei Bedarf an. Audit-Eintrag macht der Aufrufer (ohne Schlüssel!).
 */
export async function saveKey(ref: AiScopeRef, apiKey: string): Promise<SaveKeyResult> {
  const key = apiKey.trim();
  if (!isPlausibleApiKey(key)) return { ok: false, error: "invalidFormat" };
  const apiKeyEnc = encryptApiKey(key);
  const keyHint = keyHintOf(key);
  if (ref.scope === "platform") {
    await db.platformAiSettings.upsert({ where: { id: "global" }, create: { id: "global", apiKeyEnc, keyHint }, update: { apiKeyEnc, keyHint } });
  } else {
    await db.tenantAiSettings.upsert({ where: { tenantId: ref.tenantId }, create: { tenantId: ref.tenantId, apiKeyEnc, keyHint }, update: { apiKeyEnc, keyHint } });
  }
  return { ok: true, keyHint };
}

/** Entfernt den gespeicherten Schlüssel. */
export async function removeKey(ref: AiScopeRef): Promise<void> {
  if (ref.scope === "platform") {
    await db.platformAiSettings.updateMany({ where: { id: "global" }, data: { apiKeyEnc: null, keyHint: null } });
  } else {
    await db.tenantAiSettings.updateMany({ where: { tenantId: ref.tenantId }, data: { apiKeyEnc: null, keyHint: null } });
  }
}

export type TestKeyResult = { ok: true } | { ok: false; code: AiErrorCode | "invalidFormat" };

/** Prüft einen Schlüssel beim Anbieter (Modell-Liste, verbraucht keine Tokens). */
export async function testKey(apiKey: string): Promise<TestKeyResult> {
  const key = apiKey.trim();
  if (!isPlausibleApiKey(key)) return { ok: false, code: "invalidFormat" };
  try {
    await createAiClient(key).models.list({ limit: 1 });
    return { ok: true };
  } catch (err) {
    return { ok: false, code: toAiError(err).code };
  }
}

/**
 * Prüft den gespeicherten Schlüssel eines Bereichs – auch wenn KI noch ausgeschaltet ist
 * (Admin testet vor dem Einschalten). code "noKey": nichts gespeichert. Aufrufer prüft die Rechte.
 */
export async function testStoredKey(ref: AiScopeRef): Promise<TestKeyResult | { ok: false; code: "noKey" }> {
  const key = await loadStoredApiKey(ref);
  if (!key) return { ok: false, code: "noKey" };
  try {
    await createAiClient(key).models.list({ limit: 1 });
    return { ok: true };
  } catch (err) {
    return { ok: false, code: toAiError(err).code };
  }
}
