import type { Metadata } from "next";
import Link from "next/link";
import { CreditCard, FileText, Printer, Settings } from "lucide-react";
import { requireModule } from "@/lib/tenant";
import { Badge, Card, EmptyState, LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { listMyFeeInvoices } from "@/modules/billing/queries";
import { getBillingProfile } from "@/modules/billing/profile";
import { ensureReferences } from "@/modules/billing/reference";
import { FEE_INVOICE_STATUS } from "@/modules/billing/types";
import { feeInvoiceTitle, isStandaloneFeeInvoice } from "@/modules/billing/fee-title";
import { CopyField } from "@/modules/billing/ui/copy-field";
import { formatMoney } from "@/lib/money";
import { formatDate, getRequestLocale, getT } from "@/lib/i18n";
import { localizeMethods } from "@/modules/billing/ui/i18n";
import { formatIban, formatQrReference } from "@/lib/qr-reference";
import { getOnlineFeeProviderKey } from "@/modules/billing/payments";
import { canPayFeeInvoiceOnline, feeInvoicePayPath } from "@/lib/payments/logic";
import { providerLabel, providerMethods } from "@/lib/payments/catalog";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("money.billing.metaTitle") };
}

export default async function BillingPage() {
  const ctx = await requireModule("billing");
  const [all, profile, onlineProvider] = await Promise.all([listMyFeeInvoices(ctx), getBillingProfile(ctx.tenant.id, ctx.tenant.name), getOnlineFeeProviderKey(ctx.tenant.id)]);
  const canManage = ctx.can("tenant.manage");
  const locale = await getRequestLocale();
  const t = getT(locale);
  const day = (d: Date) => formatDate(d, locale);
  const titleOf = (i: (typeof all)[number]) => feeInvoiceTitle(i, t("money.fee.annualTitle", { year: i.year }));
  const statusOf = (s: string) => ({ label: t(`money.status.${s}`), tone: FEE_INVOICE_STATUS[s]?.tone ?? ("neutral" as const) });
  // Offene Rechnungen erhalten bei QR-IBAN ihre Referenz (ältere Rechnungen werden nachgeführt).
  const open = await ensureReferences("FEE", all.filter((i) => i.status === "OPEN"), ctx.tenant.id);
  const done = all.filter((i) => i.status !== "OPEN");
  const openTotal = open.reduce((a, i) => a + i.amountCents, 0);

  return (
    <div>
      <PageHeader title={t("money.billing.title")} subtitle={ctx.tenant.name} action={canManage ? <LinkButton href="/admin/billing" variant="secondary" size="sm"><Settings className="h-4 w-4" /> {t("money.common.manage")}</LinkButton> : null} />

      {open.length ? (
        <>
          <Card className="animate-rise p-4 mb-4 bg-accent-soft/40 border-accent/20">
            <div className="text-sm font-medium">{open.length === 1 ? t("money.billing.openCount.one") : t("money.billing.openCount.other", { n: open.length })} · {formatMoney(openTotal, open[0]!.currency)}</div>
            <p className="text-xs text-ink-3 mt-0.5">
              {onlineProvider
                ? t("money.billing.hintOnline", { methods: localizeMethods(providerMethods(onlineProvider), locale), provider: providerLabel(onlineProvider) })
                : t("money.billing.hintQr")}
            </p>
          </Card>
          <div className="stagger space-y-3">
            {open.map((i) => (
              <Card key={i.id} className="p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold">{titleOf(i)}</div>
                    <div className="text-xs text-ink-3">{i.number}{isStandaloneFeeInvoice(i) ? "" : ` · ${i.categoryName}`} · {t("money.due.dueOn", { date: day(i.dueAt) })}</div>
                  </div>
                  <div className="text-right shrink-0"><div className="text-lg font-semibold tabular-nums">{formatMoney(i.amountCents, i.currency)}</div><Badge tone="warn">{t("money.due.open")}</Badge></div>
                </div>
                {profile.iban && profile.qrIban && !i.reference ? (
                  <p className="text-xs text-ink-3">{t("money.payee.useQrBillShort")}</p>
                ) : profile.iban ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <CopyField locale={locale} label={`IBAN · ${profile.payeeName ?? ctx.tenant.name}`} value={profile.iban.replace(/\s+/g, "")} display={formatIban(profile.iban)} />
                    {profile.qrIban && i.reference ? (
                      <CopyField locale={locale} label={t("money.payee.referenceNumber")} value={i.reference} display={formatQrReference(i.reference)} />
                    ) : (
                      <CopyField locale={locale} label={t("money.payee.purposeMessage")} value={`${feeInvoiceTitle(i, `Mitgliederbeitrag ${i.year}`)} ${i.number}`} mono={false} />
                    )}
                    <CopyField locale={locale} label={t("money.payee.amount")} value={(i.amountCents / 100).toFixed(2)} display={formatMoney(i.amountCents, i.currency)} />
                  </div>
                ) : (
                  <p className="text-xs text-ink-3">{t("money.payee.onInvoice")}</p>
                )}
                {canPayFeeInvoiceOnline(i, onlineProvider) ? (
                  <LinkButton href={feeInvoicePayPath(i.id)} prefetch={false} className="w-full"><CreditCard className="h-4 w-4" aria-hidden /> {t("money.payOnline.button")}</LinkButton>
                ) : null}
                <LinkButton href={`/billing/invoices/${i.id}/print`} target="_blank" variant="secondary" className="w-full"><Printer className="h-4 w-4" /> {t("money.qr.open")}</LinkButton>
              </Card>
            ))}
          </div>
        </>
      ) : null}

      {done.length ? (
        <>
          <SectionTitle>{open.length ? t("money.common.done") : t("money.billing.invoices")}</SectionTitle>
          <Card className="animate-rise divide-y divide-line overflow-hidden">
            {done.map((i) => {
              const st = statusOf(i.status);
              return (
                <Link key={i.id} href={`/billing/invoices/${i.id}/print`} target="_blank" className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2 min-h-14">
                  <FileText className="h-5 w-5 text-ink-2" />
                  <div className="min-w-0 flex-1"><div className="font-medium">{titleOf(i)}</div><div className="text-xs text-ink-3">{i.number}{isStandaloneFeeInvoice(i) ? "" : ` · ${i.categoryName}`}{i.paidAt ? ` · ${t("money.due.paidOn", { date: day(i.paidAt) })}` : ""}</div></div>
                  <div className="text-right"><div className="font-semibold tabular-nums">{formatMoney(i.amountCents, i.currency)}</div><Badge tone={st.tone}>{st.label}</Badge></div>
                </Link>
              );
            })}
          </Card>
        </>
      ) : null}

      {all.length === 0 ? (
        <EmptyState icon={<FileText className="h-5 w-5" />} title={t("money.billing.empty.title")} text={t("money.billing.empty.text")} />
      ) : null}
      {!ctx.user.street ? <p className="mt-4 text-xs text-ink-3">{t("money.tip.addressBefore")}<Link href="/me" className="underline">{t("money.tip.addressLink")}</Link>{t("money.tip.addressAfterSingular")}</p> : null}
    </div>
  );
}
