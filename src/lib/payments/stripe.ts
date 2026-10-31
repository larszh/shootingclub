import Stripe from "stripe";
import { PaymentError, type CheckoutInput, type PaymentProvider, type StatusResult } from "./types";

export type StripeCredentials = { secretKey: string; webhookSecret?: string };

export class StripeProvider implements PaymentProvider {
  readonly key = "STRIPE" as const;
  private readonly client: Stripe;
  constructor(private readonly creds: StripeCredentials) {
    if (!creds.secretKey) throw new PaymentError("Stripe: Secret Key fehlt");
    this.client = new Stripe(creds.secretKey);
  }

  async createCheckout(input: CheckoutInput) {
    const session = await this.client.checkout.sessions.create({
      mode: "payment",
      line_items: [{ quantity: 1, price_data: { currency: input.currency.toLowerCase(), unit_amount: input.amountCents, product_data: { name: input.description } } }],
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      customer_email: input.customerEmail,
      metadata: { reference: input.reference, ...(input.metadata ?? {}) },
      client_reference_id: input.reference.slice(0, 200),
    });
    if (!session.url) throw new PaymentError("Stripe: keine Checkout-URL erhalten");
    return { redirectUrl: session.url, providerRef: session.id };
  }

  async fetchStatus(providerRef: string): Promise<StatusResult> {
    const s = await this.client.checkout.sessions.retrieve(providerRef);
    const amount = { amountCents: s.amount_total ?? null, currency: s.currency ?? null };
    if (s.payment_status === "paid") return { status: "PAID", ...amount, details: { paymentIntent: s.payment_intent } };
    if (s.status === "expired") return { status: "FAILED", ...amount };
    return { status: "PENDING", ...amount };
  }

  /** Webhook-Signatur prüfen und Session-ID bei erfolgreicher Zahlung zurückgeben. */
  parseWebhook(rawBody: string, signature: string): { paidSessionId: string | null; amountCents: number | null; currency: string | null } {
    if (!this.creds.webhookSecret) throw new PaymentError("Stripe: Webhook Secret nicht konfiguriert");
    const event = this.client.webhooks.constructEvent(rawBody, signature, this.creds.webhookSecret);
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const s = event.data.object as Stripe.Checkout.Session;
      return { paidSessionId: s.payment_status === "paid" ? s.id : null, amountCents: s.amount_total ?? null, currency: s.currency ?? null };
    }
    return { paidSessionId: null, amountCents: null, currency: null };
  }
}
