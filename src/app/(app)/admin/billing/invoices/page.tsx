import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";
import { requireBillingAdmin } from "@/modules/billing/guard";
import { EmptyState, PageHeader, StatCard } from "@/components/ui";
import { AdminBillingTabs } from "@/modules/billing/ui/admin-tabs";
import { YearSelect } from "@/modules/billing/ui/year-select";
import { currentYear, listStandaloneInvoices, standaloneInvoiceYears } from "@/modules/billing/queries";
import { matchesStandaloneFilter, parseStandaloneFilter, type StandaloneStatusFilter } from "@/modules/billing/standalone-hints";
import { StandaloneInvoiceList } from "@/modules/billing/ui/standalone-invoice-list";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { getRequestLocale, getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("adm1.bill.tab.invoices") };
}

const FILTERS: StandaloneStatusFilter[] = ["all", "open", "paid", "cancelled", "attention"];

/**
 * Einzelrechnungen ohne Jahreslauf (Schützenstube, Ersatzabgabe): stornieren, als bezahlt markieren,
 * QR-Rechnung drucken. Zeigt Zahlungsnotiz und Hinweise zu Rückerstattungen.
 */
export default async function StandaloneInvoicesPage({ searchParams }: { searchParams: Promise<{ year?: string; f?: string }> }) {
  const ctx = await requireBillingAdmin();
  const t = getT(await getRequestLocale());
  const sp = await searchParams;
  const rawYear = Number(sp.year);
  const year = Number.isInteger(rawYear) && rawYear >= 2000 && rawYear <= 2100 ? rawYear : currentYear();
  const filter = parseStandaloneFilter(sp.f);
  const [all, knownYears] = await Promise.all([listStandaloneInvoices(ctx.tenant.id, year), standaloneInvoiceYears(ctx.tenant.id)]);
  const list = all.filter((i) => matchesStandaloneFilter(filter, i));
  const count = (f: StandaloneStatusFilter) => all.filter((i) => matchesStandaloneFilter(f, i)).length;
  const currency = all[0]?.currency ?? "CHF";
  const open = all.filter((i) => i.status === "OPEN");
  const paid = all.filter((i) => i.status === "PAID");
  const years = [...new Set([currentYear(), year, ...knownYears])].sort((a, b) => b - a);
  const href = (f: StandaloneStatusFilter) => `/admin/billing/invoices?${new URLSearchParams({ year: String(year), ...(f !== "all" ? { f } : {}) }).toString()}`;

  return (
    <div>
      <PageHeader title={t("adm1.bill.tab.invoices")} subtitle={t("adm1.bill.standaloneSubtitle")} back={{ href: "/admin/billing", label: t("adm1.module.billing.name") }}
        action={<YearSelect year={year} years={years} />} />
      <AdminBillingTabs />

      <div className="stagger mb-4 grid grid-cols-2 gap-2.5">
        <StatCard label={t("money.status.OPEN")} value={formatMoney(open.reduce((s, i) => s + i.amountCents, 0), currency)} hint={t(open.length === 1 ? "money.payments.invoices.one" : "money.payments.invoices.other", { n: open.length })} tone={open.length ? "warn" : "neutral"} />
        <StatCard label={t("money.status.PAID")} value={formatMoney(paid.reduce((s, i) => s + i.amountCents, 0), currency)} hint={t(paid.length === 1 ? "money.payments.invoices.one" : "money.payments.invoices.other", { n: paid.length })} />
      </div>

      <div className="animate-fade -mx-4 mb-2 flex gap-1.5 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
        {FILTERS.map((f) => (
          <Link key={f} href={href(f)} className={cn("press flex h-11 shrink-0 items-center rounded-full border px-3.5 text-sm font-medium", filter === f ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2")}>
            {t(`adm1.bill.filter.${f}`)} ({count(f)})
          </Link>
        ))}
      </div>

      {all.length === 0 ? (
        <EmptyState
          className="mt-6"
          icon={<FileText className="h-5 w-5" />}
          title={t("adm1.bill.standaloneEmpty", { year })}
          text={t("adm1.bill.standaloneEmptyText")}
        />
      ) : (
        <StandaloneInvoiceList key={`${year}-${filter}`} invoices={list} />
      )}
      <p className="mt-3 text-xs text-ink-3">
        {t("adm1.bill.refundNote")}
      </p>
    </div>
  );
}
