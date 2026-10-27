import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { readStoredFile } from "@/lib/storage";

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
    return new NextResponse(new Uint8Array(data), {
      headers: { "Content-Type": t.mimeType ?? "application/octet-stream", "Cache-Control": "private, max-age=300", "Content-Disposition": `inline; filename="${encodeURIComponent(t.name)}"` },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
