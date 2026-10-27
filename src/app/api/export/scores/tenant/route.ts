import { NextResponse, type NextRequest } from "next/server";
import { scoreExportRows } from "@/modules/scores/insights";
import { isValidDay, parseDayEnd, parseDayStart } from "@/modules/scores/analytics";
import { slugify } from "@/lib/utils";
import { todayZurich } from "@/lib/time";
import { buildScoresCsv, csvResponse, exportContext } from "../csv";

export const dynamic = "force-dynamic";

/**
 * Alle Resultate des aktiven Vereins als CSV (nur mit Berechtigung match.viewAll).
 * Optional ?from=YYYY-MM-DD&to=YYYY-MM-DD (Schweizer Kalendertage, beide inklusive).
 */
export async function GET(req: NextRequest) {
  const res = await exportContext();
  if ("error" in res) return res.error;
  const { ctx } = res;
  if (!ctx.can("match.viewAll")) return new NextResponse("Keine Berechtigung", { status: 403 });
  const from = parseDayStart(req.nextUrl.searchParams.get("from"));
  const to = parseDayEnd(req.nextUrl.searchParams.get("to"));
  if (from && to && from >= to) return new NextResponse("Ungültiger Zeitraum", { status: 400 });
  const rows = await scoreExportRows({ tenantId: ctx.tenant.id, from, to });
  const range = [req.nextUrl.searchParams.get("from"), req.nextUrl.searchParams.get("to")].filter(isValidDay).join("_bis_");
  return csvResponse(buildScoresCsv(rows), `resultate-${slugify(ctx.tenant.name) || "verein"}-${range || todayZurich()}.csv`);
}
