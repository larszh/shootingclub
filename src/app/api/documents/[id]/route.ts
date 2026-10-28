import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { StorageError } from "@/lib/file-storage";
import { canAccessFile, openTenantFile } from "@/modules/files/service";
import { isDangerousType, isInlineSafe } from "@/modules/files/types";

export const dynamic = "force-dynamic";

/** Content-Disposition mit ASCII-Fallback und UTF-8-Namen (RFC 6266 / RFC 5987). */
function contentDisposition(type: "inline" | "attachment", filename: string) {
  const ascii = filename
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e]|["\\%;]/g, "_");
  const encoded = encodeURIComponent(filename).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

function text(status: number, body: string) {
  return new NextResponse(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}

/**
 * Datei aus der Dateiablage oder dem Chat. ?download=1 erzwingt den Download.
 * Riskante Typen (HTML, SVG, Programme …) werden immer als Download ausgeliefert.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return text(401, "Bitte zuerst anmelden.");
  const { id } = await params;
  const file = await db.storedFile.findUnique({ where: { id } });
  if (!file) return text(404, "Datei nicht gefunden.");
  const allowed = await canAccessFile({ userId: user.id, isSuperAdmin: user.isSuperAdmin, tenantRoles: user.memberships }, file);
  // Kein Hinweis darauf, ob die Datei existiert
  if (!allowed) return text(404, "Datei nicht gefunden.");

  let content;
  try {
    content = await openTenantFile(file);
  } catch (e) {
    if (e instanceof StorageError) {
      if (e.code === "NOT_FOUND") return text(404, "Die Datei fehlt im Speicher des Vereins.");
      return text(503, `Die Datei ist zurzeit nicht abrufbar. ${e.message}`);
    }
    console.error("[files] Download fehlgeschlagen:", e);
    return text(502, "Die Datei ist zurzeit nicht abrufbar.");
  }

  const wantsDownload = new URL(req.url).searchParams.get("download") === "1";
  const inline = !wantsDownload && isInlineSafe(file.mimeType, file.name);
  const headers: Record<string, string> = {
    "Content-Type": isDangerousType(file.mimeType, file.name) ? "application/octet-stream" : file.mimeType === "text/plain" ? "text/plain; charset=utf-8" : file.mimeType,
    "Content-Disposition": contentDisposition(inline ? "inline" : "attachment", file.name),
    "Cache-Control": "private, max-age=300",
    "X-Content-Type-Options": "nosniff",
  };
  if (content.size != null && content.size >= 0) headers["Content-Length"] = String(content.size);
  // Ausser PDFs (sonst blockiert der Browser seinen PDF-Viewer) nichts ausführen lassen.
  if (file.mimeType !== "application/pdf" || !inline) headers["Content-Security-Policy"] = "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'self'; sandbox";
  return new NextResponse(content.stream, { status: 200, headers });
}
