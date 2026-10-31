import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAppContext } from "@/lib/tenant";
import { csvResponseHeaders } from "@/modules/scores/analytics";
import { OFFICIAL_KINDS } from "@/modules/scores/types";
import { currentSwissYear, listOfficialResults } from "@/modules/federal/queries";
import { buildSatCsv, parseYear } from "@/modules/federal/types";

export const dynamic = "force-dynamic";

/**
 * Amtliche Resultate als CSV für SAT-Admin (UTF-8 mit BOM, Semikolon). Nur für Schützenmeister (results.verify).
 * Parameter: year, kind (OP|FS|QUAL), eventId. Ohne AHV-Nummer.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Nicht angemeldet", { status: 401 });
  const ctx = await getAppContext();
  if (!ctx.tenant) return new NextResponse("Kein Verein ausgewählt", { status: 400 });
  if (!ctx.hasModule("federal")) return new NextResponse("Modul nicht aktiv", { status: 403 });
  if (!ctx.can("results.verify")) return new NextResponse("Keine Berechtigung", { status: 403 });

  const url = new URL(req.url);
  const year = parseYear(url.searchParams.get("year"), currentSwissYear());
  const kindRaw = url.searchParams.get("kind") ?? "";
  const kind = OFFICIAL_KINDS.some((k) => k.key === kindRaw) ? kindRaw : undefined;
  const eventIdRaw = url.searchParams.get("eventId");
  const eventId = eventIdRaw && /^[A-Za-z0-9_-]{1,64}$/.test(eventIdRaw) ? eventIdRaw : undefined;

  const rows = await listOfficialResults(ctx.tenant.id, year, { kind, eventId });
  const csv = buildSatCsv(rows);
  const filename = `bundesuebungen-${kind ? kind.toLowerCase() : "alle"}-${year}${eventId ? "-anlass" : ""}.csv`;
  return new NextResponse(csv, { headers: { ...csvResponseHeaders(filename), "X-Content-Type-Options": "nosniff" } });
}
