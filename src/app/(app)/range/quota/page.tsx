import type { Metadata } from "next";
import Link from "next/link";
import { Printer } from "lucide-react";
import { Badge, Card, LinkButton, LinkTabs, PageHeader, ProgressBar } from "@/components/ui";
import { todayZurich } from "@/lib/time";
import { requireRangeDuty } from "@/modules/range/guard";
import { quotaOverview } from "@/modules/range/queries";
import { CHECK_HINT } from "@/modules/range/types";
import { rangeTabs } from "@/modules/range/nav";
import { RangeTabs } from "@/modules/range/ui/range-tabs";

export const metadata: Metadata = { title: "Schiesshalbtage" };

const MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

export default async function RangeQuotaPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const ctx = await requireRangeDuty();
  const sp = await searchParams;
  const current = Number(todayZurich().slice(0, 4));
  const year = /^\d{4}$/.test(sp.year ?? "") && Number(sp.year) >= 2000 && Number(sp.year) <= current + 1 ? Number(sp.year) : current;
  const { rows } = await quotaOverview(ctx.tenant.id, year);
  const isManager = ctx.can("range.manage");

  return (
    <div className="space-y-4">
      <PageHeader
        title="Schiesshalbtage"
        subtitle={`Kontingent ${year}`}
        action={isManager ? <LinkButton href={`/range/quota/print?year=${year}`} variant="secondary" size="sm" className="h-11" target="_blank"><Printer className="h-4 w-4" /> Jahresbericht</LinkButton> : undefined}
      />
      <RangeTabs tabs={rangeTabs({ duty: true, manage: isManager })} />
      <LinkTabs active={String(year)} label="Jahr wählen" items={[current, current - 1, current - 2].map((y) => ({ value: String(y), href: `/range/quota?year=${y}`, label: String(y) }))} />

      {rows.map((r) => (
        <Card key={r.key} className="animate-rise space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate font-semibold">{r.resourceName}</h2>
              {r.note ? <p className="text-xs text-ink-3">{r.note}</p> : null}
            </div>
            {r.status ? <Badge tone={r.status.tone === "danger" ? "danger" : r.status.tone === "warn" ? "warn" : "ok"}>{r.status.remaining >= 0 ? `${r.status.remaining} übrig` : `${-r.status.remaining} zu viel`}</Badge> : <Badge tone="outline">kein Kontingent</Badge>}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold tabular-nums">{r.used}</span>
            <span className="text-ink-3">{r.max !== null ? `von ${r.max} Halbtagen` : "Halbtage benutzt"}</span>
          </div>
          {r.status ? <ProgressBar value={r.used} max={Math.max(1, r.max ?? 1)} label={`${r.resourceName}: Halbtage`} tone={r.status.tone === "ok" ? "ok" : "warn"} /> : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[22rem] text-sm tabular-nums">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-3">
                  <th className="py-1.5 font-medium">Monat</th><th className="py-1.5 text-right font-medium">Tage</th><th className="py-1.5 text-right font-medium">Vorm.</th><th className="py-1.5 text-right font-medium">Nachm.</th><th className="py-1.5 text-right font-medium">Abend</th><th className="py-1.5 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {r.months.filter((m) => m.total > 0).map((m) => (
                  <tr key={m.month} className="border-b border-line/60">
                    <td className="py-1.5">{MONTHS[m.month - 1]}</td><td className="py-1.5 text-right">{m.days}</td><td className="py-1.5 text-right">{m.am}</td><td className="py-1.5 text-right">{m.pm}</td><td className="py-1.5 text-right">{m.evening}</td><td className="py-1.5 text-right font-semibold">{m.total}</td>
                  </tr>
                ))}
                {r.months.every((m) => m.total === 0) ? <tr><td colSpan={6} className="py-3 text-center text-ink-3">Noch keine abgeschlossenen Schiesstage.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </Card>
      ))}

      <p className="text-xs text-ink-3">
        Gezählt werden abgeschlossene Standbücher; mehrere Standbücher am selben Tag zählen pro Halbtag nur einmal. Tage der ganzen Anlage zählen für jede Anlage mit. {CHECK_HINT}
        {isManager ? <> Kontingente unter <Link href="/admin/range/times" className="underline">Schiesszeiten</Link> erfassen.</> : null}
      </p>
    </div>
  );
}
