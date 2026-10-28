import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import type { CurrentUser } from "@/lib/auth";
import { getConversationAccess } from "./service";

/** Gleicher Cookie-Name wie in src/lib/tenant.ts (aktiver Verein). */
const TENANT_COOKIE = "standchef_tenant";

export const noStore = { "Cache-Control": "no-store" };

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: noStore });
}

/** Nur Anfragen von der eigenen Seite (Schutz gegen Cross-Site-Requests). */
export function sameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/**
 * Aktiver Verein wie in getAppContext: Cookie, sonst erste Mitgliedschaft.
 * Nur Vereine mit echter Mitgliedschaft – Super-Admins lesen keine fremden Chats.
 */
export function activeTenantId(req: NextRequest, user: CurrentUser): string | null {
  const wanted = req.cookies.get(TENANT_COOKIE)?.value;
  const m = (wanted && user.memberships.find((x) => x.tenantId === wanted)) || user.memberships[0];
  return m?.tenantId ?? null;
}

/** Zugriff auf eine Unterhaltung im Route-Handler (prüft Verein, Modul und Mitgliedschaft). */
export async function apiConversationAccess(user: CurrentUser, conversationId: string) {
  return getConversationAccess(user.id, conversationId);
}
