import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, ChevronRight, Download } from "lucide-react";
import { Badge, Card, EmptyState, LinkTabs, PageHeader } from "@/components/ui";
import { todayZurich } from "@/lib/time";
import { getRequestLocale, getT } from "@/lib/i18n";
import { requireRangeDuty } from "@/modules/range/guard";
import { listRangeDays } from "@/modules/range/queries";
import { dayTitle, flagsShort, fmtDay } from "@/modules/range/format";
import { countFlags } from "@/modules/range/logic";
import { rangeTabs } from "@/modules/range/nav";
import { RangeTabs } from "@/modules/range/ui/range-tabs";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("shooting.range.tab./range/log") };
}

export default async function RangeLogPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const ctx = await requireRangeDuty();
  const sp = await searchParams;
  const current = Number(todayZurich().slice(0, 4));
  const year = /^\d{4}$/.test(sp.year ?? "") && Number(sp.year) >= 2000 && Number(sp.year) <= current + 1 ? Number(sp.year) : current;
  const days = await listRangeDays(ctx.tenant.id, { year });
  const isManager = ctx.can("range.manage");
  const locale = await getRequestLocale();
  const t = getT(locale);
  const totalVisits = days.reduce((a, d) => a + d.visitCount, 0);
  const years = [current, current - 1, current - 2];
  if (!years.includes(year)) years.push(year);

  return (
    <div className="space-y-4">
      <PageHeader title={t("shooting.range.tab./range/log")} subtitle={t("shooting.log.subtitle", { days: days.length, visits: totalVisits })} />
      <RangeTabs tabs={rangeTabs({ duty: true, manage: isManager })} locale={locale} />
      <LinkTabs active={String(year)} label={t("shooting.log.year")} items={years.map((y) => ({ value: String(y), href: `/range/log?year=${y}`, label: String(y) }))} />
      {isManager ? (
        <div className="flex flex-wrap gap-2">
          <a href={`/api/export/range?year=${year}&kind=days`} className="press inline-flex h-11 items-center gap-1.5 rounded-control border border-line bg-surface px-3 text-sm text-ink-2 hover:text-ink"><Download className="h-4 w-4" aria-hidden /> {t("shooting.log.csvDays")}</a>
          <a href={`/api/export/range?year=${year}&kind=visits`} className="press inline-flex h-11 items-center gap-1.5 rounded-control border border-line bg-surface px-3 text-sm text-ink-2 hover:text-ink"><Download className="h-4 w-4" aria-hidden /> {t("shooting.log.csvVisits")}</a>
        </div>
      ) : null}
      {days.length ? (
        <Card className="animate-rise divide-y divide-line overflow-hidden">
          {days.map((d) => (
            <Link key={d.id} href={`/range/log/${d.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-surface-2">
              <div className="w-14 shrink-0 text-center">
                <div className="text-xs text-ink-3">{fmtDay(d.date, { day: undefined, month: "short", year: undefined, weekday: "short" }, locale)}</div>
                <div className="text-xl font-semibold tabular-nums">{d.date.getUTCDate()}.</div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{dayTitle(d, t)}</div>
                <div className="truncate text-xs text-ink-3">{t("shooting.log.row", { name: d.dutyName ?? "–", n: d.visitCount })}{d.guestCount ? t("shooting.log.guests", { n: d.guestCount }) : ""}</div>
              </div>
              <div className="shrink-0 text-right">
                {d.closedAt ? <span className="font-mono text-sm" aria-label={t("shooting.log.halfDaysAria", { n: countFlags(d) })}>{flagsShort(d, t)}</span> : <Badge tone="accent">{t("shooting.log.open")}</Badge>}
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
            </Link>
          ))}
        </Card>
      ) : (
        <EmptyState icon={<BookOpen className="h-5 w-5" />} title={t("shooting.log.empty.title")} text={t("shooting.log.empty.text", { year })} />
      )}
      <p className="text-xs text-ink-3">{t("shooting.log.legend")}</p>
    </div>
  );
}
