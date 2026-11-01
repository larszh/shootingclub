import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown, Coffee } from "lucide-react";
import { Alert, Badge, Card, EmptyState, LinkButton, PageHeader, SectionTitle, StatCard } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { formatDate, formatDateTime, getRequestLocale, getT } from "@/lib/i18n";
import { requireKiosk } from "@/modules/kiosk/guard";
import { myKiosk } from "@/modules/kiosk/queries";
import { FEE_INVOICE_STATUS } from "@/modules/billing/types";
import { getBillingProfile } from "@/modules/billing/profile";
import { tPlural } from "@/modules/billing/ui/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("money.kiosk.title") };
}

/** Eigene Konsumationen: offen (noch nicht verrechnet), Rechnungen und Barbezüge. */
export default async function MyKioskPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const ctx = await requireKiosk();
  const sp = await searchParams;
  const locale = await getRequestLocale();
  const t = getT(locale);
  const when = (d: Date) => formatDateTime(d, locale);
  const [{ open, openCents, invoices, recentCash }, profile] = await Promise.all([
    myKiosk(ctx.tenant.id, ctx.user.id),
    getBillingProfile(ctx.tenant.id, ctx.tenant.name),
  ]);
  const cur = profile.currency;
  const seller = ctx.can("kiosk.sell");

  return (
    <div>
      <PageHeader title={t("money.kiosk.title")} subtitle={t("money.kiosk.subtitle")} back={seller ? { href: "/kiosk", label: t("money.kiosk.counter") } : undefined} />
      {sp.denied ? <Alert className="mb-4">{t("money.err.noPermission")}</Alert> : null}

      <div className="mb-4 grid grid-cols-2 gap-3">
        <StatCard label={t("money.kiosk.openNotBilled")} value={formatMoney(openCents, cur)} tone={openCents ? "warn" : "neutral"} hint={tPlural(t, "money.kiosk.entries", open.length)} />
        <StatCard label={t("money.billing.invoices")} value={invoices.length} href="/payments" hint={t("money.kiosk.underPayments")} />
      </div>

      <SectionTitle>{t("money.status.OPEN")}</SectionTitle>
      {open.length ? (
        <Card className="animate-rise mb-2 divide-y divide-line overflow-hidden">
          {open.map((e) => (
            <div key={e.id} className="flex min-h-12 items-center gap-3 px-4 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px]"><span className="font-medium tabular-nums">{e.quantity} ×</span> {e.productName}</div>
                <div className="text-xs text-ink-3">{when(e.createdAt)}</div>
              </div>
              <span className="shrink-0 font-medium tabular-nums">{formatMoney(e.totalCents, cur)}</span>
            </div>
          ))}
          <div className="flex min-h-12 items-center justify-between bg-surface-2 px-4 py-2 font-semibold">
            <span>{t("money.kiosk.totalOpen")}</span><span className="tabular-nums">{formatMoney(openCents, cur)}</span>
          </div>
        </Card>
      ) : (
        <EmptyState icon={<Coffee className="h-5 w-5" />} title={t("money.payments.nothingOpen.title")} text={t("money.kiosk.emptyOpen")} />
      )}
      {open.length ? <p className="mb-4 text-xs text-ink-3">{t("money.kiosk.openNote")}</p> : null}

      <SectionTitle action={<Link href="/payments" className="text-sm text-accent">{t("money.payments.title")}</Link>}>{t("money.kiosk.billed")}</SectionTitle>
      {invoices.length ? (
        <Card className="animate-rise mb-4 divide-y divide-line overflow-hidden">
          {invoices.map((i) => {
            const st = { label: FEE_INVOICE_STATUS[i.status] ? t(`money.status.${i.status}`) : i.status, tone: FEE_INVOICE_STATUS[i.status]?.tone ?? ("neutral" as const) };
            return (
              <details key={i.id} className="group">
                <summary className="press flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-2 hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5"><span className="truncate font-medium">{i.categoryName}</span><Badge tone={st.tone}>{st.label}</Badge></div>
                    <div className="text-xs text-ink-3">{t("money.kiosk.number", { number: i.number })} · {formatDate(i.issuedAt, locale)}{i.status === "OPEN" ? ` · ${t("money.due.payableUntil", { date: formatDate(i.dueAt, locale) })}` : ""} · {tPlural(t, "money.kiosk.positions", i.items.length)}</div>
                  </div>
                  <span className="shrink-0 font-medium tabular-nums">{formatMoney(i.amountCents, i.currency)}</span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-ink-3 transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                <div className="border-t border-line bg-surface-2/50">
                  {i.items.length ? (
                    <ul className="divide-y divide-line">
                      {i.items.map((e) => (
                        <li key={e.id} className="flex min-h-11 items-center gap-3 px-4 py-1.5">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm"><span className="tabular-nums">{e.quantity} ×</span> {e.productName} <span className="text-ink-3">{t("money.kiosk.unitPrice", { price: formatMoney(e.unitPriceCents, i.currency) })}</span></div>
                            <div className="text-xs text-ink-3">{when(e.createdAt)}</div>
                          </div>
                          <span className="shrink-0 text-sm tabular-nums">{formatMoney(e.totalCents, i.currency)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="px-4 py-2 text-sm text-ink-3">{t("money.kiosk.noPositions")}</p>}
                  <div className="px-4 py-2">
                    <Link href="/payments" className="inline-flex min-h-11 items-center text-sm font-medium text-accent">{t("money.kiosk.payHint")}</Link>
                  </div>
                </div>
              </details>
            );
          })}
        </Card>
      ) : <p className="mb-4 text-sm text-ink-3">{t("money.kiosk.noInvoices")}</p>}

      {recentCash.length ? (
        <>
          <SectionTitle>{t("money.kiosk.cash90")}</SectionTitle>
          <Card className="animate-rise mb-4 divide-y divide-line overflow-hidden">
            {recentCash.map((e) => (
              <div key={e.id} className="flex min-h-12 items-center gap-3 px-4 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px]"><span className="tabular-nums">{e.quantity} ×</span> {e.productName}</div>
                  <div className="text-xs text-ink-3">{when(e.createdAt)}</div>
                </div>
                <span className="shrink-0 text-sm tabular-nums text-ink-2">{formatMoney(e.totalCents, cur)}</span>
              </div>
            ))}
          </Card>
        </>
      ) : null}

      <LinkButton href="/payments" variant="secondary">{t("money.kiosk.allInvoices")}</LinkButton>
    </div>
  );
}
