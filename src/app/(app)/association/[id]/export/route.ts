import { NextResponse } from "next/server";
import { todayZurich } from "@/lib/time";
import { csvResponseHeaders } from "@/modules/scores/analytics";
import { currentSwissYear } from "@/modules/federal/queries";
import { parseYear } from "@/modules/federal/types";
import { associationContextOrNull, listAssociationMembers, listRankingPrograms, loadAssociationRanking, loadClubStats, sharingScope } from "@/modules/association/queries";
import { buildRankingCsv, buildStatsCsv, parseRankingParams } from "@/modules/association/stats";
import { slugify } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * CSV-Exporte des Verbandsbereichs (UTF-8 mit BOM, Semikolon, Formelschutz):
 * kind=stats&year=… (Kennzahlen pro Verein) oder kind=ranking&program=…&from=…&to=…&official=1.
 * Nur für Super-Admins und Verbandsbenutzer; enthält nur, was die Vereine freigegeben haben.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await associationContextOrNull(id);
  if (!ctx) return new NextResponse("Nicht gefunden", { status: 404 });
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind");
  const members = await listAssociationMembers(ctx.association.id);
  const scope = sharingScope(ctx.access, members);
  const base = slugify(ctx.association.name) || "verband";
  const headers = (filename: string) => ({ ...csvResponseHeaders(filename), "X-Content-Type-Options": "nosniff" });

  if (kind === "stats") {
    const year = parseYear(url.searchParams.get("year"), currentSwissYear());
    const rows = await loadClubStats(scope.readable, scope.names, year, todayZurich());
    return new NextResponse(buildStatsCsv(rows), { headers: headers(`${base}-statistik-${year}.csv`) });
  }
  if (kind === "ranking") {
    const programs = await listRankingPrograms();
    const sp = url.searchParams;
    const p = parseRankingParams({ program: sp.get("program"), from: sp.get("from"), to: sp.get("to"), official: sp.get("official") }, programs.map((x) => x.id), todayZurich());
    if (!p.programId) return new NextResponse("Kein Programm", { status: 400 });
    const { program, ranking } = await loadAssociationRanking(scope, p.programId, p.from, p.to, p.officialOnly);
    if (!program) return new NextResponse("Programm nicht gefunden", { status: 404 });
    return new NextResponse(buildRankingCsv(ranking, program.scoringMode === "RINGS_DECIMAL"), { headers: headers(`${base}-rangliste-${slugify(program.name) || "programm"}-${p.from}-${p.to}.csv`) });
  }
  return new NextResponse("Unbekannter Export", { status: 400 });
}
