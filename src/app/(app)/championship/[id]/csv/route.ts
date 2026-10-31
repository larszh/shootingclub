import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAppContext } from "@/lib/tenant";
import { slugify } from "@/lib/utils";
import { csvResponse, toCsv } from "@/modules/billing/csv";
import { getChampionship, loadRanking } from "@/modules/championship/queries";
import { findEntry } from "@/modules/championship/ranking";

export const dynamic = "force-dynamic";

const num = (n: number) => String(Math.round(n * 100) / 100);

/** Rangliste als CSV (Semikolon, UTF-8 mit BOM, Schutz vor Formeln). Nur «championship.manage». */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Nicht angemeldet", { status: 401 });
  const ctx = await getAppContext();
  if (!ctx.tenant) return new NextResponse("Kein Verein ausgewählt", { status: 400 });
  if (!ctx.hasModule("championship")) return new NextResponse("Modul nicht aktiv", { status: 403 });
  if (!ctx.can("championship.manage")) return new NextResponse("Keine Berechtigung", { status: 403 });
  const { id } = await params;
  const c = await getChampionship(ctx.tenant.id, id);
  if (!c) return new NextResponse("Nicht gefunden", { status: 404 });
  const { ranking } = await loadRanking(ctx.tenant.id, c);

  const header = ["Rang", "Name", "Jahrgang", "Kategorie", "Rang Kategorie", ...c.programs.map((p) => p.name), "Bonus", "Total", "Bestes Resultat", "Gezählte Resultate", "Gestrichene Resultate", "Status"];
  const rows = [...ranking.ranked, ...ranking.unclassified].map((e) => {
    const { categoryRank } = findEntry(ranking, e.userId);
    return [
      e.rank ?? "",
      e.name,
      e.birthYear ?? "",
      e.category,
      categoryRank ?? "",
      ...c.programs.map((p) => {
        const s = e.programs.find((x) => x.programId === p.programId);
        return s && s.counted.length ? num(s.weighted) : "";
      }),
      e.bonus ? num(e.bonus) : "",
      num(e.total),
      num(e.bestSingle),
      e.countedResults,
      e.programs.reduce((a, p) => a + p.struck.length, 0),
      e.missingRequired.length ? `nicht klassiert (fehlt: ${e.missingRequired.join(", ")})` : "klassiert",
    ];
  });
  const slug = slugify(c.name) || "meisterschaft";
  // Jahr nur anhängen, wenn es nicht schon im Namen steht («Jahresmeisterschaft 2026»).
  const withYear = slug.split("-").includes(String(c.year)) ? slug : `${slug}-${c.year}`;
  return csvResponse(toCsv([header, ...rows]), `rangliste-${withYear}.csv`);
}
