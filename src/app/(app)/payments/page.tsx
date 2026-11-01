import type { Metadata } from "next";
import Link from "next/link";
import { CreditCard, Settings, Wallet } from "lucide-react";
import { requireTenant } from "@/lib/tenant";
import { Card, EmptyState, LinkButton, LinkTabs, PageHeader, SectionTitle, StatCard } from "@/components/ui";
import { anyPaymentModule, listMyPayments } from "@/modules/billing/overview";
import { nowDate } from "@/modules/billing/dates";
import { OpenPaymentCard, PaymentRow, formatTotals } from "@/modules/billing/ui/payment-rows";
import { getRequestLocale, getT } from "@/lib/i18n";
import { localizeMethods, tPlural } from "@/modules/billing/ui/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("money.payments.title") };
}

const FILTERS = ["open", "paid", "all"] as const;
type Filter = (typeof FILTERS)[number];

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const ctx = await requireTenant();
  const sp = await searchParams;
  const canManage = ctx.can("tenant.manage");
  const locale = await getRequestLocale();
  const t = getT(locale);

  if (!anyPaymentModule(ctx)) {
    return (
      <div>
        <PageHeader title={t("money.payments.title")} subtitle={ctx.tenant.name} />
        <EmptyState
          icon={<Wallet className="h-5 w-5" />}
          title={t("money.payments.noModule.title")}
          text={t("money.payments.noModule.text")}
        />
      </div>
    );
  }

  const data = await listMyPayments(ctx, nowDate());
  const requested = FILTERS.includes(sp.filter as Filter) ? (sp.filter as Filter) : null;
  const filter: Filter = requested ?? (data.openCount > 0 ? "open" : "all");
  const open = data.items.filter((i) => i.group === "open");
  const paid = data.items.filter((i) => i.group === "paid");
  const rest = filter === "all" ? data.items.filter((i) => i.group !== "open") : filter === "paid" ? paid : [];
  const payee = { iban: data.profile.iban, payeeName: data.profile.payeeName ?? ctx.tenant.name, qrIban: data.profile.qrIban };
  const showOpen = filter === "open" || filter === "all";

  return (
    <div>
      <PageHeader
        title={t("money.payments.title")}
        subtitle={t("money.payments.subtitle", { club: ctx.tenant.name })}
        action={canManage ? <LinkButton href="/admin/payments" variant="secondary" size="sm"><Settings className="h-4 w-4" /> {t("money.payments.openItems")}</LinkButton> : null}
      />

      <div className="stagger grid grid-cols-2 gap-2.5">
        <StatCard
          label={t("money.status.OPEN")}
          value={<span className="block text-xl break-words">{formatTotals(data.openTotals)}</span>}
          tone={data.overdueCount > 0 ? "warn" : data.openCount > 0 ? "accent" : "neutral"}
          hint={data.openCount ? `${tPlural(t, "money.payments.invoices", data.openCount)}${data.overdueCount ? t("money.payments.overdueSuffix", { n: data.overdueCount }) : ""}` : t("money.payments.allPaid")}
          href="/payments?filter=open"
        />
        <StatCard label={t("money.payments.paidYear", { year: data.year })} value={<span className="block text-xl break-words">{formatTotals(data.paidThisYear)}</span>} tone="ok" hint={t("money.payments.sinceJan1")} href="/payments?filter=paid" />
      </div>

      <LinkTabs
        className="mt-4"
        label={t("money.payments.filterLabel")}
        active={filter}
        items={[
          { value: "open", href: "/payments?filter=open", label: t("money.status.OPEN"), count: open.length },
          { value: "paid", href: "/payments?filter=paid", label: t("money.status.PAID"), count: paid.length },
          { value: "all", href: "/payments?filter=all", label: t("money.payments.all"), count: data.items.length },
        ]}
      />

      {showOpen && open.length ? (
        <>
          <p className="mt-4 text-sm text-ink-2">
            {data.onlineFeeProvider && open.some((i) => i.payOnlineHref)
              ? t("money.payments.hintOnline", { methods: data.onlineFeeMethods ? localizeMethods(data.onlineFeeMethods, locale) : t("money.payments.card"), provider: data.onlineFeeProvider })
              : t("money.payments.hintQr")}
          </p>
          <div className="stagger mt-3 space-y-3">
            {open.map((i) =>
              // Online-Zahlung nur für Beitragsrechnungen (FeeInvoice), nie für Munition.
              i.payOnlineHref && i.source === "FEE" ? (
                <div key={i.key} className="space-y-2">
                  <OpenPaymentCard item={i} payee={payee} locale={locale} />
                  <LinkButton href={i.payOnlineHref} prefetch={false} className="w-full" aria-label={t("money.payOnline.aria", { title: i.title, number: i.number })}>
                    <CreditCard className="h-4 w-4" aria-hidden /> {t("money.payOnline.button")}
                  </LinkButton>
                </div>
              ) : (
                <OpenPaymentCard key={i.key} item={i} payee={payee} locale={locale} />
              ),
            )}
          </div>
        </>
      ) : null}

      {filter === "open" && !open.length ? (
        <EmptyState
          className="mt-4"
          icon={<Wallet className="h-5 w-5" />}
          title={t("money.payments.nothingOpen.title")}
          text={t("money.payments.nothingOpen.text")}
          action={<LinkButton href="/payments?filter=all" variant="secondary" size="sm">{t("money.payments.showAll")}</LinkButton>}
        />
      ) : null}

      {rest.length ? (
        <>
          {filter === "all" && open.length ? <SectionTitle>{t("money.common.done")}</SectionTitle> : <div className="mt-4" />}
          <Card className="animate-rise divide-y divide-line overflow-hidden">
            {rest.map((i) => (
              <PaymentRow key={i.key} item={i} locale={locale} />
            ))}
          </Card>
        </>
      ) : filter !== "open" && !(filter === "all" && open.length) ? (
        <EmptyState className="mt-4" icon={<Wallet className="h-5 w-5" />} title={t("money.payments.none.title")} text={t("money.payments.none.text")} />
      ) : null}

      {!ctx.user.street ? (
        <p className="mt-6 text-xs text-ink-3">
          {t("money.tip.addressBefore")}<Link href="/me" className="underline">{t("money.tip.addressLink")}</Link>{t("money.tip.addressAfterPlural")}
        </p>
      ) : null}
    </div>
  );
}
