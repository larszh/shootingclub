import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAppContext } from "@/lib/tenant";
import { audit } from "@/lib/audit";
import { csvResponseHeaders } from "@/modules/scores/analytics";
import { canSeeAll, currentSwissYear } from "@/modules/federal/queries";
import { awardExportRows, fsAwardsOverview } from "@/modules/federal/awards-queries";
import { buildAwardsCsv } from "@/modules/federal/awards";
import { parseYear } from "@/modules/federal/types";

export const dynamic = "force-dynamic";

/**
 * Feldschiessen-Auszeichnungen eines Jahres als CSV (UTF-8 mit BOM, Semikolon, Formelschutz).
 * Für Mitgliederliste bzw. Schützenmeister (wie die Seite /federal/awards). Parameter: year.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Nicht angemeldet", { status: 401 });
  const ctx = await getAppContext();
  if (!ctx.tenant) return new NextResponse("Kein Verein ausgewählt", { status: 400 });
  if (!ctx.hasModule("federal")) return new NextResponse("Modul nicht aktiv", { status: 403 });
  if (!canSeeAll(ctx)) return new NextResponse("Keine Berechtigung", { status: 403 });

  const url = new URL(req.url);
  const year = parseYear(url.searchParams.get("year"), currentSwissYear());
  const rows = awardExportRows(await fsAwardsOverview(ctx.tenant.id, year));
  await audit({ tenantId: ctx.tenant.id, actorId: user.id, action: "federal.awards.export", entity: "AwardLimit", entityId: String(year), detail: `Auszeichnungen Feldschiessen ${year} (${rows.length} Zeilen)` });
  return new NextResponse(buildAwardsCsv(rows), { headers: { ...csvResponseHeaders(`feldschiessen-auszeichnungen-${year}.csv`), "X-Content-Type-Options": "nosniff" } });
}
