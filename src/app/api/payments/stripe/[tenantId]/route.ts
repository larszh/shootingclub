import { NextResponse } from "next/server";
import { getStripeForWebhook } from "@/lib/payments";
import { settleByProviderRef } from "@/lib/payments/settle";

/**
 * Stripe-Webhook pro Tenant (Reservationen und Beitragsrechnungen).
 * Endpoint im Stripe-Dashboard: https://<domain>/api/payments/stripe/<tenantId>
 */
export async function POST(req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const stripe = await getStripeForWebhook(tenantId);
  if (!stripe) return new NextResponse("Stripe nicht konfiguriert", { status: 404 });
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new NextResponse("Signatur fehlt", { status: 400 });
  const raw = await req.text();
  let parsed: ReturnType<typeof stripe.parseWebhook>;
  try {
    parsed = stripe.parseWebhook(raw, signature);
  } catch (e) {
    console.error("Stripe-Webhook abgelehnt:", e);
    return new NextResponse("Ungültige Signatur", { status: 400 });
  }
  // Signatur geprüft: Betrag und Währung stammen aus dem signierten Ereignis.
  if (parsed.paidSessionId) {
    await settleByProviderRef({ tenantId, provider: "STRIPE" }, parsed.paidSessionId, { amountCents: parsed.amountCents, currency: parsed.currency }, { source: "webhook" });
  }
  return NextResponse.json({ received: true });
}
