import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { requireTenant } from "@/lib/tenant";
import { db } from "@/lib/db";
import { Alert, Card, LinkButton, PageHeader } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { formatDateZurich } from "@/lib/time";
import { providerLabel, providerMethods } from "@/lib/payments/catalog";
import { canPayFeeInvoiceOnline } from "@/lib/payments/logic";
import { getOnlineFeeProviderKey } from "@/modules/billing/payments";
import { feeInvoiceTitle } from "@/modules/billing/fee-title";
import { PayFeeInvoiceButton } from "./pay-button";

export const metadata: Metadata = { title: "Online bezahlen" };

export default async function PayFeeInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireTenant();
  const { id } = await params;
  const inv = await db.feeInvoice.findUnique({ where: { id }, include: { run: { select: { title: true } } } });
  if (!inv || inv.tenantId !== ctx.tenant.id || inv.userId !== ctx.user.id) notFound();
  if (inv.status === "PAID") redirect(`/billing/invoices/${id}/return`);
  const providerKey = await getOnlineFeeProviderKey(ctx.tenant.id);
  const title = feeInvoiceTitle(inv, `Mitgliederbeitrag ${inv.year}`);
  const payable = canPayFeeInvoiceOnline(inv, providerKey);
  const back = { href: "/payments", label: "Zahlungen" };

  if (!payable || !providerKey) {
    return (
      <div>
        <PageHeader title="Online-Zahlung nicht möglich" back={back} />
        <Alert>{inv.status !== "OPEN" ? "Diese Rechnung ist nicht mehr offen." : "Der Verein bietet für diese Rechnung keine Online-Zahlung an. Bitte mit der QR-Rechnung bezahlen."}</Alert>
        <div className="mt-4"><LinkButton href={`/billing/invoices/${id}/print`} target="_blank" variant="secondary">QR-Rechnung öffnen</LinkButton></div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Online bezahlen" subtitle={ctx.tenant.name} back={back} />
      <Card className="animate-rise space-y-4 p-5">
        <div>
          <div className="text-sm text-ink-3">{inv.number} · zahlbar bis {formatDateZurich(inv.dueAt, { weekday: undefined })}</div>
          <div className="mt-0.5 text-lg font-semibold">{title}</div>
          <div className="mt-2 text-3xl font-semibold tabular-nums">{formatMoney(inv.amountCents, inv.currency)}</div>
        </div>
        <PayFeeInvoiceButton invoiceId={inv.id} label={`Weiter zu ${providerLabel(providerKey)}`} />
        <p className="flex items-start gap-2 text-xs text-ink-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>Du bezahlst auf der sicheren Zahlungsseite von {providerLabel(providerKey)} ({providerMethods(providerKey)}). Danach kommst du hierher zurück und die Rechnung wird automatisch als bezahlt markiert.</span>
        </p>
      </Card>
      <p className="mt-4 text-center text-sm text-ink-3">
        Lieber per E-Banking? <a href={`/billing/invoices/${id}/print`} target="_blank" rel="noreferrer" className="underline">QR-Rechnung öffnen</a>
      </p>
    </div>
  );
}
