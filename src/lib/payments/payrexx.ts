import { createHmac } from "node:crypto";
import { PaymentError, type CheckoutInput, type PaymentProvider, type StatusResult } from "./types";

/**
 * Payrexx (Schweizer Zahlungsdienst mit TWINT, PostFinance, Karten).
 * REST-API https://api.payrexx.com/v1.0/ mit Instanzname (Query `instance`) und API-Secret.
 * Jede Anfrage trägt `ApiSignature` = base64(HMAC-SHA256(http_build_query(params), secret)).
 * Ablauf: Gateway anlegen → Weiterleitung auf `link` → Webhook/Rücksprung → Gateway per API abfragen.
 */

export type PayrexxCredentials = { instance: string; apiSecret: string; paymentMethods?: string };

export const PAYREXX_API_BASE = "https://api.payrexx.com/v1.0/";

// ---------------------------------------------------------------------------
// Reine Hilfsfunktionen (getestet in payrexx.test.ts)
// ---------------------------------------------------------------------------

/** Wie PHP `urlencode` (RFC 1738): alles ausser A-Z a-z 0-9 - _ . kodiert, Leerzeichen als «+». */
export function phpUrlencode(value: string): string {
  return encodeURIComponent(value)
    .replace(/[!'()*~]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/%20/g, "+");
}

export type QueryValue = string | number | boolean | null | undefined | QueryValue[] | { [k: string]: QueryValue };

function scalar(v: string | number | boolean): string {
  if (typeof v === "boolean") return v ? "1" : "0";
  return String(v);
}

/**
 * Nachbau von PHP `http_build_query($params, '', '&')`: verschachtelte Arrays als `key[0]`, `key[sub]`,
 * Klammern kodiert, null/undefined ausgelassen, Booleans als 1/0.
 */
export function httpBuildQuery(params: Record<string, QueryValue>): string {
  const parts: string[] = [];
  const walk = (key: string, value: QueryValue) => {
    if (value === null || value === undefined) return;
    if (Array.isArray(value)) {
      value.forEach((v, i) => walk(`${key}[${i}]`, v));
      return;
    }
    if (typeof value === "object") {
      for (const [k, v] of Object.entries(value)) walk(`${key}[${k}]`, v);
      return;
    }
    parts.push(`${phpUrlencode(key)}=${phpUrlencode(scalar(value))}`);
  };
  for (const [k, v] of Object.entries(params)) walk(k, v);
  return parts.join("&");
}

/** ApiSignature: base64(HMAC-SHA256(query, secret)). */
export function payrexxSignature(query: string, secret: string): string {
  return createHmac("sha256", secret).update(query, "utf8").digest("base64");
}

/** Signierter Query-String: Parameter + ApiSignature (wie das offizielle PHP-SDK). */
export function signedQuery(params: Record<string, QueryValue>, secret: string): string {
  const query = httpBuildQuery(params);
  const sig = payrexxSignature(query, secret);
  return (query ? query + "&" : "") + "ApiSignature=" + phpUrlencode(sig);
}

/** Instanzname: nur der Teil vor .payrexx.com (auch wenn die ganze URL eingefügt wurde). */
export function normalizePayrexxInstance(raw: string): string {
  let s = raw.trim().toLowerCase();
  s = s.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  s = s.replace(/\.payrexx\.com$/, "");
  return s;
}

export function isValidPayrexxInstance(s: string) {
  return /^[a-z0-9][a-z0-9-]{0,62}$/.test(s);
}

/** Zahlarten aus «twint, postfinance_card» → ["twint", "postfinance_card"]. */
export function parsePaymentMethods(raw: string | undefined | null): string[] {
  return (raw ?? "")
    .split(/[,\s;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => /^[a-z0-9_-]{2,40}$/.test(s));
}

/** Parameter zum Anlegen eines Gateways (Betrag in Rappen). */
export function gatewayParams(input: CheckoutInput, paymentMethods: string[]): Record<string, QueryValue> {
  const params: Record<string, QueryValue> = {
    amount: Math.round(input.amountCents),
    currency: input.currency.toUpperCase(),
    referenceId: input.reference.slice(0, 100),
    purpose: input.description.slice(0, 255),
    successRedirectUrl: input.successUrl,
    failedRedirectUrl: input.failedUrl ?? input.successUrl,
    cancelRedirectUrl: input.cancelUrl,
  };
  if (paymentMethods.length) params.pm = paymentMethods;
  if (input.customerEmail) params.fields = { email: { value: input.customerEmail } };
  return params;
}

type PayrexxTransaction = { id?: number | string; status?: string; amount?: number | string; currency?: string };
type PayrexxInvoice = { amount?: number | string; currency?: string; currencyAlpha3?: string; transactions?: PayrexxTransaction[] };
export type PayrexxGateway = {
  id?: number | string;
  status?: string;
  amount?: number | string;
  currency?: string;
  referenceId?: string;
  link?: string;
  invoices?: PayrexxInvoice[];
};

const FAILED_TX = new Set(["declined", "cancelled", "error", "expired"]);

function toCents(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
  if (typeof v === "string" && /^\d+$/.test(v.trim())) return Number(v.trim());
  return null;
}

/**
 * Gateway-Antwort → Status. «confirmed» (Gateway oder Transaktion) = bezahlt. Nur abgelehnte,
 * abgebrochene oder fehlerhafte Transaktionen (und keine laufende) = fehlgeschlagen. Reserviert,
 * autorisiert oder wartend = offen. Betrag bevorzugt aus der bestätigten Transaktion.
 */
export function mapPayrexxGateway(g: PayrexxGateway): StatusResult {
  const invoices = Array.isArray(g.invoices) ? g.invoices : [];
  const txs = invoices.flatMap((i) => (Array.isArray(i.transactions) ? i.transactions.map((t) => ({ t, i })) : []));
  const confirmed = txs.find(({ t }) => t.status === "confirmed");
  const invoice = confirmed?.i ?? invoices[0];
  const amountCents = toCents(confirmed?.t.amount) ?? toCents(invoice?.amount) ?? toCents(g.amount);
  const currency = (confirmed?.t.currency ?? invoice?.currencyAlpha3 ?? invoice?.currency ?? g.currency ?? null) || null;
  const details = { gatewayId: g.id ?? null, gatewayStatus: g.status ?? null, transactionStatuses: txs.map(({ t }) => t.status ?? null) };
  if (g.status === "confirmed" || confirmed) return { status: "PAID", amountCents, currency, details };
  if (txs.length && txs.every(({ t }) => FAILED_TX.has(String(t.status)))) return { status: "FAILED", amountCents, currency, details };
  return { status: "PENDING", amountCents, currency, details };
}

/** Verschachtelte Formularfelder (`transaction[invoice][paymentRequestId]=…`) in ein Objekt wandeln. */
function parseBracketForm(raw: string): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  for (const [fullKey, value] of new URLSearchParams(raw)) {
    const m = fullKey.match(/^([^[\]]+)((?:\[[^[\]]*\])*)$/);
    if (!m) continue;
    const path = [m[1]!, ...[...m[2]!.matchAll(/\[([^[\]]*)\]/g)].map((x) => x[1]!)];
    if (path.some((seg) => seg === "__proto__" || seg === "constructor" || seg === "prototype")) continue;
    let node = root;
    path.forEach((seg, idx) => {
      if (idx === path.length - 1) node[seg] = value;
      else {
        const next = node[seg];
        node = (next && typeof next === "object" ? next : (node[seg] = {})) as Record<string, unknown>;
      }
    });
  }
  return root;
}

export type PayrexxWebhook = { gatewayId: string | null; transactionId: string | null; referenceId: string | null; status: string | null };

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 191) : typeof v === "number" && Number.isFinite(v) ? String(v) : null);

