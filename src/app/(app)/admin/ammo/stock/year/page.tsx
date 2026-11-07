import type { Metadata } from "next";
import { Download, Printer } from "lucide-react";
import { Alert, Card, LinkButton, LinkTabs, PageHeader, SectionTitle } from "@/components/ui";
import { todayZurich } from "@/lib/time";
import { requireAmmoAdmin } from "@/modules/ammo/guard";
import { parseSummaryYear, type SummaryRow } from "@/modules/ammo/stock";
import { fundingLabelT, numT } from "@/modules/ammo/ui/labels";
import { getRequestLocale, getT } from "@/lib/i18n";
import { stockYearOverview } from "@/modules/ammo/stock-service";
import { AdminAmmoTabs } from "@/modules/ammo/ui/admin-tabs";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("adm1.ammo.meta.year") };
}

const COLS: (keyof SummaryRow)[] = ["opening", "receipt", "issue", "sale", "returned", "adjust", "closing"];

export default async function AmmoYearPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const ctx = await requireAmmoAdmin();
  const sp = await searchParams;
  const locale = await getRequestLocale();
  const t = getT(locale);
  const n = (v: number) => numT(v, locale);
  const current = Number(todayZurich().slice(0, 4));
  const year = parseSummaryYear(sp.year, current);
  const groups = await stockYearOverview(ctx.tenant.id, year);
  const tabs = [current - 2, current - 1, current].map((y) => ({ value: String(y), label: String(y), href: `/admin/ammo/stock/year?year=${y}` }));

  return (
    <div>
      <PageHeader title={t("adm1.ammo.year.titleYear", { year })} subtitle={t("adm1.ammo.year.subtitle")} back={{ href: "/admin/ammo/stock", label: t("adm1.ammo.tab.stock") }} />
      <AdminAmmoTabs />
      <LinkTabs items={tabs} active={String(year)} label={t("adm1.ammo.year.choose")} className="mb-3" />
      <div className="mb-4 flex flex-wrap gap-2">
        <LinkButton href={`/admin/ammo/stock/year/print?year=${year}`} target="_blank" variant="secondary"><Printer className="h-4 w-4" /> {t("adm1.ammo.order.print")}</LinkButton>
        <LinkButton href={`/admin/ammo/stock/year/csv?year=${year}`} variant="secondary" prefetch={false}><Download className="h-4 w-4" /> CSV</LinkButton>
      </div>

      {groups.map((g) => (
        <section key={g.fundingType} className="mb-5">
          <SectionTitle>{fundingLabelT(g.fundingType, t)}</SectionTitle>
          <p className="-mt-1 mb-2 text-xs text-ink-3">{t(`adm1.ammo.fundingHint.${g.fundingType}`)}</p>
          {g.products.length === 0 ? (
            <p className="text-sm text-ink-3">{t("adm1.ammo.year.noProducts")}</p>
          ) : (
            <Card className="animate-rise overflow-x-auto">
              <table className="w-full min-w-[40rem] text-sm">
                <thead>
                  <tr className="border-b border-line text-xs text-ink-3">
                    <th className="px-3 py-2 text-left font-medium">{t("adm1.ammo.product")}</th>
                    {COLS.map((c) => <th key={c} className="px-2 py-2 text-right font-medium">{t(`adm1.ammo.year.col.${c}`)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {g.products.map((p) => (
                    <tr key={p.product.id} className="border-b border-line last:border-0">
                      <td className="px-3 py-2">
                        <div className="font-medium">{p.product.name}</div>
                        <div className="text-xs text-ink-3">{p.product.caliber} · {t("adm1.ammo.year.unitOf", { unit: p.product.unitLabel, n: p.product.roundsPerUnit })}{p.tracked ? "" : ` · ${t("adm1.ammo.prod.notTracked")}`}</div>
                      </td>
                      {COLS.map((c) => <td key={c} className="px-2 py-2 text-right tabular-nums">{n(p[c])}</td>)}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-line bg-surface-2 font-semibold">
                    <td className="px-3 py-2">{t("adm1.ammo.year.totalRounds")}</td>
                    {COLS.map((c) => <td key={c} className="px-2 py-2 text-right tabular-nums">{n(g.rounds[c])}</td>)}
                  </tr>
                </tfoot>
              </table>
            </Card>
          )}
        </section>
      ))}
      <p className="mb-3 text-xs text-ink-3">{t("adm1.ammo.year.note")}</p>
      <Alert tone="info">{t("adm1.ammo.stockCheckHint")} {t("adm1.ammo.year.federalNote")}</Alert>
    </div>
  );
}
