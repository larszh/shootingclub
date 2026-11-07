import type { Metadata } from "next";
import Link from "next/link";
import { Printer } from "lucide-react";
import { Badge, Card, LinkButton, LinkTabs, PageHeader, ProgressBar } from "@/components/ui";
import { todayZurich } from "@/lib/time";
import { getRequestLocale, getT, type Locale } from "@/lib/i18n";
import { INTL_LOCALE } from "@/lib/i18n/locales";
import { requireRangeDuty } from "@/modules/range/guard";
import { quotaOverview } from "@/modules/range/queries";
import { rangeTabs } from "@/modules/range/nav";
import { RangeTabs } from "@/modules/range/ui/range-tabs";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("shooting.quota.title") };
}

const MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

/** Kurzer Monatsname (1–12); Deutsch wie bisher, sonst per Intl in der Sprache. */
function monthLabel(month: number, locale: Locale) {
  if (locale === "de") return MONTHS[month - 1];
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2000, month - 1, 15)));
}

export default async function RangeQuotaPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const ctx = await requireRangeDuty();
  const sp = await searchParams;
  const current = Number(todayZurich().slice(0, 4));
  const year = /^\d{4}$/.test(sp.year ?? "") && Number(sp.year) >= 2000 && Number(sp.year) <= current + 1 ? Number(sp.year) : current;
  const isManager = ctx.can("range.manage");
  const locale = await getRequestLocale();
  const t = getT(locale);
  const { rows } = await quotaOverview(ctx.tenant.id, year, t("adm2.common.wholeFacility"));

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("shooting.quota.title")}
        subtitle={t("shooting.quota.subtitle", { year })}
        action={isManager ? <LinkButton href={`/range/quota/print?year=${year}`} variant="secondary" size="sm" className="h-11" target="_blank"><Printer className="h-4 w-4" /> {t("shooting.quota.report")}</LinkButton> : undefined}
      />
      <RangeTabs tabs={rangeTabs({ duty: true, manage: isManager })} locale={locale} />
      <LinkTabs active={String(year)} label={t("shooting.log.year")} items={[current, current - 1, current - 2].map((y) => ({ value: String(y), href: `/range/quota?year=${y}`, label: String(y) }))} />

      {rows.map((r) => (
        <Card key={r.key} className="animate-rise space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate font-semibold">{r.resourceName}</h2>
              {r.note ? <p className="text-xs text-ink-3">{r.note}</p> : null}
            </div>
            {r.status ? <Badge tone={r.status.tone === "danger" ? "danger" : r.status.tone === "warn" ? "warn" : "ok"}>{r.status.remaining >= 0 ? t("shooting.quota.remaining", { n: r.status.remaining }) : t("shooting.quota.over", { n: -r.status.remaining })}</Badge> : <Badge tone="outline">{t("shooting.quota.none")}</Badge>}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold tabular-nums">{r.used}</span>
            <span className="text-ink-3">{r.max !== null ? t("shooting.quota.ofMax", { max: r.max }) : t("shooting.quota.used")}</span>
          </div>
          {r.status ? <ProgressBar value={r.used} max={Math.max(1, r.max ?? 1)} label={t("shooting.quota.progress", { name: r.resourceName })} tone={r.status.tone === "ok" ? "ok" : "warn"} /> : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[22rem] text-sm tabular-nums">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-3">
                  <th className="py-1.5 font-medium">{t("shooting.quota.col.month")}</th><th className="py-1.5 text-right font-medium">{t("shooting.quota.col.days")}</th><th className="py-1.5 text-right font-medium">{t("shooting.quota.col.am")}</th><th className="py-1.5 text-right font-medium">{t("shooting.quota.col.pm")}</th><th className="py-1.5 text-right font-medium">{t("shooting.quota.col.evening")}</th><th className="py-1.5 text-right font-medium">{t("shooting.quota.col.total")}</th>
                </tr>
              </thead>
              <tbody>
                {r.months.filter((m) => m.total > 0).map((m) => (
                  <tr key={m.month} className="border-b border-line/60">
                    <td className="py-1.5">{monthLabel(m.month, locale)}</td><td className="py-1.5 text-right">{m.days}</td><td className="py-1.5 text-right">{m.am}</td><td className="py-1.5 text-right">{m.pm}</td><td className="py-1.5 text-right">{m.evening}</td><td className="py-1.5 text-right font-semibold">{m.total}</td>
                  </tr>
                ))}
                {r.months.every((m) => m.total === 0) ? <tr><td colSpan={6} className="py-3 text-center text-ink-3">{t("shooting.quota.empty")}</td></tr> : null}
              </tbody>
            </table>
          </div>
        </Card>
      ))}

      <p className="text-xs text-ink-3">
        {t("shooting.quota.footer")} {t("shooting.officialRulesHint")}
        {isManager ? <>{t("shooting.quota.managerBefore")}<Link href="/admin/range/times" className="underline">{t("shooting.quota.managerLink")}</Link>{t("shooting.quota.managerAfter")}</> : null}
      </p>
    </div>
  );
}
