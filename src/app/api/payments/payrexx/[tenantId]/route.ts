import { NextResponse } from "next/server";
import { getPayrexxForWebhook } from "@/lib/payments";
import { parsePayrexxWebhook } from "@/lib/payments/payrexx";
import { findPaymentByProviderRef, markPaymentFailed, settlePayment } from "@/lib/payments/settle";

const MAX_BODY = 256 * 1024;

/**
 * Payrexx-Webhook pro Tenant (Reservationen und Beitragsrechnungen).
 * Endpoint im Payrexx-Backend (Webhooks, Typ «Transaktion», JSON oder Formular):
 * https://<domain>/api/payments/payrexx/<tenantId>
 *
 * Der Inhalt ist nicht signiert. Er dient nur als Anstoss: Der Status wird immer per API
 * (GET /Gateway/{id}/) beim Payrexx-Konto des Vereins abgefragt und erst dann verbucht.
 */
export async function POST(req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  if (!/^[a-z0-9]{8,40}$/i.test(tenantId)) return new NextResponse("Nicht gefunden", { status: 404 });
  const payrexx = await getPayrexxForWebhook(tenantId);
  if (!payrexx) return new NextResponse("Payrexx nicht konfiguriert", { status: 404 });

  const raw = await req.text();
  if (raw.length > MAX_BODY) return new NextResponse("Zu gross", { status: 413 });
  const hook = parsePayrexxWebhook(raw, req.headers.get("content-type"));
  if (!hook) return new NextResponse("Ungültiger Inhalt", { status: 400 });
  // Andere Transaktionen (z.B. ohne Gateway, aus anderen Shops) still quittieren, damit Payrexx nicht wiederholt.
  if (!hook.gatewayId) return NextResponse.json({ received: true, ignored: "no-gateway" });

  const payment = await findPaymentByProviderRef({ tenantId, provider: "PAYREXX" }, hook.gatewayId);
  if (!payment) return NextResponse.json({ received: true, ignored: "unknown-gateway" });
  if (payment.status === "PAID") return NextResponse.json({ received: true });

  try {
    const v = await payrexx.fetchStatus(payment.providerRef);
    if (v.status === "PAID") {
      const outcome = await settlePayment(payment.id, v, { source: "webhook", transactionId: hook.transactionId, ...(v.details && typeof v.details === "object" ? v.details : {}) });
      return NextResponse.json({ received: true, outcome });
    }
    if (v.status === "FAILED") await markPaymentFailed(payment.id, v.details);
    return NextResponse.json({ received: true, status: v.status });
  } catch (e) {
    console.error("Payrexx-Webhook: Statusabfrage fehlgeschlagen:", e);
    // 5xx: Payrexx stellt den Webhook später erneut zu.
    return new NextResponse("Status nicht abrufbar", { status: 502 });
  }
}
