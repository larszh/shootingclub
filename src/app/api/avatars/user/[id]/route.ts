import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { serveStoredImage } from "../../serve";

/** Profilbild: sichtbar für die Person selbst, Super-Admins und alle, die einen Verein mit ihr teilen. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;

  let allowed = me.id === id || me.isSuperAdmin;
  if (!allowed) {
    const tenantIds = me.memberships.map((m) => m.tenantId);
    if (tenantIds.length) {
      const shared = await db.membership.findFirst({ where: { userId: id, tenantId: { in: tenantIds } }, select: { id: true } });
      allowed = !!shared;
    }
  }
  // Kein Hinweis darauf, ob die Person existiert.
  if (!allowed) return new NextResponse("Not found", { status: 404 });

  const user = await db.user.findUnique({ where: { id }, select: { avatarPath: true } });
  return serveStoredImage(req, user?.avatarPath);
}
