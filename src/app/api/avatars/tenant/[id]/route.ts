import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { serveStoredImage } from "../../serve";

/** Vereinslogo: sichtbar für Mitglieder des Vereins und Super-Admins. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;

  const allowed = me.isSuperAdmin || me.memberships.some((m) => m.tenantId === id);
  if (!allowed) return new NextResponse("Not found", { status: 404 });

  const tenant = await db.tenant.findUnique({ where: { id }, select: { logoPath: true } });
  return serveStoredImage(req, tenant?.logoPath);
}
