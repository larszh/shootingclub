import { randomUUID } from "node:crypto";
import { PaymentError, type CheckoutInput, type PaymentProvider } from "./types";

export type WorldlineCredentials = { customerId: string; terminalId: string; apiUsername: string; apiPassword: string; environment?: "test" | "live" };

const SPEC_VERSION = "1.40";

/**
 * Worldline Saferpay Payment Page (JSON API).
 * Ablauf: PaymentPage/Initialize → Redirect → PaymentPage/Assert → Transaction/Capture.
 */
export class WorldlineProvider implements PaymentProvider {
  readonly key = "WORLDLINE" as const;
  constructor(private readonly creds: WorldlineCredentials) {
    for (const k of ["customerId", "terminalId", "apiUsername", "apiPassword"] as const) {
      if (!creds[k]) throw new PaymentError(`Worldline: ${k} fehlt`);
    }
  }

  private get baseUrl() {
    return this.creds.environment === "live" ? "https://www.saferpay.com/api" : "https://test.saferpay.com/api";
  }

  private async call<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Accept: "application/json",
        Authorization: "Basic " + Buffer.from(`${this.creds.apiUsername}:${this.creds.apiPassword}`).toString("base64"),
      },
      body: JSON.stringify({
        RequestHeader: { SpecVersion: SPEC_VERSION, CustomerId: this.creds.customerId, RequestId: randomUUID(), RetryIndicator: 0 },
        ...body,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) throw new PaymentError(`Worldline: ${String(json.ErrorName ?? res.status)} ${String(json.ErrorMessage ?? "")}`.trim(), json);
    return json as T;
  }

  async createCheckout(input: CheckoutInput) {
    const r = await this.call<{ Token: string; RedirectUrl: string }>("/Payment/v1/PaymentPage/Initialize", {
      TerminalId: this.creds.terminalId,
      Payment: {
        Amount: { Value: String(input.amountCents), CurrencyCode: input.currency.toUpperCase() },
        OrderId: input.bookingId.slice(0, 80),
        Description: input.description.slice(0, 1000),
      },
      Payer: input.customerEmail ? { BillingAddress: { Email: input.customerEmail } } : undefined,
      ReturnUrl: { Url: input.successUrl },
    });
    return { redirectUrl: r.RedirectUrl, providerRef: r.Token };
  }

  async verify(token: string) {
    try {
      const a = await this.call<{ Transaction: { Status: string; Id: string } }>("/Payment/v1/PaymentPage/Assert", { Token: token });
      const status = a.Transaction?.Status;
      if (status === "CAPTURED") return { status: "PAID" as const, details: a.Transaction };
      if (status === "AUTHORIZED") {
        const c = await this.call<{ Status: string }>("/Payment/v1/Transaction/Capture", { TransactionReference: { TransactionId: a.Transaction.Id } });
        return c.Status === "CAPTURED" ? { status: "PAID" as const, details: { ...a.Transaction, capture: c } } : { status: "PENDING" as const, details: c };
      }
      if (status === "PENDING") return { status: "PENDING" as const, details: a.Transaction };
      return { status: "FAILED" as const, details: a.Transaction };
    } catch (e) {
      const name = String((e as PaymentError).details && (e as PaymentError & { details: { ErrorName?: string } }).details?.ErrorName);
      // Abbruch durch Kunden oder noch nicht bezahlt
      if (name === "TRANSACTION_ABORTED" || name === "TRANSACTION_DECLINED" || name === "TOKEN_EXPIRED") return { status: "FAILED" as const, details: (e as PaymentError).details };
      if (name === "TRANSACTION_NOT_FOUND" || name === "TRANSACTION_IN_WRONG_STATE") return { status: "PENDING" as const, details: (e as PaymentError).details };
      throw e;
    }
  }
}
