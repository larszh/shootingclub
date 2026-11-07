import { PrintShell } from "@/components/invoice-document";
import { PrintButton } from "@/components/print-button";
import { todayZurich } from "@/lib/time";
import { requireRangeAdmin } from "@/modules/range/guard";
import { quotaOverview } from "@/modules/range/queries";
import { dayKeyToDbDate, daysForQuota } from "@/modules/range/logic";
import { fmtDay, printedAtLabel } from "@/modules/range/format";
import { getRequestLocale, getT } from "@/lib/i18n";
import { PrintSheet, PrintTable, SignatureLine } from "@/modules/range/ui/print-sheet";

export async function generateMetadata() {
  const t = getT(await getRequestLocale());
  return { title: t("adm2.range.quotaPrint.metaTitle") };
}

const tick = (b: boolean) => (b ? "✓" : "");

/** Jahresbericht der Schiesshalbtage für die Gemeinde, eine Seite pro Kontingent. ?year=YYYY */
export default async function QuotaPrintPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const ctx = await requireRangeAdmin();
  const locale = await getRequestLocale();
  const t = getT(locale);
  const sp = await searchParams;
  const current = Number(todayZurich().slice(0, 4));
  const year = /^\d{4}$/.test(sp.year ?? "") && Number(sp.year) >= 2000 && Number(sp.year) <= current + 1 ? Number(sp.year) : current;
  const { rows, days } = await quotaOverview(ctx.tenant.id, year, t("adm2.common.wholeFacility"));
  return (
    <PrintShell title={t("adm2.range.quotaPrint.title", { year })} subtitle={`${t(rows.length === 1 ? "adm2.common.pages.one" : "adm2.common.pages.other", { n: rows.length })} · A4`} action={<PrintButton />}>
      {rows.map((r) => {
        const relevant = daysForQuota(days, r.resourceId);
        const details = new Map<string, { duty: Set<string>; visits: number; places: Set<string> }>();
        for (const d of relevant) {
          const key = d.date.toISOString().slice(0, 10);
          const cur = details.get(key) ?? { duty: new Set<string>(), visits: 0, places: new Set<string>() };
          if (d.dutyName) cur.duty.add(d.dutyName);
          cur.visits += d._count.visits;
          cur.places.add(d.resource?.name ?? t("adm2.common.wholeFacility"));
          details.set(key, cur);
        }
        return (
          <PrintSheet
            key={r.key}
            tenantName={ctx.tenant.name}
            title={t("adm2.range.quotaPrint.title", { year })}
            subtitle={r.resourceName}
            footer={<>{t("adm2.range.quotaPrint.footer", { date: printedAtLabel(locale) })} {t("adm2.common.checkHint")}</>}
          >
            <div className="mb-4 grid grid-cols-3 gap-3">
              <div><div className="text-[8pt] uppercase text-neutral-500">{t("adm2.range.quotaPrint.approved")}</div><div className="text-xl font-semibold">{r.max ?? "–"}</div></div>
              <div><div className="text-[8pt] uppercase text-neutral-500">{t("adm2.range.quotaPrint.used")}</div><div className="text-xl font-semibold">{r.used}</div></div>
              <div><div className="text-[8pt] uppercase text-neutral-500">{t("adm2.range.quotaPrint.remaining")}</div><div className="text-xl font-semibold">{r.max !== null ? r.max - r.used : "–"}</div></div>
            </div>
            <PrintTable
              head={[t("adm2.common.date"), t("shooting.log.flag.am"), t("shooting.log.flag.pm"), t("shooting.log.flag.evening"), t("adm2.range.quotaPrint.facility"), t("adm2.range.dayPrint.duty"), t("adm2.range.dayPrint.visits")]}
              rows={r.merged.map((d) => {
                const det = details.get(d.dayKey);
                return [
                  fmtDay(dayKeyToDbDate(d.dayKey), undefined, locale),
                  tick(d.usedAm), tick(d.usedPm), tick(d.usedEvening),
                  det ? [...det.places].join(", ") : "",
                  det ? [...det.duty].join(", ") : "",
                  det?.visits ?? "",
                ];
              })}
            />
            {r.merged.length === 0 ? <p className="mt-3 text-neutral-500">{t("adm2.range.quotaPrint.none")}</p> : null}
            <div className="mt-4 flex justify-end gap-6 text-[9pt]">
              <span>{t("adm2.range.quotaPrint.ams")} <strong>{r.months.reduce((a, m) => a + m.am, 0)}</strong></span>
              <span>{t("adm2.range.quotaPrint.pms")} <strong>{r.months.reduce((a, m) => a + m.pm, 0)}</strong></span>
              <span>{t("adm2.range.quotaPrint.evenings")} <strong>{r.months.reduce((a, m) => a + m.evening, 0)}</strong></span>
              <span>{t("adm2.range.quotaPrint.total")} <strong>{r.used}</strong></span>
            </div>
            <SignatureLine label={t("adm2.range.quotaPrint.signature")} placeLabel={t("adm2.common.placeDate")} />
          </PrintSheet>
        );
      })}
    </PrintShell>
  );
}
