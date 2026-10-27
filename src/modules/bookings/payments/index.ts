import "server-only";
import { db } from "@/lib/db";
import { decryptJson } from "@/lib/crypto";
import { StripeProvider, type StripeCredentials } from "./stripe";
import { WorldlineProvider, type WorldlineCredentials } from "./worldline";
import { SumUpProvider, type SumUpCredentials } from "./sumup";
import { PaymentError, type PaymentProvider } from "./types";

export { PaymentError } from "./types";
export type { PaymentProvider } from "./types";

export function buildProvider(key: string, creds: Record<string, string>): PaymentProvider {
  switch (key) {
    case "STRIPE":
      return new StripeProvider(creds as StripeCredentials);
    case "WORLDLINE":
      return new WorldlineProvider(creds as unknown as WorldlineCredentials);
    case "SUMUP":
      return new SumUpProvider(creds as SumUpCredentials);
    default:
      throw new PaymentError(`Unbekannter Zahlungsanbieter: ${key}`);
  }
}

export async function loadProviderCredentials(tenantId: string, provider: string) {
  const cfg = await db.paymentProviderConfig.findUnique({ where: { tenantId_provider: { tenantId, provider } } });
  if (!cfg || !cfg.enabled) return null;
  return decryptJson<Record<string, string>>(cfg.credentialsEnc);
}

/** Aktiver Provider des Tenants, oder null wenn keiner konfiguriert/aktiviert ist. */
export async function getActiveProvider(tenantId: string, providerKey: string): Promise<PaymentProvider | null> {
  if (!providerKey || providerKey === "NONE") return null;
  const creds = await loadProviderCredentials(tenantId, providerKey);
  if (!creds) return null;
  return buildProvider(providerKey, creds);
}

export async function getStripeForWebhook(tenantId: string) {
  const creds = await loadProviderCredentials(tenantId, "STRIPE");
  return creds ? new StripeProvider(creds as StripeCredentials) : null;
}
