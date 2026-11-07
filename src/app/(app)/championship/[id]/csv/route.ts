import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAppContext } from "@/lib/tenant";
import { slugify } from "@/lib/utils";
import { csvResponse, toCsv } from "@/modules/billing/csv";
import { getChampionship, loadRanking } from "@/modules/championship/queries";
import { findEntry } from "@/modules/championship/ranking";
import { NO_CATEGORY } from "@/modules/championship/types";
import { getRequestLocale, getT } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const num = (n: number) => String(Math.round(n * 100) / 100);

/** Rangliste als CSV (Semikolon, UTF-8 mit BOM, Schutz vor Formeln). Nur «championship.manage». */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const t = getT(await getRequestLocale());
  const user = await getCurrentUser();
  if (!user) return new NextResponse(t("adm2.common.http.unauthenticated"), { status: 401 });
  const ctx = await getAppContext();
  if (!ctx.tenant) return new NextResponse(t("adm2.common.http.noClub"), { status: 400 });
  if (!ctx.hasModule("championship")) return new NextResponse(t("adm2.common.http.moduleOff"), { status: 403 });
  if (!ctx.can("championship.manage")) return new NextResponse(t("adm2.common.http.forbidden"), { status: 403 });
  const { id } = await params;
  const c = await getChampionship(ctx.tenant.id, id);
  if (!c) return new NextResponse(t("adm2.common.http.notFound"), { status: 404 });
  const { ranking } = await loadRanking(ctx.tenant.id, c);
  const h = (k: string) => t(`adm2.champ.csv.${k}`);

  const header = [h("rank"), h("name"), h("birthYear"), h("category"), h("catRank"), ...c.programs.map((p) => p.name), h("bonus"), h("total"), h("best"), h("counted"), h("struck"), h("status")];
  const rows = [...ranking.ranked, ...ranking.unclassified].map((e) => {
    const { categoryRank } = findEntry(ranking, e.userId);
    return [
      e.rank ?? "",
      e.name,
      e.birthYear ?? "",
      e.category === NO_CATEGORY ? t("shooting.champ.noCategory") : e.category,
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
      e.missingRequired.length ? t("adm2.champ.csv.unranked", { list: e.missingRequired.join(", ") }) : h("ranked"),
    ];
  });
  const slug = slugify(c.name) || "meisterschaft";
  // Jahr nur anhängen, wenn es nicht schon im Namen steht («Jahresmeisterschaft 2026»).
  const withYear = slug.split("-").includes(String(c.year)) ? slug : `${slug}-${c.year}`;
  return csvResponse(toCsv([header, ...rows]), `${h("file")}-${withYear}.csv`);
}
