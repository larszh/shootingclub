import "server-only";
import type { StoredFile } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { MODULES } from "@/lib/modules";
import { roleAtLeast, isTenantRole } from "@/lib/permissions";
import { buildStorageKey, getStorageForProvider, getTenantStorage, loadStorageSettings, StorageError, type GetResult } from "@/lib/file-storage";
import { cleanFileName, formatBytes, MB, stricterRole, type FileContext } from "./types";

/**
 * Öffentliche Schnittstelle der Dateiablage für andere Module (z.B. Chat).
 * Namen und Signaturen bitte stabil halten.
 */

/** Fehler mit Meldung für die Oberfläche (und passendem HTTP-Status für Route Handler). */
export class FileServiceError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
  ) {
    super(message);
    this.name = "FileServiceError";
  }
}

/** Fehlermeldung für die Oberfläche aus beliebigem Fehler. */
export function fileErrorMessage(e: unknown) {
  if (e instanceof FileServiceError || e instanceof StorageError) return e.message;
  return "Die Datei konnte nicht verarbeitet werden. Bitte nochmals versuchen.";
}

/** Platz für die Multipart-Hülle und weitere Formularfelder zusätzlich zur Datei. */
const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

/**
 * Liest ein multipart/form-data-Upload mit fester Obergrenze ein (maxFileMb + Multipart-Hülle).
 * Ohne Content-Length (chunked) wird beim Einlesen mitgezählt und abgebrochen, sobald die
 * Grenze überschritten ist. So kann niemand den Server mit beliebig grossen Anfragen füllen.
 * Wirft FileServiceError (400/413).
 */
export async function readUploadForm(req: Request, maxFileMb: number): Promise<FormData> {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) throw new FileServiceError("Ungültige Anfrage.", 400);
  const maxBytes = maxFileMb * MB + MULTIPART_OVERHEAD_BYTES;
  const tooBig = () => new FileServiceError(`Die Datei ist zu gross. Erlaubt sind höchstens ${maxFileMb} MB pro Datei.`, 413);
  const declaredRaw = req.headers.get("content-length");
  if (declaredRaw !== null) {
    const declared = Number(declaredRaw);
    if (!Number.isFinite(declared) || declared < 0) throw new FileServiceError("Ungültige Anfrage.", 400);
    if (declared > maxBytes) throw tooBig();
  }
  if (!req.body) throw new FileServiceError("Keine Datei erhalten.", 400);

  const reader = req.body.getReader();
  let received = 0;
  let exceeded = false;
  const limited = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) return controller.close();
      received += value.byteLength;
      if (received > maxBytes) {
        exceeded = true;
        await reader.cancel().catch(() => undefined);
        return controller.error(tooBig());
      }
      controller.enqueue(value);
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
  try {
    return await new Response(limited, { headers: { "content-type": contentType } }).formData();
  } catch {
    if (exceeded) throw tooBig();
    throw new FileServiceError("Die Datei konnte nicht gelesen werden. Bitte nochmals versuchen.", 400);
  }
}

function normaliseMime(raw: string) {
  const m = (raw || "").split(";")[0]!.trim().toLowerCase();
  if (!m || m.length > 100 || !/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(m)) return "application/octet-stream";
  return m;
}

/** Belegter Speicher eines Vereins (alle Kontexte, alle Anbieter). */
export async function tenantStorageUsage(tenantId: string) {
  const agg = await db.storedFile.aggregate({ where: { tenantId }, _sum: { sizeBytes: true }, _count: { _all: true } });
  return { bytes: agg._sum.sizeBytes ?? 0, count: agg._count._all };
}

/**
 * Speichert eine Datei im aktiven Speicher des Vereins und legt den StoredFile-Eintrag an.
 * Prüft maximale Dateigrösse und Kontingent. Gefährliche Typen (HTML, SVG, Programme)
 * werden gespeichert, aber immer nur als Download ausgeliefert.
 */
export async function saveTenantFile(input: {
  tenantId: string;
  userId: string;
  folderId?: string | null;
  name: string;
  mimeType: string;
  data: Buffer;
  context: FileContext;
}): Promise<StoredFile> {
  const { tenantId, userId, data, context } = input;
  const settings = await loadStorageSettings(tenantId);
  const size = data.length;
  if (size === 0) throw new FileServiceError("Die Datei ist leer.");
  if (size > settings.maxFileMb * MB) throw new FileServiceError(`Die Datei ist zu gross (${formatBytes(size)}). Erlaubt sind höchstens ${settings.maxFileMb} MB pro Datei.`, 413);
  if (settings.quotaMb != null) {
    const usage = await tenantStorageUsage(tenantId);
    const quotaBytes = settings.quotaMb * MB;
    if (usage.bytes + size > quotaBytes) {
      const free = Math.max(quotaBytes - usage.bytes, 0);
      throw new FileServiceError(
        free === 0
          ? `Der Speicherplatz des Vereins ist voll (${formatBytes(usage.bytes)} von ${settings.quotaMb} MB belegt). Bitte alte Dateien löschen oder das Kontingent erhöhen.`
          : `Nicht genug Speicherplatz frei: Die Datei braucht ${formatBytes(size)}, frei sind noch ${formatBytes(free)} (von ${settings.quotaMb} MB). Bitte alte Dateien löschen oder das Kontingent erhöhen.`,
        413,
      );
    }
  }

  let folderId: string | null = null;
  if (input.folderId) {
    const folder = await db.fileFolder.findFirst({ where: { id: input.folderId, tenantId }, select: { id: true } });
    if (!folder) throw new FileServiceError("Der Ordner existiert nicht mehr.", 404);
    folderId = folder.id;
  }

  const name = cleanFileName(input.name);
  const mimeType = normaliseMime(input.mimeType);
  const adapter = await getTenantStorage(tenantId);
  const storageKey = buildStorageKey(tenantId, name);
  await adapter.put(storageKey, data, { contentType: mimeType, size });
  try {
    return await db.storedFile.create({
      data: { tenantId, folderId, name, mimeType, sizeBytes: size, provider: adapter.provider, storageKey, uploadedById: userId, context },
    });
  } catch (e) {
    await adapter.delete(storageKey).catch(() => undefined);
    throw e;
  }
}