/**
 * Webhook-Inhalt (JSON oder Formular) lesen. Liefert nur Kennungen: der Status wird danach immer
 * per API abgefragt, der Inhalt ist nicht signiert.
 */
export function parsePayrexxWebhook(raw: string, contentType: string | null): PayrexxWebhook | null {
  let body: Record<string, unknown>;
  try {
    body = (contentType ?? "").includes("json") || raw.trim().startsWith("{") ? (JSON.parse(raw) as Record<string, unknown>) : parseBracketForm(raw);
  } catch {
    return null;
  }
  if (!body || typeof body !== "object") return null;
  const tx = (body.transaction ?? null) as Record<string, unknown> | null;
  if (!tx || typeof tx !== "object") return null;
  const invoice = (tx.invoice ?? null) as Record<string, unknown> | null;
  const gatewayId = str(invoice?.paymentRequestId) ?? str(tx.paymentRequestId);
  return {
    gatewayId: gatewayId && /^\d+$/.test(gatewayId) ? gatewayId : null,
    transactionId: str(tx.id),
    referenceId: str(tx.referenceId) ?? str(invoice?.referenceId),
    status: str(tx.status),
  };
}

// ---------------------------------------------------------------------------
// Anbieter
// ---------------------------------------------------------------------------

type ApiResponse<T> = { status?: string; message?: string; data?: T[] };

export class PayrexxProvider implements PaymentProvider {
  readonly key = "PAYREXX" as const;
  private readonly instance: string;
  constructor(private readonly creds: PayrexxCredentials) {
    this.instance = normalizePayrexxInstance(creds.instance ?? "");
    if (!this.instance || !isValidPayrexxInstance(this.instance)) throw new PaymentError("Payrexx: Instanzname fehlt oder ist ungültig");
    if (!creds.apiSecret) throw new PaymentError("Payrexx: API-Secret fehlt");
  }

  private url(path: string, query?: string) {
    return `${PAYREXX_API_BASE}${path}?instance=${encodeURIComponent(this.instance)}${query ? "&" + query : ""}`;
  }

  private async call<T>(method: "GET" | "POST", path: string, params: Record<string, QueryValue> = {}): Promise<ApiResponse<T>> {
    const signed = signedQuery(params, this.creds.apiSecret);
    const res = await fetch(method === "GET" ? this.url(path, signed) : this.url(path), {
      method,
      headers: { Accept: "application/json", ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
      body: method === "POST" ? signed : undefined,
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as ApiResponse<T>;
    if (!res.ok || json.status !== "success") throw new PaymentError(`Payrexx: ${String(json.message ?? res.status)}`, json);
    return json;
  }

  async createCheckout(input: CheckoutInput) {
    const r = await this.call<PayrexxGateway>("POST", "Gateway/", gatewayParams(input, parsePaymentMethods(this.creds.paymentMethods)));
    const g = r.data?.[0];
    if (!g?.id || !g.link) throw new PaymentError("Payrexx: keine Zahlungsseite erhalten", r);
    return { redirectUrl: g.link, providerRef: String(g.id) };
  }

  async fetchStatus(gatewayId: string): Promise<StatusResult> {
    if (!/^\d+$/.test(gatewayId)) throw new PaymentError("Payrexx: ungültige Gateway-ID");
    const r = await this.call<PayrexxGateway>("GET", `Gateway/${gatewayId}/`);
    const g = r.data?.[0];
    if (!g) return { status: "PENDING", amountCents: null, currency: null };
    return mapPayrexxGateway(g);
  }

  /** Signatur und Instanz prüfen (GET /SignatureCheck/). */
  async testConnection() {
    await this.call("GET", "SignatureCheck/");
  }
}
