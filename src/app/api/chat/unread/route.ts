import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { activeTenantId, json } from "@/modules/chat/api";
import { isChatEnabled, totalUnread } from "@/modules/chat/service";

export const dynamic = "force-dynamic";

/** Anzahl ungelesener Nachrichten im aktiven Verein (für das Badge). */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return json({ error: "Nicht angemeldet" }, 401);
  const tenantId = activeTenantId(req, user);
  if (!tenantId || !(await isChatEnabled(tenantId))) return json({ count: 0 });
  return json({ count: await totalUnread(user.id, tenantId) });
}
