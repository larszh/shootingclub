export type CheckoutInput = {
  bookingId: string;
  amountCents: number;
  currency: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
};

export type CheckoutResult = { redirectUrl: string; providerRef: string };

export type VerifyResult = { status: "PAID" | "PENDING" | "FAILED"; details?: unknown };

export interface PaymentProvider {
  readonly key: "STRIPE" | "WORLDLINE" | "SUMUP";
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  verify(providerRef: string): Promise<VerifyResult>;
}

export class PaymentError extends Error {
  constructor(message: string, public readonly details?: unknown) {
    super(message);
    this.name = "PaymentError";
  }
}
