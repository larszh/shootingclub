/**
 * Verbrauchstabellen (Server- oder Client-Komponente, ohne Zustand).
 */
import { Card } from "@/components/ui";
import { INTL_LOCALE, normalizeLocale } from "@/lib/i18n/core";
import { aiT } from "../../settings/i18n";
import { fmtChf, fmtInt } from "../../settings/format";
import type { UsageTable, UsageTableRow } from "../logic";

/** «November 2026» in der Sprache der Seite. */
export function monthLabel(key: string, locale: string | null | undefined): string {
  const d = new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 15));
  const s = new Intl.DateTimeFormat(INTL_LOCALE[normalizeLocale(locale)], { month: "long", year: "numeric", timeZone: "UTC" }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function UsageTableCard({
  table, firstColumn, labels, locale, emptyText,
}: { table: UsageTable; firstColumn: string; labels: Record<string, string>; locale: string; emptyText?: string }) {
  const t = aiT(locale);
  if (!table.rows.length || table.total.requests === 0) {
    return <Card className="animate-rise p-4 text-sm text-ink-3">{emptyText ?? t("aiSet.usage.empty")}</Card>;
  }
  const cell = "px-3 py-2.5 text-right tabular-nums";
  const row = (r: UsageTableRow, strong = false) => (
    <tr key={r.key} className={strong ? "font-semibold" : undefined}>
      <th scope="row" className="px-3 py-2.5 text-left font-medium">{strong ? t("aiSet.usage.total") : (labels[r.key] ?? r.key)}</th>
      <td className={cell}>{fmtInt(r.requests, locale)}</td>
      <td className={`${cell} ${r.failed ? "text-danger" : "text-ink-3"}`}>{fmtInt(r.failed, locale)}</td>
      <td className={cell}>{fmtInt(r.tokens, locale)}</td>
      <td className={`${cell} text-ink-2`}>{fmtChf(r.chf, locale)}</td>
    </tr>
  );
  return (
    <Card className="animate-rise overflow-x-auto">
      <table className="w-full min-w-[30rem] text-sm">
        <thead className="text-xs text-ink-3">
          <tr className="border-b border-line">
            <th scope="col" className="px-3 py-2 text-left font-medium">{firstColumn}</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">{t("aiSet.usage.requests")}</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">{t("aiSet.usage.failed")}</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">{t("aiSet.usage.tokens")}</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">{t("aiSet.usage.chf")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{table.rows.map((r) => row(r))}</tbody>
        <tfoot className="border-t border-line">{row(table.total, true)}</tfoot>
      </table>
    </Card>
  );
}
