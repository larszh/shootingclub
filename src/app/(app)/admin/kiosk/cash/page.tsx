import type { Metadata } from "next";
import { Banknote } from "lucide-react";
import { Card, EmptyState, PageHeader, SectionTitle, StatCard } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { requireKioskAdmin } from "@/modules/kiosk/guard";
import { cashSummary } from "@/modules/kiosk/queries";
import { getBillingProfile } from "@/modules/billing/profile";
import { INTL_LOCALE, getRequestLocale, getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = getT(await getRequestLocale());
  return { title: `${t("adm1.home.kiosk")}: ${t("adm1.kiosk.tab.cash")}` };
}

/** Tagesabschluss: Barverkäufe der letzten 14 Tage pro Tag und Produkt. */
export default async function KioskCashPage() {
  const ctx = await requireKioskAdmin();
  const locale = await getRequestLocale();
  const t = getT(locale);
  const dayFmt = new Intl.DateTimeFormat(INTL_LOCALE[locale], { timeZone: "UTC", weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
  const dayLabel = (day: string) => dayFmt.format(new Date(`${day}T12:00:00Z`));
  const entries = (n: number) => t(n === 1 ? "adm1.kiosk.entries.one" : "adm1.kiosk.entries.other", { n });
  const [{ today, days }, profile] = await Promise.all([cashSummary(ctx.tenant.id, 14), getBillingProfile(ctx.tenant.id, ctx.tenant.name)]);
  const cur = profile.currency;
  const todayRow = days.find((d) => d.day === today);
  const sum14 = days.reduce((s, d) => s + d.totalCents, 0);

  return (
    <div>
      <PageHeader title={t("adm1.kiosk.tab.cash")} subtitle={t("adm1.kiosk.cashSubtitle")} back={{ href: "/admin/kiosk", label: t("adm1.home.kiosk") }} />
      <div className="mb-4 grid grid-cols-2 gap-3">
        <StatCard label={t("adm1.kiosk.cashTodayShort")} value={formatMoney(todayRow?.totalCents ?? 0, cur)} hint={entries(todayRow?.count ?? 0)} tone={todayRow ? "accent" : "neutral"} />
        <StatCard label={t("adm1.kiosk.last14")} value={formatMoney(sum14, cur)} hint={t("adm1.kiosk.daysWithCash", { n: days.length })} />
      </div>
      {days.length ? days.map((d) => (
        <section key={d.day}>
          <SectionTitle>{d.day === today ? t("adm1.kiosk.todayLabel", { date: dayLabel(d.day) }) : dayLabel(d.day)}</SectionTitle>
          <Card className="animate-rise mb-2 divide-y divide-line overflow-hidden">
            {d.products.map((p) => (
              <div key={p.name} className="flex min-h-11 items-center gap-3 px-4 py-2">
                <span className="min-w-0 flex-1 truncate"><span className="tabular-nums">{p.quantity} ×</span> {p.name}</span>
                <span className="shrink-0 tabular-nums">{formatMoney(p.totalCents, cur)}</span>
              </div>
            ))}
            <div className="flex min-h-12 items-center justify-between bg-surface-2 px-4 py-2 font-semibold">
              <span>{t("adm1.kiosk.totalCash", { entries: entries(d.count) })}</span>
              <span className="tabular-nums">{formatMoney(d.totalCents, cur)}</span>
            </div>
          </Card>
        </section>
      )) : <EmptyState icon={<Banknote className="h-5 w-5" />} title={t("adm1.kiosk.noCash")} text={t("adm1.kiosk.noCashText")} />}
      <p className="mt-3 text-xs text-ink-3">{t("adm1.kiosk.cashNote")}</p>
    </div>
  );
}
