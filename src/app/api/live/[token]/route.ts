import { NextResponse } from "next/server";
import { LIVE_HEADERS, boardExpired, buildSnapshot, findBoardByToken } from "@/modules/live/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Öffentlicher Stand einer Live-Rangliste als JSON (Rückfall, wenn Server-Sent Events nicht gehen).
 * Ohne Anmeldung; der Token wird bei jedem Aufruf geprüft. Abgelaufen → 410, unbekannt → 404.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const board = await findBoardByToken(token);
  if (!board) return NextResponse.json({ error: "not_found" }, { status: 404, headers: LIVE_HEADERS });
  if (boardExpired(board)) return NextResponse.json({ error: "expired" }, { status: 410, headers: LIVE_HEADERS });
  try {
    const snapshot = await buildSnapshot(board);
    return NextResponse.json({ snapshot }, { headers: LIVE_HEADERS });
  } catch (e) {
    console.warn("[live] Stand fehlgeschlagen:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers: LIVE_HEADERS });
  }
}
