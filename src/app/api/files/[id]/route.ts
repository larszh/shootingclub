import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { readStoredFile } from "@/lib/storage";
import { contentDisposition } from "@/modules/targets/file-url";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;
  const t = await db.targetTemplate.findUnique({ where: { id } });
  if (!t || !t.filePath) return new NextResponse("Not found", { status: 404 });
  const memberTenantIds = new Set(user.memberships.map((m) => m.tenantId));
  const allowed =
    user.isSuperAdmin ||
    t.ownerUserId === user.id ||
    (t.tenantId === null && t.ownerUserId === null) ||
    (t.tenantId !== null && memberTenantIds.has(t.tenantId) && (t.ownerUserId === null || t.sharedWithTenant));
  if (!allowed) return new NextResponse("Forbidden", { status: 403 });
  try {
    const data = await readStoredFile(t.filePath);
    const headers: Record<string, string> = {
      "Content-Type": t.mimeType ?? "application/octet-stream",
      "Cache-Control": "private, max-age=300",
      "Content-Disposition": contentDisposition("inline", t.name),
      "X-Content-Type-Options": "nosniff",
    };
    // Hochgeladene SVGs können Skripte enthalten: beim direkten Öffnen nichts ausführen lassen.
    // (Für PDFs keine Sandbox, sonst blockiert der Browser seinen PDF-Viewer.)
    if (t.mimeType === "image/svg+xml") headers["Content-Security-Policy"] = "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox";
    return new NextResponse(new Uint8Array(data), { headers });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
