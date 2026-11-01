import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { requireTenant } from "@/lib/tenant";
import { db } from "@/lib/db";
import { Alert, Card, LinkButton, PageHeader } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { formatDate, getRequestLocale, getT } from "@/lib/i18n";
import { localizeMethods } from "@/modules/billing/ui/i18n";
import { providerLabel, providerMethods } from "@/lib/payments/catalog";
import { canPayFeeInvoiceOnline } from "@/lib/payments/logic";
import { getOnlineFeeProviderKey } from "@/modules/billing/payments";
import { feeInvoiceTitle } from "@/modules/billing/fee-title";
import { PayFeeInvoiceButton } from "./pay-button";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("money.payOnline.button") };
}

export default async function PayFeeInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireTenant();
  const { id } = await params;
  const locale = await getRequestLocale();
  const t = getT(locale);
  const inv = await db.feeInvoice.findUnique({ where: { id }, include: { run: { select: { title: true } } } });
  if (!inv || inv.tenantId !== ctx.tenant.id || inv.userId !== ctx.user.id) notFound();
  if (inv.status === "PAID") redirect(`/billing/invoices/${id}/return`);
  const providerKey = await getOnlineFeeProviderKey(ctx.tenant.id);
  const title = feeInvoiceTitle(inv, t("money.fee.annualTitle", { year: inv.year }));
  const payable = canPayFeeInvoiceOnline(inv, providerKey);
  const back = { href: "/payments", label: t("money.payments.title") };

  if (!payable || !providerKey) {
    return (
      <div>
        <PageHeader title={t("money.pay.notPossible")} back={back} />
        <Alert>{inv.status !== "OPEN" ? t("money.pay.notOpen") : t("money.pay.notOffered")}</Alert>
        <div className="mt-4"><LinkButton href={`/billing/invoices/${id}/print`} target="_blank" variant="secondary">{t("money.qr.open")}</LinkButton></div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t("money.payOnline.button")} subtitle={ctx.tenant.name} back={back} />
      <Card className="animate-rise space-y-4 p-5">
        <div>
          <div className="text-sm text-ink-3">{inv.number} · {t("money.due.payableUntil", { date: formatDate(inv.dueAt, locale) })}</div>
          <div className="mt-0.5 text-lg font-semibold">{title}</div>
          <div className="mt-2 text-3xl font-semibold tabular-nums">{formatMoney(inv.amountCents, inv.currency)}</div>
        </div>
        <PayFeeInvoiceButton invoiceId={inv.id} label={t("money.pay.continueTo", { provider: providerLabel(providerKey) })} locale={locale} />
        <p className="flex items-start gap-2 text-xs text-ink-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{t("money.pay.secureNote", { provider: providerLabel(providerKey), methods: localizeMethods(providerMethods(providerKey), locale) })}</span>
        </p>
      </Card>
      <p className="mt-4 text-center text-sm text-ink-3">
        {t("money.pay.preferEbanking")} <a href={`/billing/invoices/${id}/print`} target="_blank" rel="noreferrer" className="underline">{t("money.qr.open")}</a>
      </p>
    </div>
  );
}
