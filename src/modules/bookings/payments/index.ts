import "server-only";

/** Verschoben nach src/lib/payments (gemeinsam für Reservationen und Beitragsrechnungen). */
export { PaymentError, buildProvider, loadProviderCredentials, getActiveProvider, getStripeForWebhook, getPayrexxForWebhook } from "@/lib/payments";
export type { PaymentProvider } from "@/lib/payments";
