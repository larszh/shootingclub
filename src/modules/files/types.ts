import { z } from "zod";

/** Gemeinsame Konstanten und Hilfen der Dateiablage (Server und Client). */

export const FOLDER_VISIBILITY = [
  { value: "MEMBER", label: "Alle Mitglieder", short: "Alle" },
  { value: "TRAINER", label: "ab Trainer", short: "ab Trainer" },
  { value: "ADMIN", label: "nur Admins", short: "nur Admins" },
] as const;
export type FolderVisibility = (typeof FOLDER_VISIBILITY)[number]["value"];
const FOLDER_ROLES = ["MEMBER", "TRAINER", "ADMIN", "OWNER"] as const;

export function visibilityLabel(role: string) {
  if (role === "OWNER") return "nur Inhaber";
  return FOLDER_VISIBILITY.find((v) => v.value === role)?.label ?? "Alle Mitglieder";
}

const ROLE_RANK: Record<string, number> = { MEMBER: 1, TRAINER: 2, ADMIN: 3, OWNER: 4 };

/** Die strengere von zwei Mindestrollen. Unbekannte Werte gelten vorsichtshalber als ADMIN. */
export function stricterRole(a: string, b: string) {
  const ra = ROLE_RANK[a] ?? ROLE_RANK.ADMIN!;
  const rb = ROLE_RANK[b] ?? ROLE_RANK.ADMIN!;
  if (rb > ra) return ROLE_RANK[b] ? b : "ADMIN";
  return ROLE_RANK[a] ? a : "ADMIN";
}

export const FILE_CONTEXTS = ["FILES", "CHAT"] as const;
export type FileContext = (typeof FILE_CONTEXTS)[number];

export const MAX_NAME_LENGTH = 191;
export const MB = 1024 * 1024;

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return "–";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  const digits = v >= 100 || i === 0 ? 0 : 1;
  return `${v.toLocaleString("de-CH", { maximumFractionDigits: digits, minimumFractionDigits: 0 })} ${units[i]}`;
}

export type FileKind = "image" | "pdf" | "text" | "sheet" | "slides" | "archive" | "audio" | "video" | "code" | "other";

export function fileExtension(name: string) {
  const m = /\.([A-Za-z0-9]{1,10})$/.exec(name);
  return m ? m[1]!.toLowerCase() : "";
}

export function fileKind(mimeType: string, name: string): FileKind {
  const m = mimeType.toLowerCase();
  const ext = fileExtension(name);
  if (m.startsWith("image/")) return "image";
  if (m === "application/pdf" || ext === "pdf") return "pdf";
  if (m.startsWith("audio/")) return "audio";
  if (m.startsWith("video/")) return "video";
  if (/spreadsheet|excel|csv/.test(m) || ["xls", "xlsx", "ods", "csv", "numbers"].includes(ext)) return "sheet";
  if (/presentation|powerpoint/.test(m) || ["ppt", "pptx", "odp", "key"].includes(ext)) return "slides";
  if (/zip|compressed|x-tar|x-7z|x-rar|gzip/.test(m) || ["zip", "7z", "rar", "tar", "gz"].includes(ext)) return "archive";
  if (/html|javascript|json|xml/.test(m) || ["html", "htm", "js", "json", "xml", "svg"].includes(ext)) return "code";
  if (m.startsWith("text/") || /word|opendocument\.text|rtf/.test(m) || ["doc", "docx", "odt", "rtf", "txt", "md", "pages"].includes(ext)) return "text";
  return "other";
}

/** Typen, die der Browser gefahrlos direkt anzeigen darf. Alles andere wird nur heruntergeladen. */
const INLINE_SAFE = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
  "application/pdf",
  "text/plain",
  "audio/mpeg",
  "audio/mp4",
  "audio/ogg",
  "audio/wav",
  "video/mp4",
  "video/webm",
]);

/** Ausführbare oder skriptfähige Endungen: immer nur als Download ausliefern. */
const RISKY_EXT = new Set(["html", "htm", "xhtml", "svg", "svgz", "xml", "js", "mjs", "exe", "msi", "bat", "cmd", "com", "scr", "ps1", "sh", "jar", "apk", "app", "dmg", "vbs", "wsf", "hta", "php", "swf"]);

export function isInlineSafe(mimeType: string, name: string) {
  const m = mimeType.toLowerCase();
  if (RISKY_EXT.has(fileExtension(name))) return false;
  return INLINE_SAFE.has(m);
}

export function isRiskyType(mimeType: string, name: string) {
  return !isInlineSafe(mimeType, name);
}

/** Skriptfähige oder ausführbare Inhalte: auch der Content-Type wird neutralisiert. */
export function isDangerousType(mimeType: string, name: string) {
  return RISKY_EXT.has(fileExtension(name)) || /html|svg|xml|javascript|ecmascript|x-msdownload|x-sh|x-executable|java-archive/.test(mimeType.toLowerCase());
}

export function previewKind(mimeType: string, name: string): "image" | "pdf" | null {
  if (!isInlineSafe(mimeType, name)) return null;
  const m = mimeType.toLowerCase();
  if (m.startsWith("image/")) return "image";
  if (m === "application/pdf") return "pdf";
  return null;
}

/** Dateinamen bereinigen: keine Pfade, keine Steuerzeichen, max. 191 Zeichen, Endung bleibt. */
export function cleanFileName(raw: string) {
  const base = raw.split(/[\\/]/).pop() ?? "";
  let name = base.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "").replace(/\s+/g, " ").trim();
  name = name.replace(/^\.+/, "").trim();
  if (!name) name = "Datei";
  if (name.length > MAX_NAME_LENGTH) {
    const ext = fileExtension(name);
    const keep = ext ? MAX_NAME_LENGTH - ext.length - 1 : MAX_NAME_LENGTH;
    name = ext ? `${name.slice(0, keep).trimEnd()}.${ext}` : name.slice(0, keep);
  }
  return name;
}

export const folderNameSchema = z
  .string()
  .trim()
  .min(1, "Bitte einen Namen eingeben.")
  .max(80, "Höchstens 80 Zeichen.")
  .refine((v) => !/[\\/]/.test(v), "Ohne Schrägstriche.");

export const fileNameSchema = z.string().trim().min(1, "Bitte einen Namen eingeben.").max(MAX_NAME_LENGTH, `Höchstens ${MAX_NAME_LENGTH} Zeichen.`);

export const folderRoleSchema = z.enum(FOLDER_ROLES);

export const idSchema = z.string().trim().min(1).max(191);
