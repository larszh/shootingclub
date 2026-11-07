import { notFound } from "next/navigation";
import { PrintShell } from "@/components/invoice-document";
import { PrintButton } from "@/components/print-button";
import { getRequestLocale, getT } from "@/lib/i18n";
import { formatDate, type TFunction } from "@/lib/i18n/core";
import { dayKeyLabel } from "@/lib/i18n/extra/admin2/msg";
import { canViewChampionship, requireChampionship } from "@/modules/championship/guard";
import { getChampionship, loadRanking, nowDate } from "@/modules/championship/queries";
import { podium, type RankingEntry } from "@/modules/championship/ranking";
import { NO_CATEGORY, formatPoints } from "@/modules/championship/types";

export async function generateMetadata() {
  return { title: getT(await getRequestLocale())("adm2.champ.print.meta") };
}

const PODIUM_COLORS: Record<number, string> = { 1: "#d4a72c", 2: "#b8bcc2", 3: "#b07a4a" };

/** Rangliste für die GV: Podest, Gesamtrangliste, Kategorien und nicht Klassierte. A4 hoch. */
export default async function ChampionshipPrintPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ cats?: string }> }) {
  const ctx = await requireChampionship();
  const locale = await getRequestLocale();
  const t = getT(locale);
  const { id } = await params;
  const sp = await searchParams;
  const c = await getChampionship(ctx.tenant.id, id);
  if (!c || !canViewChampionship(ctx, c)) notFound();
  const { ranking } = await loadRanking(ctx.tenant.id, c);
  const top = podium(ranking.ranked);
  const showCats = sp.cats !== "0" && ranking.categories.some((k) => k.name !== NO_CATEGORY);
  const now = nowDate();

  return (
    <PrintShell title={t("adm2.champ.print.title", { name: c.name })} subtitle={t("adm2.champ.print.subtitle", { n: ranking.ranked.length })} action={<PrintButton />}>
      <style>{`@media print { thead { display: table-header-group; } tr { break-inside: avoid; } }`}</style>
      <div className="bg-white text-neutral-900 shadow-lg print:shadow-none" style={{ width: "210mm", minHeight: "297mm", padding: "14mm 14mm 12mm" }}>
        <header className="mb-6 flex items-start justify-between gap-6 border-b border-neutral-300 pb-3">
          <div className="flex items-center gap-3">
            {ctx.tenant.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={ctx.tenant.logoUrl} alt="" className="h-14 w-14 object-contain" />
            ) : null}
            <div>
              <div className="text-sm text-neutral-600">{ctx.tenant.name}</div>
              <h1 className="text-2xl font-bold leading-tight">{c.name}</h1>
              <div className="text-xs text-neutral-600">{dayKeyLabel(c.startsOn, locale)} – {dayKeyLabel(c.endsOn, locale)}</div>
            </div>
          </div>
          <div className="text-right text-xs text-neutral-600">{t("adm2.champ.print.asOf", { date: formatDate(now, locale) })}</div>
        </header>

        {top.length ? (
          <section className="mb-8">
            <div className="mx-auto grid max-w-[150mm] grid-cols-3 items-end gap-3">
              {[2, 1, 3].map((place) => {
                const people = top.filter((e) => e.rank === place);
                return (
                  <div key={place} className="text-center">
                    <div className="mb-1 text-[11pt] font-semibold leading-tight">{people.length ? people.map((p) => <div key={p.userId}>{p.name}</div>) : "–"}</div>
                    <div className="mb-1 text-[9pt] text-neutral-600">{people[0] ? t("adm2.champ.print.points", { n: formatPoints(people[0].total) }) : ""}</div>
                    <div className="flex items-start justify-center pt-2 text-[22pt] font-bold" style={{ background: PODIUM_COLORS[place], height: place === 1 ? "32mm" : place === 2 ? "24mm" : "17mm", color: place === 3 ? "#fff" : "#000" }}>
                      {place}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        <h2 className="mb-2 text-base font-semibold">{t("adm2.champ.print.overall")}</h2>
        <RankTable rows={ranking.ranked.map((e) => ({ e, rank: e.rank }))} programs={c.programs} t={t} />

        {showCats
          ? ranking.categories.map((k) => (
              <section key={k.name} className="mt-6" style={{ breakInside: "avoid" }}>
                <h2 className="mb-2 text-base font-semibold">{t("adm2.champ.print.category", { name: k.name === NO_CATEGORY ? t("shooting.champ.noCategory") : k.name })}</h2>
                <RankTable rows={k.entries.map((e) => ({ e, rank: e.categoryRank }))} programs={c.programs} t={t} />
              </section>
            ))
          : null}

        {ranking.unclassified.length ? (
          <section className="mt-6">
            <h2 className="mb-1 text-base font-semibold">{t("adm2.champ.print.unranked")}</h2>
            <p className="mb-2 text-[9pt] text-neutral-600">{t("adm2.champ.print.unrankedText")}</p>
            <RankTable rows={ranking.unclassified.map((e) => ({ e, rank: null }))} programs={c.programs} showMissing t={t} />
          </section>
        ) : null}

        <footer className="mt-8 text-[8pt] text-neutral-500">
          {c.bestOf ? t("adm2.champ.print.bestOf", { n: c.bestOf }) : t("adm2.champ.print.allCount")}
          {c.officialOnly ? t("adm2.champ.print.officialOnly") : ""}
          {t("adm2.champ.print.footer")}
        </footer>
      </div>
    </PrintShell>
  );
}

function RankTable({ rows, programs, showMissing, t }: { rows: Array<{ e: RankingEntry; rank: number | null }>; programs: Array<{ programId: string; name: string }>; showMissing?: boolean; t: TFunction }) {
  if (rows.length === 0) return <p className="text-[9pt] text-neutral-500">{t("adm2.champ.print.none")}</p>;
  const cell = "border border-neutral-300 px-1.5 py-1";
  return (
    <table className="w-full border-collapse text-[9pt] leading-tight">
      <thead>
        <tr className="bg-neutral-100 text-left">
          <th className={`${cell} w-[10mm]`}>{t("adm2.champ.csv.rank")}</th>
          <th className={cell}>{t("adm2.champ.csv.name")}</th>
          <th className={cell}>{t("adm2.champ.csv.category")}</th>
          {programs.map((p) => <th key={p.programId} className={`${cell} text-right`}>{p.name}</th>)}
          <th className={`${cell} text-right`}>{t("adm2.champ.csv.bonus")}</th>
          <th className={`${cell} text-right`}>{t("adm2.champ.csv.total")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ e, rank }) => (
          <tr key={e.userId}>
            <td className={`${cell} tabular-nums`}>{rank ?? "–"}</td>
            <td className={cell}>
              {e.name}
              {showMissing && e.missingRequired.length ? <span className="block text-[8pt] text-neutral-500">{t("adm2.champ.print.missing", { list: e.missingRequired.join(", ") })}</span> : null}
            </td>
            <td className={cell}>{e.category === NO_CATEGORY ? "" : e.category}</td>
            {programs.map((p) => {
              const s = e.programs.find((x) => x.programId === p.programId);
              return <td key={p.programId} className={`${cell} text-right tabular-nums`}>{s && s.counted.length ? formatPoints(s.weighted) : ""}</td>;
            })}
            <td className={`${cell} text-right tabular-nums`}>{e.bonus ? formatPoints(e.bonus) : ""}</td>
            <td className={`${cell} text-right font-semibold tabular-nums`}>{formatPoints(e.total)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
