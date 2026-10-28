import "server-only";
import { db } from "@/lib/db";
import { decryptJson, encryptJson } from "@/lib/crypto";
import { LocalStorageAdapter } from "./local";
import { S3StorageAdapter } from "./s3";
import { WebdavStorageAdapter } from "./webdav";
import { StorageError, isStorageProvider, type StorageAdapter, type StorageCredentialsBundle, type StorageProviderKey } from "./types";

export * from "./types";
export { buildStorageKey, sanitiseKeyName } from "./keys";

export const DEFAULT_MAX_FILE_MB = 25;
/** Obergrenze, weil Uploads im Speicher gepuffert werden. */
export const HARD_MAX_FILE_MB = 200;

export type TenantStorageSettings = {
  provider: StorageProviderKey;
  quotaMb: number | null;
  maxFileMb: number;
  credentials: StorageCredentialsBundle;
  /** Zugangsdaten liessen sich nicht entschlüsseln (z.B. AUTH_SECRET geändert) */
  credentialsBroken: boolean;
  updatedAt: Date | null;
};

export function decodeCredentials(enc: string | null | undefined): { bundle: StorageCredentialsBundle; broken: boolean } {
  if (!enc) return { bundle: {}, broken: false };
  try {
    const raw = decryptJson<StorageCredentialsBundle>(enc);
    return { bundle: raw && typeof raw === "object" ? raw : {}, broken: false };
  } catch {
    return { bundle: {}, broken: true };
  }
}

export function encodeCredentials(bundle: StorageCredentialsBundle) {
  return encryptJson(bundle);
}

/** Einstellungen der Dateiablage eines Vereins (Standard: Server-Speicher, 25 MB pro Datei, ohne Kontingent). */
export async function loadStorageSettings(tenantId: string): Promise<TenantStorageSettings> {
  const cfg = await db.storageConfig.findUnique({ where: { tenantId } });
  if (!cfg) return { provider: "LOCAL", quotaMb: null, maxFileMb: DEFAULT_MAX_FILE_MB, credentials: {}, credentialsBroken: false, updatedAt: null };
  const { bundle, broken } = decodeCredentials(cfg.credentialsEnc);
  return {
    provider: isStorageProvider(cfg.provider) ? cfg.provider : "LOCAL",
    quotaMb: cfg.quotaMb,
    maxFileMb: Math.min(Math.max(cfg.maxFileMb || DEFAULT_MAX_FILE_MB, 1), HARD_MAX_FILE_MB),
    credentials: bundle,
    credentialsBroken: broken,
    updatedAt: cfg.updatedAt,
  };
}

/** Baut den Adapter für einen Anbieter aus (entschlüsselten) Zugangsdaten. */
export function createAdapter(tenantId: string, provider: string, bundle: StorageCredentialsBundle): StorageAdapter {
  switch (provider) {
    case "LOCAL":
      return new LocalStorageAdapter(tenantId);
    case "S3":
      if (!bundle.s3) throw new StorageError("Für diese Datei fehlen die S3-Zugangsdaten. Bitte unter Verwaltung → Dateiablage wieder eintragen.", "NOT_CONFIGURED");
      return new S3StorageAdapter(tenantId, bundle.s3);
    case "WEBDAV":
      if (!bundle.webdav) throw new StorageError("Für diese Datei fehlen die Nextcloud-Zugangsdaten. Bitte unter Verwaltung → Dateiablage wieder eintragen.", "NOT_CONFIGURED");
      return new WebdavStorageAdapter(tenantId, bundle.webdav);
    default:
      throw new StorageError(`Unbekannter Speicher «${provider}».`, "NOT_CONFIGURED");
  }
}

/** Aktiver Speicher des Vereins für neue Dateien. Ohne Konfiguration: Server (LOCAL). */
export async function getTenantStorage(tenantId: string): Promise<StorageAdapter> {
  const s = await loadStorageSettings(tenantId);
  if (s.credentialsBroken && s.provider !== "LOCAL") {
    throw new StorageError("Die gespeicherten Zugangsdaten lassen sich nicht mehr entschlüsseln. Bitte unter Verwaltung → Dateiablage neu eintragen.", "NOT_CONFIGURED");
  }
  return createAdapter(tenantId, s.provider, s.credentials);
}

/**
 * Speicher, in dem eine bestimmte Datei liegt (StoredFile.provider). So bleiben ältere
 * Dateien lesbar, auch wenn der Verein inzwischen einen anderen Anbieter nutzt.
 */
export async function getStorageForProvider(tenantId: string, provider: string): Promise<StorageAdapter> {
  if (provider === "LOCAL") return new LocalStorageAdapter(tenantId);
  const s = await loadStorageSettings(tenantId);
  if (s.credentialsBroken) {
    throw new StorageError("Die gespeicherten Zugangsdaten lassen sich nicht mehr entschlüsseln. Bitte unter Verwaltung → Dateiablage neu eintragen.", "NOT_CONFIGURED");
  }
  return createAdapter(tenantId, provider, s.credentials);
}
