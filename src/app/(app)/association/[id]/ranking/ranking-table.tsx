import { formatTotal, type AssociationRanking } from "@/modules/association/stats";
import type { TFunction } from "@/lib/i18n/core";

/** Rangliste als Tabelle (App und Druck). Vereine ohne Namensfreigabe nur mit Anzahl. */
export function RankingTable({ ranking, decimal, print, t }: { ranking: AssociationRanking; decimal: boolean; print?: boolean; t: TFunction }) {
  const cell = print ? "py-1 pr-3 border-b border-neutral-300" : "py-2 pr-3 border-b border-line";
  const head = print ? "py-1 pr-3 text-left font-semibold border-b-2 border-neutral-500" : "py-2 pr-3 text-left text-xs font-medium text-ink-3 border-b border-line";
  return (
    <div className="space-y-6">
      {ranking.ranked.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={`${head} w-12`}>{t("adm2.assoc.r.rank")}</th>
                <th className={head}>{t("adm2.common.name")}</th>
                <th className={head}>{t("adm2.assoc.r.club")}</th>
                <th className={`${head} text-right`}>{t("adm2.common.total")}</th>
                <th className={`${head} text-right`}>{t("adm2.assoc.r.zeros")}</th>
                <th className={`${head} text-right`}>{t("adm2.assoc.r.res")}</th>
              </tr>
            </thead>
            <tbody>
              {ranking.ranked.map((e) => (
                <tr key={e.id}>
                  <td className={`${cell} tabular-nums font-semibold`}>{e.rank}</td>
                  <td className={cell}>{e.name}</td>
                  <td className={cell}>{e.clubName}</td>
                  <td className={`${cell} text-right tabular-nums font-semibold`}>{formatTotal(e.total, decimal)}</td>
                  <td className={`${cell} text-right tabular-nums`}>{e.zeros ?? ""}</td>
                  <td className={`${cell} text-right tabular-nums`}>{e.results}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className={print ? "text-sm" : "text-sm text-ink-3"}>{t("adm2.assoc.r.none")}</p>
      )}
      {ranking.anonymous.length ? (
        <div>
          <h3 className={print ? "mb-1 font-semibold" : "mb-1 text-sm font-medium"}>{t("adm2.assoc.r.anon")}</h3>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={head}>{t("adm2.assoc.r.club")}</th>
                <th className={`${head} text-right`}>{t("adm2.assoc.r.shooters")}</th>
                <th className={`${head} text-right`}>{t("adm2.assoc.r.results")}</th>
              </tr>
            </thead>
            <tbody>
              {ranking.anonymous.map((a) => (
                <tr key={a.tenantId}>
                  <td className={cell}>{a.clubName}</td>
                  <td className={`${cell} text-right tabular-nums`}>{a.shooters}</td>
                  <td className={`${cell} text-right tabular-nums`}>{a.results}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className={print ? "mt-1 text-xs" : "mt-1 text-xs text-ink-3"}>{t("adm2.assoc.r.anonText")}</p>
        </div>
      ) : null}
    </div>
  );
}
