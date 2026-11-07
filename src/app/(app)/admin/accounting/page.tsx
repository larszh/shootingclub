import type { Metadata } from "next";
import { BookOpenCheck, Download, Info } from "lucide-react";
import { requirePermission } from "@/lib/tenant";
import { todayZurich } from "@/lib/time";
import { formatMoney } from "@/lib/money";
import { formatDate, getRequestLocale, getT, type TFunction } from "@/lib/i18n";
import { Alert, Button, buttonClasses, Card, EmptyState, Field, Input, LinkTabs, PageHeader, SectionTitle, Select, StatCard } from "@/components/ui";
import { getAccountingJournal } from "@/modules/accounting/queries";
import type { AccountSummary } from "@/modules/accounting/journal";
import { includeKioskCashParam, resolvePeriod, type Period, type PeriodKind, type PeriodParams } from "@/modules/accounting/period";
import { ACCOUNT_FIELDS, EXPORT_FORMATS } from "@/modules/accounting/types";
import { AccountingSettingsForm } from "@/modules/accounting/ui/settings-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("adm1.home.accounting") };
}

const PREVIEW_LIMIT = 200;

/** Deutsche Kontobezeichnung (aus der Saldoliste) → Feldschlüssel für die Übersetzung. */
const ACCOUNT_KEY_BY_LABEL = new Map(ACCOUNT_FIELDS.map((f) => [f.label, f.key]));

const PERIOD_TABS: PeriodKind[] = ["year", "quarter", "month", "custom"];

/** «YYYY-MM-DD» in der Anzeigesprache. */
function isoDay(s: string, locale: string) {
  return formatDate(new Date(`${s}T12:00:00Z`), locale);
}

function monthName(month: number, locale: string) {
  return formatDate(new Date(Date.UTC(2000, month - 1, 15, 12)), locale, { day: undefined, year: undefined, month: "long" });
}

/** Bezeichnung der Periode (die gespeicherte deutsche Bezeichnung dient nur dem Protokoll). */
function periodLabel(t: TFunction, p: Period, locale: string) {
  if (p.kind === "quarter") return t("adm1.acc.periodQuarter", { q: p.quarter, year: p.year });
  if (p.kind === "month") return `${monthName(p.month, locale)} ${p.year}`;
  if (p.kind === "custom") return `${isoDay(p.from, locale)} – ${isoDay(p.to, locale)}`;
  return t("adm1.acc.periodYear", { year: p.year });
}

function periodHref(kind: PeriodKind, year: number, extra: Record<string, string> = {}) {
  const p = new URLSearchParams({ period: kind, year: String(year), ...extra });
  return `/admin/accounting?${p.toString()}`;
}

function balanceText(t: TFunction, s: AccountSummary) {
  if (s.balanceCents === 0) return { text: formatMoney(0, s.currency), side: t("adm1.acc.balanced") };
  return s.balanceCents > 0
    ? { text: formatMoney(s.balanceCents, s.currency), side: t("adm1.acc.debitBalance") }
    : { text: formatMoney(-s.balanceCents, s.currency), side: t("adm1.acc.creditBalance") };
}

