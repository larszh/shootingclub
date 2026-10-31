import type { Metadata } from "next";
import { Download, Printer } from "lucide-react";
import { Alert, Card, LinkButton, LinkTabs, PageHeader, SectionTitle } from "@/components/ui";
import { todayZurich } from "@/lib/time";
import { requireAmmoAdmin } from "@/modules/ammo/guard";
import { FUNDING, parseSummaryYear, STOCK_CHECK_HINT, type SummaryRow } from "@/modules/ammo/stock";
import { stockYearOverview } from "@/modules/ammo/stock-service";
import { AdminAmmoTabs } from "@/modules/ammo/ui/admin-tabs";

export const metadata: Metadata = { title: "Munition: Jahresübersicht" };

const n = (v: number) => new Intl.NumberFormat("de-CH").format(v);
const COLS: { key: keyof SummaryRow; label: string }[] = [
  { key: "opening", label: "Anfang" },
  { key: "receipt", label: "Eingang" },
  { key: "issue", label: "Abgabe" },
  { key: "sale", label: "Verkauf" },
  { key: "returned", label: "Rückn." },
  { key: "adjust", label: "Korr." },
  { key: "closing", label: "Bestand" },
];

export default async function AmmoYearPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const ctx = await requireAmmoAdmin();
  const sp = await searchParams;
  const current = Number(todayZurich().slice(0, 4));
  const year = parseSummaryYear(sp.year, current);
  const groups = await stockYearOverview(ctx.tenant.id, year);
  const tabs = [current - 2, current - 1, current].map((y) => ({ value: String(y), label: String(y), href: `/admin/ammo/stock/year?year=${y}` }));

  return (
    <div>
      <PageHeader title={`Jahresübersicht ${year}`} subtitle="Eingang, Abgabe, Verkauf und Bestand pro Finanzierungsart" back={{ href: "/admin/ammo/stock", label: "Bestand" }} />
      <AdminAmmoTabs />
      <LinkTabs items={tabs} active={String(year)} label="Jahr wählen" className="mb-3" />
      <div className="mb-4 flex flex-wrap gap-2">
        <LinkButton href={`/admin/ammo/stock/year/print?year=${year}`} target="_blank" variant="secondary"><Printer className="h-4 w-4" /> Drucken</LinkButton>
        <LinkButton href={`/admin/ammo/stock/year/csv?year=${year}`} variant="secondary" prefetch={false}><Download className="h-4 w-4" /> CSV</LinkButton>
      </div>

      {groups.map((g) => (
        <section key={g.fundingType} className="mb-5">
          <SectionTitle>{g.label}</SectionTitle>
          <p className="-mt-1 mb-2 text-xs text-ink-3">{FUNDING[g.fundingType].hint}</p>
          {g.products.length === 0 ? (
            <p className="text-sm text-ink-3">Keine Produkte.</p>
          ) : (
            <Card className="animate-rise overflow-x-auto">
              <table className="w-full min-w-[40rem] text-sm">
                <thead>
                  <tr className="border-b border-line text-xs text-ink-3">
                    <th className="px-3 py-2 text-left font-medium">Produkt</th>
                    {COLS.map((c) => <th key={c.key} className="px-2 py-2 text-right font-medium">{c.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {g.products.map((p) => (
                    <tr key={p.product.id} className="border-b border-line last:border-0">
                      <td className="px-3 py-2">
                        <div className="font-medium">{p.product.name}</div>
                        <div className="text-xs text-ink-3">{p.product.caliber} · {p.product.unitLabel} à {p.product.roundsPerUnit}{p.tracked ? "" : " · Bestand nicht geführt"}</div>
                      </td>
                      {COLS.map((c) => <td key={c.key} className="px-2 py-2 text-right tabular-nums">{n(p[c.key])}</td>)}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-line bg-surface-2 font-semibold">
                    <td className="px-3 py-2">Total Schuss</td>
                    {COLS.map((c) => <td key={c.key} className="px-2 py-2 text-right tabular-nums">{n(g.rounds[c.key])}</td>)}
                  </tr>
                </tfoot>
              </table>
            </Card>
          )}
        </section>
      ))}
      <p className="mb-3 text-xs text-ink-3">Mengen pro Produkt in Verkaufseinheiten, Totale in Schuss. Anfangsbestand = Bestand Ende Jahr minus Bewegungen im Jahr; vor Einführung des Journals vorhandener Bestand erscheint als Anfangsbestand.</p>
      <Alert tone="info">{STOCK_CHECK_HINT} Für die Abrechnung mit der zuständigen Stelle des Bundes gelten deren Formulare und Fristen.</Alert>
    </div>
  );
}
