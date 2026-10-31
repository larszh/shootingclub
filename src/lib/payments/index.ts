import "server-only";
import { db } from "@/lib/db";
import { decryptJson } from "@/lib/crypto";
import { isProviderKey, type PaymentProviderKey } from "./catalog";
import { StripeProvider, type StripeCredentials } from "./stripe";
import { WorldlineProvider, type WorldlineCredentials } from "./worldline";
import { SumUpProvider, type SumUpCredentials } from "./sumup";
import { PayrexxProvider, type PayrexxCredentials } from "./payrexx";
import { PaymentError, type PaymentProvider } from "./types";

/**
 * Gemeinsame Zahlungsschicht für Reservationen und Beitragsrechnungen.
 * Anbieter: Stripe, Worldline (Saferpay), SumUp, Payrexx (TWINT, PostFinance, Karten).
 */

export { PaymentError } from "./types";
export type { PaymentProvider, CheckoutInput, CheckoutResult, StatusResult } from "./types";
export { PAYMENT_PROVIDERS, PROVIDER_FIELDS, providerKeys, providerLabel, isProviderKey, type PaymentProviderKey } from "./catalog";

export function buildProvider(key: string, creds: Record<string, string>): PaymentProvider {
  switch (key) {
    case "STRIPE":
      return new StripeProvider(creds as StripeCredentials);
    case "WORLDLINE":
      return new WorldlineProvider(creds as unknown as WorldlineCredentials);
    case "SUMUP":
      return new SumUpProvider(creds as SumUpCredentials);
    case "PAYREXX":
      return new PayrexxProvider(creds as PayrexxCredentials);
    default:
      throw new PaymentError(`Unbekannter Zahlungsanbieter: ${key}`);
  }
}

/** Entschlüsselte Zugangsdaten eines aktivierten Anbieters (sonst null). */
export async function loadProviderCredentials(tenantId: string, provider: string) {
  const cfg = await db.paymentProviderConfig.findUnique({ where: { tenantId_provider: { tenantId, provider } } });
  if (!cfg || !cfg.enabled) return null;
  return decryptJson<Record<string, string>>(cfg.credentialsEnc);
}

/** Aktiver Provider des Tenants, oder null wenn keiner konfiguriert/aktiviert ist. */
export async function getActiveProvider(tenantId: string, providerKey: string | null | undefined): Promise<PaymentProvider | null> {
  if (!providerKey || providerKey === "NONE" || !isProviderKey(providerKey)) return null;
  const creds = await loadProviderCredentials(tenantId, providerKey);
  if (!creds) return null;
  try {
    return buildProvider(providerKey, creds);
  } catch (e) {
    console.error(`Zahlungsanbieter ${providerKey} unvollständig konfiguriert:`, (e as Error).message);
    return null;
  }
}

/** Anbieter, die im Verein eingerichtet und aktiviert sind. */
export async function listEnabledProviderKeys(tenantId: string): Promise<PaymentProviderKey[]> {
  const rows = await db.paymentProviderConfig.findMany({ where: { tenantId, enabled: true }, select: { provider: true } });
  return rows.map((r) => r.provider).filter(isProviderKey);
}

export async function listProviderConfigs(tenantId: string) {
  return db.paymentProviderConfig.findMany({ where: { tenantId }, select: { provider: true, enabled: true, updatedAt: true } });
}

export async function getStripeForWebhook(tenantId: string) {
  const creds = await loadProviderCredentials(tenantId, "STRIPE");
  return creds ? new StripeProvider(creds as StripeCredentials) : null;
}

export async function getPayrexxForWebhook(tenantId: string) {
  const creds = await loadProviderCredentials(tenantId, "PAYREXX");
  if (!creds) return null;
  try {
    return new PayrexxProvider(creds as PayrexxCredentials);
  } catch {
    return null;
  }
}
