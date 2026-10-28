import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAppContext } from "@/lib/tenant";
import { loadStorageSettings } from "@/lib/file-storage";
import { canSeeFolder, loadFolderTree } from "@/modules/files/queries";
import { FileServiceError, fileErrorMessage, readUploadForm, saveTenantFile } from "@/modules/files/service";
import { MB } from "@/modules/files/types";

export const dynamic = "force-dynamic";
// Uploads in grossen Vereinsspeicher (S3/WebDAV) können dauern.
export const maxDuration = 300;

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** Nur Anfragen von der eigenen Seite annehmen (zusätzlich zum SameSite-Cookie). */
function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    const o = new URL(origin);
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    return !!host && o.host === host;
  } catch {
    return false;
  }
}

/**
 * Upload einer Datei in die Dateiablage (multipart/form-data: file, folderId?, tenantId?).
 * Eine Datei pro Anfrage, damit der Browser den Fortschritt pro Datei zeigen kann.
 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json(403, { error: "Ungültige Herkunft der Anfrage." });
  const user = await getCurrentUser();
  if (!user) return json(401, { error: "Bitte zuerst anmelden." });
  const ctx = await getAppContext();
  if (!ctx.tenant) return json(400, { error: "Kein Verein ausgewählt." });
  if (!ctx.hasModule("files")) return json(403, { error: "Die Dateiablage ist für diesen Verein nicht aktiv." });
  if (!ctx.can("files.upload")) return json(403, { error: "Du darfst keine Dateien hochladen." });
  const tenantId = ctx.tenant.id;

  // Einlesen mit fester Obergrenze (auch ohne Content-Length), danach Dateigrösse genau prüfen.
  const settings = await loadStorageSettings(tenantId);
  const limit = settings.maxFileMb * MB;
  let form: FormData;
  try {
    form = await readUploadForm(req, settings.maxFileMb);
  } catch (e) {
    return json(e instanceof FileServiceError ? e.status : 400, { error: fileErrorMessage(e) });
  }

  const expectedTenant = form.get("tenantId");
  if (typeof expectedTenant === "string" && expectedTenant && expectedTenant !== tenantId) {
    return json(409, { error: "Du hast inzwischen den Verein gewechselt. Bitte Seite neu laden." });
  }
  const file = form.get("file");
  if (!file || typeof file === "string") return json(400, { error: "Keine Datei erhalten." });
  if (file.size > limit) return json(413, { error: `Die Datei ist zu gross. Erlaubt sind höchstens ${settings.maxFileMb} MB pro Datei.` });

  const folderRaw = form.get("folderId");
  let folderId: string | null = null;
  if (typeof folderRaw === "string" && folderRaw) {
    const tree = await loadFolderTree(tenantId);
    const node = tree.get(folderRaw);
    if (!node || !canSeeFolder(node, ctx.tenant.role, user.isSuperAdmin)) return json(404, { error: "Der Ordner existiert nicht mehr." });
    folderId = node.id;
  }

  try {
    const data = Buffer.from(await file.arrayBuffer());
    const stored = await saveTenantFile({ tenantId, userId: user.id, folderId, name: file.name, mimeType: file.type, data, context: "FILES" });
    return json(201, { ok: true, file: { id: stored.id, name: stored.name, sizeBytes: stored.sizeBytes, mimeType: stored.mimeType } });
  } catch (e) {
    const status = e instanceof FileServiceError ? e.status : 502;
    if (!(e instanceof FileServiceError)) console.error("[files] Upload fehlgeschlagen:", e);
    return json(status, { error: fileErrorMessage(e) });
  }
}
