import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { apiConversationAccess, json, sameOrigin } from "@/modules/chat/api";
import { markRead } from "@/modules/chat/service";

export const dynamic = "force-dynamic";

/** Unterhaltung als gelesen markieren (setzt ChatMember.lastReadAt auf jetzt). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return json({ error: "Ungültige Herkunft" }, 403);
  const user = await getCurrentUser();
  if (!user) return json({ error: "Nicht angemeldet" }, 401);
  const { id } = await params;
  const access = await apiConversationAccess(user, id);
  if (!access) return json({ error: "Nicht gefunden" }, 404);
  const at = await markRead(user.id, access, new Date());
  return json({ lastReadAt: at.toISOString() });
}
