import "server-only";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Minimaler Dateispeicher auf dem lokalen Dateisystem.
 * Für Produktion durch S3/R2-Adapter mit gleicher Schnittstelle ersetzen.
 */
function baseDir() {
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.UPLOAD_DIR ?? "./storage/uploads");
}

function safeRel(rel: string) {
  const normalized = path.normalize(rel).replace(/^(\.\.(\/|\\|$))+/, "");
  if (normalized.includes("..")) throw new Error("Ungültiger Pfad");
  return normalized;
}

export async function saveFile(rel: string, data: Buffer) {
  const full = path.join(baseDir(), safeRel(rel));
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, data);
  return rel;
}

export async function readStoredFile(rel: string) {
  return readFile(path.join(baseDir(), safeRel(rel)));
}

export async function deleteStoredFile(rel: string) {
  try {
    await unlink(path.join(baseDir(), safeRel(rel)));
  } catch {
    /* bereits weg */
  }
}
