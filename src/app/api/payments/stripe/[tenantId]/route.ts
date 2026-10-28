import { NextResponse } from "next/server";
import { getStripeForWebhook } from "@/modules/bookings/payments";
import { markPaidByProviderRef } from "@/modules/bookings/payment-flow";

/** Stripe-Webhook pro Tenant. Endpoint im Stripe-Dashboard: https://<domain>/api/payments/stripe/<tenantId> */
export async function POST(req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const stripe = await getStripeForWebhook(tenantId);
  if (!stripe) return new NextResponse("Stripe nicht konfiguriert", { status: 404 });
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new NextResponse("Signatur fehlt", { status: 400 });
  const raw = await req.text();
  try {
    const { paidSessionId, amountCents, currency } = stripe.parseWebhook(raw, signature);
    if (paidSessionId) await markPaidByProviderRef({ tenantId, provider: "STRIPE" }, paidSessionId, { amountCents, currency }, { source: "webhook" });
    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("Stripe-Webhook abgelehnt:", e);
    return new NextResponse("Ungültige Signatur", { status: 400 });
  }
}
