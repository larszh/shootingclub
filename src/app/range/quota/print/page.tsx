import { PrintShell } from "@/components/invoice-document";
import { PrintButton } from "@/components/print-button";
import { todayZurich } from "@/lib/time";
import { requireRangeAdmin } from "@/modules/range/guard";
import { quotaOverview } from "@/modules/range/queries";
import { dayKeyToDbDate, daysForQuota } from "@/modules/range/logic";
import { fmtDay, printedAtLabel } from "@/modules/range/format";
import { CHECK_HINT } from "@/modules/range/types";
import { PrintSheet, PrintTable, SignatureLine } from "@/modules/range/ui/print-sheet";

export const metadata = { title: "Jahresbericht Schiesshalbtage" };

const tick = (b: boolean) => (b ? "✓" : "");

/** Jahresbericht der Schiesshalbtage für die Gemeinde, eine Seite pro Kontingent. ?year=YYYY */
export default async function QuotaPrintPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const ctx = await requireRangeAdmin();
  const sp = await searchParams;
  const current = Number(todayZurich().slice(0, 4));
  const year = /^\d{4}$/.test(sp.year ?? "") && Number(sp.year) >= 2000 && Number(sp.year) <= current + 1 ? Number(sp.year) : current;
  const { rows, days } = await quotaOverview(ctx.tenant.id, year);
  return (
    <PrintShell title={`Jahresbericht Schiesshalbtage ${year}`} subtitle={`${rows.length} ${rows.length === 1 ? "Seite" : "Seiten"} · A4`} action={<PrintButton />}>
      {rows.map((r) => {
        const relevant = daysForQuota(days, r.resourceId);
        const details = new Map<string, { duty: Set<string>; visits: number; places: Set<string> }>();
        for (const d of relevant) {
          const key = d.date.toISOString().slice(0, 10);
          const cur = details.get(key) ?? { duty: new Set<string>(), visits: 0, places: new Set<string>() };
          if (d.dutyName) cur.duty.add(d.dutyName);
          cur.visits += d._count.visits;
          cur.places.add(d.resource?.name ?? "Ganze Anlage");
          details.set(key, cur);
        }
        return (
          <PrintSheet
            key={r.key}
            tenantName={ctx.tenant.name}
            title={`Jahresbericht Schiesshalbtage ${year}`}
            subtitle={r.resourceName}
            footer={<>Erstellt mit Standchef am {printedAtLabel()} aus den abgeschlossenen Standbüchern. {CHECK_HINT}</>}
          >
            <div className="mb-4 grid grid-cols-3 gap-3">
              <div><div className="text-[8pt] uppercase text-neutral-500">Bewilligt</div><div className="text-xl font-semibold">{r.max ?? "–"}</div></div>
              <div><div className="text-[8pt] uppercase text-neutral-500">Benutzt</div><div className="text-xl font-semibold">{r.used}</div></div>
              <div><div className="text-[8pt] uppercase text-neutral-500">Verbleibend</div><div className="text-xl font-semibold">{r.max !== null ? r.max - r.used : "–"}</div></div>
            </div>
            <PrintTable
              head={["Datum", "Vormittag", "Nachmittag", "Abend", "Anlage", "Standdienst", "Besuche"]}
              rows={r.merged.map((d) => {
                const det = details.get(d.dayKey);
                return [
                  fmtDay(dayKeyToDbDate(d.dayKey)),
                  tick(d.usedAm), tick(d.usedPm), tick(d.usedEvening),
                  det ? [...det.places].join(", ") : "",
                  det ? [...det.duty].join(", ") : "",
                  det?.visits ?? "",
                ];
              })}
            />
            {r.merged.length === 0 ? <p className="mt-3 text-neutral-500">Keine Schiesshalbtage erfasst.</p> : null}
            <div className="mt-4 flex justify-end gap-6 text-[9pt]">
              <span>Vormittage: <strong>{r.months.reduce((a, m) => a + m.am, 0)}</strong></span>
              <span>Nachmittage: <strong>{r.months.reduce((a, m) => a + m.pm, 0)}</strong></span>
              <span>Abende: <strong>{r.months.reduce((a, m) => a + m.evening, 0)}</strong></span>
              <span>Total: <strong>{r.used}</strong></span>
            </div>
            <SignatureLine label="Unterschrift Verein" />
          </PrintSheet>
        );
      })}
    </PrintShell>
  );
}
