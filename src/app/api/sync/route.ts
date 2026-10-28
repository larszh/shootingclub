import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { processSyncOps, syncRequestSchema } from "@/modules/scores/sync";
import type { SyncResponse } from "@/lib/offline/types";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: noStore });
}

/** Nur Anfragen von der eigenen Seite (Schutz gegen Cross-Site-Requests). */
function sameOrigin(req: NextRequest) {
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
 * Offline-Synchronisierung: nimmt eine Liste von Operationen entgegen (Durchgang erstellen,
 * Serie speichern, Status setzen) und liefert pro Operation ein Resultat.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ error: "Ungültige Herkunft" }, 403);
  if (!(req.headers.get("content-type") ?? "").includes("application/json")) return json({ error: "JSON erwartet" }, 415);

  const user = await getCurrentUser();
  if (!user) return json({ error: "Nicht angemeldet" }, 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Ungültiges JSON" }, 400);
  }
  const parsed = syncRequestSchema.safeParse(body);
  if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? "Ungültige Anfrage" }, 400);

  const results = await processSyncOps(user, parsed.data.ops);
  const response: SyncResponse = { results, serverTime: Date.now() };
  return json(response);
}
