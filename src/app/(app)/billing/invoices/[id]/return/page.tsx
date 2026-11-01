import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { requireTenant } from "@/lib/tenant";
import { db } from "@/lib/db";
import { Card, LinkButton, PageHeader } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { getRequestLocale, getT } from "@/lib/i18n";
import { localizeMessage } from "@/modules/billing/ui/i18n";
import { verifyFeeInvoicePayment } from "@/modules/billing/payments";
import { feeInvoiceTitle } from "@/modules/billing/fee-title";
import { PaymentStatusPoller } from "@/lib/payments/ui/status-poller";
import { PayFeeInvoiceButton } from "../pay/pay-button";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("money.return.metaTitle") };
}
export const dynamic = "force-dynamic";

export default async function FeeInvoiceReturnPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ cancelled?: string }> }) {
  const ctx = await requireTenant();
  const { id } = await params;
  const sp = await searchParams;
  const locale = await getRequestLocale();
  const t = getT(locale);
  const inv = await db.feeInvoice.findUnique({ where: { id }, include: { run: { select: { title: true } } } });
  if (!inv || inv.tenantId !== ctx.tenant.id || inv.userId !== ctx.user.id) notFound();
  const r = await verifyFeeInvoicePayment({ tenantId: ctx.tenant.id, userId: ctx.user.id }, id);
  // Eingegangen, aber Rechnung war schon bezahlt/storniert: kein «Bezahlt, danke!», Rückerstattung folgt.
  const refund = r.status === "REFUND_REVIEW";
  const paid = r.status === "PAID" || refund;
  // Abbruch: der Anbieter meldet je nach Zeitpunkt noch «offen» – dann trotzdem als abgebrochen zeigen.
  const failed = r.status === "FAILED" || (!paid && sp.cancelled === "1");
  const pending = !paid && !failed && r.status === "PENDING";
  const none = !paid && !failed && !pending;
  const title = feeInvoiceTitle(inv, t("money.fee.annualTitle", { year: inv.year }));
  const heading = t(refund ? "money.return.h.refund" : paid ? "money.return.h.paid" : failed ? "money.return.h.failed" : pending ? "money.return.h.pending" : "money.return.h.none");
  return (
    <div>
      <PageHeader title={heading} back={{ href: "/payments", label: t("money.payments.title") }} />
      <Card className="animate-pop p-8 text-center">
        <div className={`mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full ${refund ? "bg-surface-2 text-ink-2" : paid ? "bg-ok/15 text-ok" : failed ? "bg-accent-soft text-accent" : "bg-surface-2 text-ink-2"}`} aria-hidden>
          {refund ? <Clock className="h-8 w-8" /> : paid ? <CheckCircle2 className="h-8 w-8" /> : failed ? <XCircle className="h-8 w-8" /> : <Clock className="h-8 w-8" />}
        </div>
        <div className="font-semibold">{title} · {inv.number}</div>
        <div className="text-sm tabular-nums text-ink-3">{formatMoney(inv.amountCents, inv.currency)}</div>
        <p className="mt-3 text-ink-2">
          {refund
            ? t(inv.status === "CANCELLED" ? "money.return.t.refundCancelled" : "money.return.t.refundPaid")
            : paid
            ? t("money.return.t.paid")
            : failed
              ? t("money.return.t.failed")
              : pending
                ? t("money.return.t.pending")
                : t("money.return.t.none")}
        </p>
        {r.error ? <p className="mt-2 text-xs text-ink-3">{localizeMessage(r.error, locale)}</p> : null}
        {pending && !r.needsReview ? <PaymentStatusPoller locale={locale} /> : null}
        <div className="mt-5 flex flex-col items-center gap-2">
          {(failed || none) && inv.status === "OPEN" ? <div className="w-full max-w-xs"><PayFeeInvoiceButton invoiceId={inv.id} label={t("money.return.retry")} locale={locale} /></div> : null}
          <LinkButton href="/payments" variant="secondary">{t("money.return.toPayments")}</LinkButton>
        </div>
      </Card>
    </div>
  );
}
