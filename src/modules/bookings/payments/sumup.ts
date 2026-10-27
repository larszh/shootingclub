import { PaymentError, type CheckoutInput, type PaymentProvider } from "./types";

export type SumUpCredentials = { apiKey: string; merchantCode: string };

/** SumUp Online Checkout (Hosted Checkout). */
export class SumUpProvider implements PaymentProvider {
  readonly key = "SUMUP" as const;
  constructor(private readonly creds: SumUpCredentials) {
    if (!creds.apiKey || !creds.merchantCode) throw new PaymentError("SumUp: API Key oder Händlercode fehlt");
  }

  private async call<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`https://api.sumup.com${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${this.creds.apiKey}`, "Content-Type": "application/json", Accept: "application/json", ...(init?.headers ?? {}) },
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) throw new PaymentError(`SumUp: ${String(json.message ?? json.error_message ?? res.status)}`, json);
    return json as T;
  }

  async createCheckout(input: CheckoutInput) {
    const r = await this.call<{ id: string; hosted_checkout_url?: string }>("/v0.1/checkouts", {
      method: "POST",
      body: JSON.stringify({
        checkout_reference: `${input.bookingId}-${Date.now()}`,
        amount: Math.round(input.amountCents) / 100,
        currency: input.currency.toUpperCase(),
        merchant_code: this.creds.merchantCode,
        description: input.description.slice(0, 255),
        return_url: input.successUrl,
        redirect_url: input.successUrl,
        hosted_checkout: { enabled: true },
      }),
    });
    if (!r.hosted_checkout_url) throw new PaymentError("SumUp: keine Hosted-Checkout-URL erhalten", r);
    return { redirectUrl: r.hosted_checkout_url, providerRef: r.id };
  }

  async verify(checkoutId: string) {
    const r = await this.call<{ status: string }>(`/v0.1/checkouts/${encodeURIComponent(checkoutId)}`);
    if (r.status === "PAID") return { status: "PAID" as const, details: r };
    if (r.status === "FAILED" || r.status === "EXPIRED") return { status: "FAILED" as const, details: r };
    return { status: "PENDING" as const, details: r };
  }
}
