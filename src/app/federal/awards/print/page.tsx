import { redirect } from "next/navigation";
import { PrintShell } from "@/components/invoice-document";
import { PrintButton } from "@/components/print-button";
import { formatDate, getRequestLocale, getT, type TFunction } from "@/lib/i18n";
import { formatScore } from "@/lib/utils";
import { canSeeAll, currentSwissYear, getClubInfo, nowDate, requireFederal } from "@/modules/federal/queries";
import { fsAwardsOverview } from "@/modules/federal/awards-queries";
import { awardCategoryLabel, isExampleLimits, type AwardResult } from "@/modules/federal/awards";
import { parseYear } from "@/modules/federal/types";

export async function generateMetadata() {
  return { title: getT(await getRequestLocale())("adm2.federal.aw.title") };
}

function statusText(r: AwardResult, t: TFunction): string {
  if (r.status === "award") return r.award;
  if (r.status === "none") return t("adm2.federal.aw.none");
  if (r.status === "no-category") return t("adm2.federal.aw.noCategory");
  return "";
}

/**
 * Druckliste «Auszeichnungen» (Feldschiessen) pro Jahr: pro Programm die Schützen mit Kategorie, Resultat
 * und berechneter Auszeichnung, dazu eine Spalte zum Abhaken bei der Abgabe.
 */
export default async function FederalAwardsPrintPage({ searchParams }: { searchParams: Promise<{ year?: string; only?: string }> }) {
  const ctx = await requireFederal();
  if (!canSeeAll(ctx)) redirect("/federal?denied=1");
  const sp = await searchParams;
  const locale = await getRequestLocale();
  const t = getT(locale);
  const now = nowDate();
  const year = parseYear(sp.year, currentSwissYear(now));
  const onlyAwarded = sp.only === "awarded";
  const [overview, club] = await Promise.all([fsAwardsOverview(ctx.tenant.id, year), getClubInfo(ctx.tenant.id)]);
  const sections = overview.sections
    .map((s) => ({ ...s, rows: onlyAwarded ? s.rows.filter((r) => r.result.status === "award") : s.rows }))
    .filter((s) => s.rows.length);
  const count = sections.reduce((n, s) => n + s.rows.length, 0);
  const title = t("adm2.federal.aw.printTitle", { year });

  return (
    <PrintShell title={title} subtitle={t(count === 1 ? "adm2.federal.aw.printSub.one" : "adm2.federal.aw.printSub.other", { n: count })} action={<PrintButton />}>
      <style>{`@media print { thead { display: table-header-group; } tr { break-inside: avoid; } }`}</style>
      <div className="bg-white text-neutral-900 shadow-lg print:shadow-none" style={{ width: "210mm", minHeight: "297mm", padding: "14mm 12mm" }}>
        <header className="mb-4 flex items-start justify-between gap-6 border-b border-neutral-300 pb-3">
          <div>
            <div className="text-lg font-semibold">{club.name}</div>
            <div className="text-xs text-neutral-600">{[club.street, club.zipCity, club.canton].filter(Boolean).join(" · ")}</div>
          </div>
          <div className="text-right">
            <div className="text-base font-semibold">{title}</div>
            <div className="text-xs text-neutral-600">{t("adm2.federal.pr.createdOn", { date: formatDate(now, locale) })}</div>
          </div>
        </header>

        {sections.length === 0 ? <p className="py-8 text-center text-sm text-neutral-500">{t(onlyAwarded ? "adm2.federal.aw.noneAwarded" : "adm2.federal.aw.noneResults")}</p> : null}

        {sections.map((s) => (
          <section key={s.program.id} className="mb-6">
            <h2 className="mb-1 text-sm font-semibold">{s.program.name}</h2>
            <p className="mb-2 text-[10px] text-neutral-600">
              {s.counts.length ? s.counts.map((c) => `${c.count} × ${c.award}`).join(" · ") : t("adm2.federal.aw.noAwards")}
              {s.limits.length ? ` · ${t("adm2.federal.aw.limits")}: ${s.limits.map((l) => `${l.category}${l.weaponCategory ? ` · ${l.weaponCategory}` : ""} ${l.award} ${t("adm2.federal.aw.from", { score: formatScore(l.minScore, !Number.isInteger(l.minScore)) })}`).join("; ")}` : ` · ${t("adm2.federal.aw.noLimitsShort")}`}
            </p>
            {isExampleLimits(s.limits) ? <p className="mb-2 border border-amber-400 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-900">{t("adm2.federal.aw.exampleNotice")}</p> : null}
            <table className="w-full border-collapse text-[10.5px] leading-tight">
              <thead>
                <tr className="bg-neutral-100 text-left">
                  <th className="border border-neutral-300 px-1.5 py-1">{t("adm2.federal.pr.nr")}</th>
                  <th className="border border-neutral-300 px-1.5 py-1">{t("adm2.federal.aw.col.name")}</th>
                  <th className="border border-neutral-300 px-1.5 py-1">{t("adm2.federal.aw.col.born")}</th>
                  <th className="border border-neutral-300 px-1.5 py-1">{t("adm2.federal.aw.col.category")}</th>
                  <th className="border border-neutral-300 px-1.5 py-1 text-right">{t("adm2.federal.aw.col.result")}</th>
                  <th className="border border-neutral-300 px-1.5 py-1">{t("adm2.federal.aw.col.award")}</th>
                  <th className="border border-neutral-300 px-1.5 py-1" style={{ width: "18mm" }}>{t("adm2.federal.aw.col.handedOut")}</th>
                </tr>
              </thead>
              <tbody>
                {s.rows.map((r, i) => (
                  <tr key={r.id}>
                    <td className="border border-neutral-300 px-1.5 py-1 tabular-nums">{i + 1}</td>
                    <td className="border border-neutral-300 px-1.5 py-1">{r.name}{r.isGuest ? ` ${t("adm2.federal.p.guest")}` : ""}{r.isOfficial ? "" : " *"}</td>
                    <td className="border border-neutral-300 px-1.5 py-1 tabular-nums">{r.birthYear ?? ""}</td>
                    <td className="border border-neutral-300 px-1.5 py-1">{awardCategoryLabel(r.result)}</td>
                    <td className="border border-neutral-300 px-1.5 py-1 text-right tabular-nums">{formatScore(r.total, r.decimal)}</td>
                    <td className="border border-neutral-300 px-1.5 py-1 font-medium">{statusText(r.result, t)}</td>
                    <td className="border border-neutral-300 px-1.5 py-1" />
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}

        <footer className="mt-8 grid grid-cols-2 gap-10 text-xs text-neutral-700">
          <div><div className="h-10 border-b border-neutral-500" />{t("adm2.common.placeDate")}</div>
          <div><div className="h-10 border-b border-neutral-500" />{t("adm2.federal.pr.sigMaster")}</div>
        </footer>
        <p className="mt-4 text-[9px] text-neutral-500">
          {t("adm2.federal.aw.printFooter")}
        </p>
      </div>
    </PrintShell>
  );
}
