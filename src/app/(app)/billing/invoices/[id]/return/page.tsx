import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { requireTenant } from "@/lib/tenant";
import { db } from "@/lib/db";
import { Card, LinkButton, PageHeader } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { verifyFeeInvoicePayment } from "@/modules/billing/payments";
import { feeInvoiceTitle } from "@/modules/billing/fee-title";
import { PaymentStatusPoller } from "@/lib/payments/ui/status-poller";
import { PayFeeInvoiceButton } from "../pay/pay-button";

export const metadata: Metadata = { title: "Zahlung" };
export const dynamic = "force-dynamic";

export default async function FeeInvoiceReturnPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ cancelled?: string }> }) {
  const ctx = await requireTenant();
  const { id } = await params;
  const sp = await searchParams;
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
  const title = feeInvoiceTitle(inv, `Mitgliederbeitrag ${inv.year}`);
  const heading = refund ? "Zahlung eingegangen" : paid ? "Bezahlt, danke!" : failed ? "Zahlung nicht abgeschlossen" : pending ? "Zahlung wird geprüft" : "Keine Online-Zahlung";
  return (
    <div>
      <PageHeader title={heading} back={{ href: "/payments", label: "Zahlungen" }} />
      <Card className="animate-pop p-8 text-center">
        <div className={`mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full ${refund ? "bg-surface-2 text-ink-2" : paid ? "bg-ok/15 text-ok" : failed ? "bg-accent-soft text-accent" : "bg-surface-2 text-ink-2"}`} aria-hidden>
          {refund ? <Clock className="h-8 w-8" /> : paid ? <CheckCircle2 className="h-8 w-8" /> : failed ? <XCircle className="h-8 w-8" /> : <Clock className="h-8 w-8" />}
        </div>
        <div className="font-semibold">{title} · {inv.number}</div>
        <div className="text-sm tabular-nums text-ink-3">{formatMoney(inv.amountCents, inv.currency)}</div>
        <p className="mt-3 text-ink-2">
          {refund
            ? `Die Zahlung ist eingegangen, die Rechnung war aber bereits ${inv.status === "CANCELLED" ? "storniert" : "bezahlt"}. Der Verein prüft die Rückerstattung und meldet sich bei dir.`
            : paid
            ? "Deine Rechnung ist bezahlt. Du erhältst eine Bestätigung."
            : failed
              ? "Die Zahlung wurde abgebrochen oder abgelehnt. Es wurde nichts belastet. Du kannst es erneut versuchen oder mit der QR-Rechnung bezahlen."
              : pending
                ? "Der Zahlungsanbieter hat die Zahlung noch nicht bestätigt. Das kann einen Moment dauern."
                : "Für diese Rechnung wurde keine Online-Zahlung gefunden."}
        </p>
        {r.error ? <p className="mt-2 text-xs text-ink-3">{r.error}</p> : null}
        {pending && !r.needsReview ? <PaymentStatusPoller /> : null}
        <div className="mt-5 flex flex-col items-center gap-2">
          {(failed || none) && inv.status === "OPEN" ? <div className="w-full max-w-xs"><PayFeeInvoiceButton invoiceId={inv.id} label="Erneut online bezahlen" /></div> : null}
          <LinkButton href="/payments" variant="secondary">Zu den Zahlungen</LinkButton>
        </div>
      </Card>
    </div>
  );
}
