import type { PaymentProviderKey } from "./catalog";

export type CheckoutInput = {
  tenantId: string;
  amountCents: number;
  currency: string;
  /** Eigene Referenz (Buchungs-ID, Rechnungsnummer) – erscheint beim Anbieter als Bestellnummer */
  reference: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
  /** Rücksprung bei abgelehnter Zahlung (Standard: successUrl, dort wird der Status geprüft) */
  failedUrl?: string;
  customerEmail?: string;
  /** Zusätzliche Metadaten (nur Stripe) */
  metadata?: Record<string, string>;
};

export type CheckoutResult = { redirectUrl: string; providerRef: string };

/**
 * Status beim Anbieter. amountCents/currency: vom Anbieter gemeldeter Betrag (null = unbekannt).
 * Eine Zahlung wird nur als bezahlt verbucht, wenn Betrag und Währung übereinstimmen.
 */
export type StatusResult = {
  status: "PAID" | "PENDING" | "FAILED";
  amountCents?: number | null;
  currency?: string | null;
  details?: unknown;
};

export interface PaymentProvider {
  readonly key: PaymentProviderKey;
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  /** Status direkt beim Anbieter abfragen (nie dem Webhook-Inhalt allein vertrauen). */
  fetchStatus(providerRef: string): Promise<StatusResult>;
  /** Zugangsdaten prüfen (optional). */
  testConnection?(): Promise<void>;
}

export class PaymentError extends Error {
  constructor(message: string, public readonly details?: unknown) {
    super(message);
    this.name = "PaymentError";
  }
}
