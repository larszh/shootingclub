import "server-only";
import { randomBytes } from "node:crypto";
import { StorageError } from "./types";

/** Dateiname für Speicher-Schlüssel: nur ASCII-Buchstaben, Ziffern, Punkt, Bindestrich, Unterstrich. */
export function sanitiseKeyName(name: string) {
  const ascii = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  return (ascii || "datei").slice(-80);
}

export function tenantKeyPrefix(tenantId: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(tenantId)) throw new StorageError("Ungültige Vereins-ID", "INVALID");
  return `tenant-files/${tenantId}/`;
}

/** Opaker Schlüssel: tenant-files/<tenantId>/<yyyy>/<zufall>-<name> */
export function buildStorageKey(tenantId: string, name: string, now: Date = new Date()) {
  const year = String(now.getUTCFullYear());
  return `${tenantKeyPrefix(tenantId)}${year}/${randomBytes(12).toString("base64url")}-${sanitiseKeyName(name)}`;
}

export function buildTestKey(tenantId: string) {
  return `${tenantKeyPrefix(tenantId)}.standchef-test-${randomBytes(6).toString("hex")}.txt`;
}

/**
 * Prüft, dass ein Schlüssel zum Verein gehört und keine Pfad-Tricks enthält.
 * Gilt für alle Anbieter (Dateisystem, S3, WebDAV).
 */
export function assertTenantKey(tenantId: string, key: string) {
  const prefix = tenantKeyPrefix(tenantId);
  if (!key.startsWith(prefix)) throw new StorageError("Ungültiger Speicherpfad", "INVALID");
  const segments = key.split("/");
  if (segments.some((s) => s === "" || s === "." || s === ".." || s.includes("\\") || s.includes("\0"))) {
    throw new StorageError("Ungültiger Speicherpfad", "INVALID");
  }
  if (!/^[A-Za-z0-9._\-/]+$/.test(key)) throw new StorageError("Ungültiger Speicherpfad", "INVALID");
}