export default async function AccountingPage({ searchParams }: { searchParams: Promise<PeriodParams> }) {
  const ctx = await requirePermission("accounting.export");
  const sp = await searchParams;
  const locale = await getRequestLocale();
  const t = getT(locale);
  const today = todayZurich();
  const period = resolvePeriod(sp, today);
  const includeKioskCash = includeKioskCashParam(sp.kioskCash);
  const { accounts, entries, summary, totals } = await getAccountingJournal(ctx.tenant.id, period.from, period.to, { includeKioskCash });

  const currentYear = Number(today.slice(0, 4));
  const years = Array.from({ length: 7 }, (_, i) => currentYear + 1 - i);
  const exportQuery = (format: string) => `/api/export/accounting?${new URLSearchParams({ format, from: period.from, to: period.to, ...(includeKioskCash ? {} : { kioskCash: "0" }) }).toString()}`;
  const preview = entries.slice(0, PREVIEW_LIMIT);
  const invalidCustom = period.kind === "custom" && (sp.from || sp.to) && (period.from !== sp.from || period.to !== sp.to);
  const periodEnded = period.to < today;
  const label = periodLabel(t, period, locale);

  return (
    <div>
      <PageHeader title={t("adm1.home.accounting")} subtitle={t("adm1.acc.subtitle")} back={{ href: "/admin", label: t("adm1.home.title") }} />

      <SectionTitle>{t("adm1.acc.period")}</SectionTitle>
      <LinkTabs
        label={t("adm1.acc.choosePeriod")}
        active={period.kind}
        items={PERIOD_TABS.map((kind) => ({
          value: kind,
          label: t(`adm1.acc.tab.${kind}`),
          href: kind === "custom" ? periodHref("custom", period.year, { from: period.from, to: period.to }) : periodHref(kind, period.year, kind === "quarter" ? { q: String(period.quarter) } : kind === "month" ? { m: String(period.month) } : {}),
        }))}
      />
      <Card className="animate-rise mt-3 p-4">
        <form method="get" action="/admin/accounting" className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="period" value={period.kind} />
          {period.kind !== "custom" ? (
            <Field label={t("adm1.common.year")} className="w-28">
              <Select name="year" defaultValue={String(period.year)}>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </Select>
            </Field>
          ) : null}
          {period.kind === "quarter" ? (
            <Field label={t("adm1.acc.tab.quarter")} className="w-36">
              <Select name="q" defaultValue={String(period.quarter)}>
                {[1, 2, 3, 4].map((q) => <option key={q} value={q}>{t("adm1.acc.quarterN", { q })}</option>)}
              </Select>
            </Field>
          ) : null}
          {period.kind === "month" ? (
            <Field label={t("adm1.acc.tab.month")} className="w-40">
              <Select name="m" defaultValue={String(period.month)}>
                {Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{monthName(i + 1, locale)}</option>)}
              </Select>
            </Field>
          ) : null}
          {period.kind === "custom" ? (
            <>
              <Field label={t("adm1.acc.from")} className="min-w-40 flex-1"><Input type="date" name="from" defaultValue={period.from} required /></Field>
              <Field label={t("adm1.acc.to")} className="min-w-40 flex-1"><Input type="date" name="to" defaultValue={period.to} required /></Field>
            </>
          ) : null}
          <Field label={t("adm1.acc.kioskCash")} className="min-w-48">
            <Select name="kioskCash" defaultValue={includeKioskCash ? "1" : "0"}>
              <option value="1">{t("adm1.acc.kioskCashBook")}</option>
              <option value="0">{t("adm1.acc.kioskCashSkip")}</option>
            </Select>
          </Field>
          <Button type="submit" variant="secondary">{t("adm1.acc.show")}</Button>
        </form>
        <p className="mt-3 text-sm text-ink-2">
          <span className="font-medium text-ink">{label}</span> · {t("adm1.acc.range", { from: isoDay(period.from, locale), to: isoDay(period.to, locale) })}
        </p>
        {invalidCustom ? <Alert tone="warn" className="mt-3">{t("adm1.acc.invalidRange")}</Alert> : null}
      </Card>

      <div className="stagger mt-3 grid grid-cols-2 gap-2.5">
        <StatCard label={t("adm1.acc.entries")} value={entries.length} hint={label} />
        <StatCard
          label={t("adm1.acc.checksum")}
          value={<span className="block text-xl break-words">{totals.length ? totals.map((x) => formatMoney(x.cents, x.currency)).join(" · ") : formatMoney(0)}</span>}
          hint={t("adm1.acc.checksumHint")}
        />
      </div>

      <SectionTitle>{t("adm1.acc.export")}</SectionTitle>
      {!periodEnded ? (
        <Alert tone="info" className="mb-2.5" icon={<Info className="h-4 w-4" />}>
          {t("adm1.acc.notEnded")}
        </Alert>
      ) : null}
      <Card className="animate-rise divide-y divide-line overflow-hidden">
        {EXPORT_FORMATS.map((f) => (
          <div key={f.key} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <div className="font-medium">{t(`adm1.acc.format.${f.key}.label`)}</div>
              <p className="mt-0.5 text-xs text-ink-3">{t(`adm1.acc.format.${f.key}.hint`)}</p>
            </div>
            {/* Einfacher Link statt next/link: der Router würde die Export-Route zuerst als RSC abrufen (doppelter Export im Protokoll). */}
            <a href={exportQuery(f.key)} download className={buttonClasses("secondary", "md", "shrink-0")}>
              <Download className="h-4 w-4" aria-hidden /> .{f.extension}
            </a>
          </div>
        ))}
      </Card>
      <p className="mt-2 text-xs text-ink-3">
        {t("adm1.acc.journalNote")}
      </p>

      {entries.length === 0 ? (
        <EmptyState
          className="mt-6"
          icon={<BookOpenCheck className="h-5 w-5" />}
          title={t("adm1.acc.emptyTitle")}
          text={t("adm1.acc.emptyText")}
        />
      ) : (
        <>
          <SectionTitle>{t("adm1.acc.balancePerAccount")}</SectionTitle>
          <Card className="animate-rise divide-y divide-line overflow-hidden">
            {summary.map((s) => {
              const b = balanceText(t, s);
              return (
                <div key={`${s.account}-${s.currency}`} className="flex min-h-14 items-center gap-3 px-4 py-3">
                  <span className="w-14 shrink-0 font-mono text-sm font-semibold">{s.account}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{s.names.length ? s.names.map((n) => (ACCOUNT_KEY_BY_LABEL.has(n) ? t(`adm1.acc.field.${ACCOUNT_KEY_BY_LABEL.get(n)}.label`) : n)).join(" / ") : t("adm1.acc.notInPlan")}</div>
                    <div className="text-xs text-ink-3 tabular-nums">{t("adm1.acc.debit")} {formatMoney(s.debitCents, s.currency)} · {t("adm1.acc.credit")} {formatMoney(s.creditCents, s.currency)}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-semibold tabular-nums">{b.text}</div>
                    <div className="text-xs text-ink-3">{b.side}</div>
                  </div>
                </div>
              );
            })}
          </Card>

          <SectionTitle>{t("adm1.acc.journal")}</SectionTitle>
          <Card className="animate-rise divide-y divide-line overflow-hidden">
            <div className="hidden grid-cols-[88px_110px_1fr_60px_60px_110px] gap-3 bg-surface-2 px-4 py-2 text-xs font-semibold text-ink-3 md:grid">
              <span>{t("adm1.common.date")}</span><span>{t("adm1.acc.doc")}</span><span>{t("adm1.acc.text")}</span><span>{t("adm1.acc.debit")}</span><span>{t("adm1.acc.credit")}</span><span className="text-right">{t("adm1.common.amount")}</span>
            </div>
            {preview.map((e, i) => (
              <div key={`${e.docId}-${e.type}-${i}`} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 px-4 py-3 text-sm md:grid-cols-[88px_110px_1fr_60px_60px_110px] md:items-center">
                <span className="text-xs text-ink-3 tabular-nums md:text-sm md:text-ink-2">{isoDay(e.date, locale)} <span className="md:hidden">· {e.doc}</span></span>
                <span className="text-right font-semibold tabular-nums md:order-last">{formatMoney(e.amountCents, e.currency)}</span>
                <span className="hidden truncate font-mono text-xs md:block">{e.doc}</span>
                <span className="col-span-2 min-w-0 md:col-span-1">
                  <span className="block truncate">{e.text}</span>
                  <span className="text-xs text-ink-3">{t(`adm1.acc.kind.${e.kind}`)} · {t(`adm1.acc.type.${e.type}`)}</span>
                </span>
                <span className="col-span-2 font-mono text-xs text-ink-2 md:col-span-1 md:text-sm">
                  <span className="md:hidden">{t("adm1.acc.debit")} </span>{e.debit}
                  <span className="md:hidden"> / {t("adm1.acc.credit")} {e.credit}</span>
                </span>
                <span className="hidden font-mono text-sm text-ink-2 md:block">{e.credit}</span>
              </div>
            ))}
          </Card>
          {entries.length > PREVIEW_LIMIT ? (
            <p className="mt-2 text-xs text-ink-3">{t("adm1.acc.previewLimit", { limit: PREVIEW_LIMIT, n: entries.length })}</p>
          ) : null}
        </>
      )}

      <SectionTitle>{t("adm1.acc.plan")}</SectionTitle>
      <AccountingSettingsForm accounts={accounts} />
      <Card className="animate-rise mt-2.5 space-y-2 p-4 text-sm">
        <div className="flex items-center gap-2 font-semibold"><Info className="h-4 w-4 text-ink-2" aria-hidden /> {t("adm1.acc.howTitle")}</div>
        <ul className="list-disc space-y-1 pl-5 text-ink-2">
          <li>{t("adm1.acc.how.issue", { receivable: accounts.receivableAccount, fee: accounts.feeAccount, workFee: accounts.workFeeAccount, booking: accounts.bookingAccount, ammo: accounts.ammoAccount })}</li>
          <li>{t("adm1.acc.how.paid", { bank: accounts.bankAccount })}</li>
          <li>{t("adm1.acc.how.cancelled")}</li>
          <li>{t("adm1.acc.how.double")}</li>
          <li>{t("adm1.acc.how.refund")}</li>
          <li>{t("adm1.acc.how.bookingOnline")}</li>
          <li>{t("adm1.acc.how.bookingCash", { cash: accounts.cashAccount, booking: accounts.bookingAccount })}</li>
          <li>{t("adm1.acc.how.kiosk", { kiosk: accounts.kioskAccount })}</li>
          <li>{t("adm1.acc.how.kioskCash", { cash: accounts.cashAccount, kiosk: accounts.kioskAccount })}</li>
          <li>{t("adm1.acc.how.dates")}</li>
          <li>{t("adm1.acc.how.fees", { feesExpense: accounts.feesExpenseAccount, bank: accounts.bankAccount })}</li>
          <li>{t("adm1.acc.how.ammo")}</li>
        </ul>
      </Card>
    </div>
  );
}