/**
 * Löscht Datei und Inhalt im Speicher. Mit tenantId nur innerhalb dieses Vereins.
 * Ist der Speicher nicht erreichbar, wird der Eintrag trotzdem entfernt (Rückgabe storageDeleted=false).
 */
export async function deleteTenantFile(fileId: string, tenantId?: string): Promise<{ deleted: boolean; storageDeleted: boolean }> {
  const file = await db.storedFile.findFirst({ where: { id: fileId, ...(tenantId ? { tenantId } : {}) } });
  if (!file) return { deleted: false, storageDeleted: false };
  let storageDeleted = true;
  try {
    const adapter = await getStorageForProvider(file.tenantId, file.provider);
    await adapter.delete(file.storageKey);
  } catch (e) {
    storageDeleted = false;
    console.warn(`[files] Speicherobjekt ${file.id} (${file.provider}) nicht gelöscht:`, e instanceof Error ? e.message : e);
  }
  await db.storedFile.deleteMany({ where: { id: file.id } });
  return { deleted: true, storageDeleted };
}

/** Inhalt einer Datei aus dem Speicher, in dem sie liegt. */
export async function openTenantFile(file: Pick<StoredFile, "tenantId" | "provider" | "storageKey">): Promise<GetResult> {
  const adapter = await getStorageForProvider(file.tenantId, file.provider);
  return adapter.get(file.storageKey);
}

// ---------------------------------------------------------------------------
// Rechte
// ---------------------------------------------------------------------------

export type FileActor = {
  userId: string;
  isSuperAdmin: boolean;
  /** Rolle pro Verein: { [tenantId]: "MEMBER" | … } oder Liste wie user.memberships */
  tenantRoles: Record<string, string> | ReadonlyArray<{ tenantId: string; role: string }>;
};

export function roleInTenant(actor: FileActor, tenantId: string): string | null {
  if (Array.isArray(actor.tenantRoles)) return (actor.tenantRoles as ReadonlyArray<{ tenantId: string; role: string }>).find((m) => m.tenantId === tenantId)?.role ?? null;
  return (actor.tenantRoles as Record<string, string>)[tenantId] ?? null;
}

/** Strengste Mindestrolle auf dem Pfad vom Ordner bis zur Wurzel (MEMBER, wenn ohne Ordner). */
export async function effectiveFolderMinRole(tenantId: string, folderId: string | null): Promise<string | null> {
  let role = "MEMBER";
  let current = folderId;
  const seen = new Set<string>();
  while (current) {
    if (seen.has(current) || seen.size > 64) break;
    seen.add(current);
    const f = await db.fileFolder.findFirst({ where: { id: current, tenantId }, select: { parentId: true, minRole: true } });
    if (!f) return null; // Ordner gehört nicht zum Verein
    role = stricterRole(role, f.minRole);
    current = f.parentId;
  }
  return role;
}

/** Ist ein Modul für den Verein aktiv? (gleiche Regel wie getAppContext: Eintrag, sonst Standard) */
async function moduleEnabled(tenantId: string, key: "files" | "chat") {
  const row = await db.tenantModule.findUnique({ where: { tenantId_moduleKey: { tenantId, moduleKey: key } }, select: { enabled: true } });
  if (row) return row.enabled;
  return MODULES.find((m) => m.key === key)?.defaultEnabled ?? false;
}

/**
 * Darf der Benutzer die Datei sehen?
 * FILES: Mitglied des Vereins mit Rolle ≥ strengste Ordner-Mindestrolle auf dem Pfad.
 * CHAT: Mitglied einer Unterhaltung, in der eine Nachricht auf die Datei verweist
 *       (oder selbst hochgeladen). Super-Admins dürfen alles.
 */
export async function canAccessFile(actor: FileActor, file: Pick<StoredFile, "id" | "tenantId" | "folderId" | "context" | "uploadedById">): Promise<boolean> {
  // Chat-Anhänge nur für Mitglieder der Unterhaltung: auch Super-Admins sehen fremde Chats nicht.
  if (file.context === "CHAT") {
    const chatRole = roleInTenant(actor, file.tenantId);
    if (!chatRole || !isTenantRole(chatRole)) return false;
    if (!(await moduleEnabled(file.tenantId, "chat"))) return false;
    if (file.uploadedById === actor.userId) return true;
    const msg = await db.chatMessage.findFirst({
      where: { fileId: file.id, deletedAt: null, conversation: { tenantId: file.tenantId, members: { some: { userId: actor.userId } } } },
      select: { id: true },
    });
    return !!msg;
  }

  if (actor.isSuperAdmin) return true;
  const role = roleInTenant(actor, file.tenantId);
  if (!role || !isTenantRole(role)) return false;
  if (!(await moduleEnabled(file.tenantId, "files"))) return false;
  const minRole = await effectiveFolderMinRole(file.tenantId, file.folderId);
  if (!minRole) return false;
  return roleAtLeast(role, isTenantRole(minRole) ? minRole : "ADMIN");
}
