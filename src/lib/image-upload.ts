import "server-only";
import { randomBytes } from "node:crypto";
import { saveFile } from "@/lib/storage";

/**
 * Gemeinsame Validierung und Ablage für Profilbilder und Vereinslogos.
 * Der Client liefert bereits verkleinerte 512×512-Bilder (WebP, Fallback JPEG),
 * PNG wird zusätzlich akzeptiert. Geprüft werden Grösse, deklarierter MIME-Typ
 * und die tatsächlichen Magic Bytes.
 */

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export type ImageType = { mime: "image/webp" | "image/jpeg" | "image/png"; ext: "webp" | "jpg" | "png" };

const ALLOWED_MIME = new Set(["image/webp", "image/jpeg", "image/png"]);

/** Erkennt das Bildformat anhand der ersten Bytes. */
export function detectImageType(buf: Uint8Array): ImageType | null {
  if (buf.length >= 12 && buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) {
    return { mime: "image/webp", ext: "webp" };
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { mime: "image/jpeg", ext: "jpg" };
  }
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 && buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a) {
    return { mime: "image/png", ext: "png" };
  }
  return null;
}

/** Content-Type für einen gespeicherten Pfad (nach Dateiendung). */
export function mimeFromPath(rel: string): string {
  if (rel.endsWith(".webp")) return "image/webp";
  if (rel.endsWith(".jpg") || rel.endsWith(".jpeg")) return "image/jpeg";
  if (rel.endsWith(".png")) return "image/png";
  return "application/octet-stream";
}

export type ValidatedImage = { data: Buffer; type: ImageType };

/** Liest und prüft die Datei aus einem FormData-Feld. Gibt eine deutsche Fehlermeldung zurück. */
export async function readImageFromForm(formData: FormData, field = "file"): Promise<ValidatedImage | { error: string }> {
  const file = formData.get(field);
  if (!(file instanceof File) || file.size === 0) return { error: "Bitte ein Bild auswählen." };
  if (file.size > MAX_IMAGE_BYTES) return { error: "Das Bild ist zu gross (maximal 2 MB)." };
  if (file.type && !ALLOWED_MIME.has(file.type)) return { error: "Nur WebP, JPG oder PNG sind erlaubt." };
  const data = Buffer.from(await file.arrayBuffer());
  const type = detectImageType(data);
  if (!type) return { error: "Die Datei ist kein gültiges Bild." };
  if (file.type && file.type !== type.mime) return { error: "Dateityp und Inhalt passen nicht zusammen." };
  return { data, type };
}

/**
 * Speichert ein Bild unter avatars/<kind>-<id>-<rand>.<ext>. Die vorherige Datei löscht der
 * Aufrufer erst nach erfolgreichem DB-Update mit deleteStoredFile().
 */
export async function storeAvatarImage(kind: "user" | "tenant", id: string, img: ValidatedImage): Promise<string> {
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "");
  const rel = `avatars/${kind}-${safeId}-${randomBytes(6).toString("hex")}.${img.type.ext}`;
  await saveFile(rel, img.data);
  return rel;
}
