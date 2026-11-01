import { randomUUID } from "node:crypto";
import { PaymentError, type CheckoutInput, type PaymentProvider, type StatusResult } from "./types";

export type WorldlineCredentials = { customerId: string; terminalId: string; apiUsername: string; apiPassword: string; environment?: "test" | "live" };

const SPEC_VERSION = "1.40";

type SaferpayTransaction = { Status: string; Id: string; Amount?: { Value?: string; CurrencyCode?: string } };

function amountOf(t: SaferpayTransaction | undefined) {
  const v = t?.Amount?.Value;
  const n = v != null && /^\d+$/.test(String(v)) ? Number(v) : null;
  return { amountCents: n, currency: t?.Amount?.CurrencyCode ?? null };
}

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
        OrderId: input.reference.slice(0, 80),
        Description: input.description.slice(0, 1000),
      },
      Payer: input.customerEmail ? { BillingAddress: { Email: input.customerEmail } } : undefined,
      ReturnUrl: { Url: input.successUrl },
    });
    return { redirectUrl: r.RedirectUrl, providerRef: r.Token };
  }

  async fetchStatus(token: string): Promise<StatusResult> {
    try {
      const a = await this.call<{ Transaction: SaferpayTransaction }>("/Payment/v1/PaymentPage/Assert", { Token: token });
      const status = a.Transaction?.Status;
      const amount = amountOf(a.Transaction);
      if (status === "CAPTURED") return { status: "PAID", ...amount, details: a.Transaction };
      if (status === "AUTHORIZED") {
        const c = await this.call<{ Status: string }>("/Payment/v1/Transaction/Capture", { TransactionReference: { TransactionId: a.Transaction.Id } });
        return c.Status === "CAPTURED" ? { status: "PAID", ...amount, details: { ...a.Transaction, capture: c } } : { status: "PENDING", ...amount, details: c };
      }
      if (status === "PENDING") return { status: "PENDING", ...amount, details: a.Transaction };
      return { status: "FAILED", ...amount, details: a.Transaction };
    } catch (e) {
      const details = e instanceof PaymentError ? (e.details as { ErrorName?: string } | undefined) : undefined;
      const name = String(details?.ErrorName);
      // Abbruch durch Kunden oder noch nicht bezahlt
      if (name === "TRANSACTION_ABORTED" || name === "TRANSACTION_DECLINED" || name === "TOKEN_EXPIRED") return { status: "FAILED", details };
      if (name === "TRANSACTION_NOT_FOUND" || name === "TRANSACTION_IN_WRONG_STATE") return { status: "PENDING", details };
      throw e;
    }
  }
}
