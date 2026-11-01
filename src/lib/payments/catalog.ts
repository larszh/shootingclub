/**
 * Zahlungsanbieter (ohne Server-Abhängigkeiten, auch im Client nutzbar).
 * Jeder Verein nutzt sein eigenes Händlerkonto; die Zugangsdaten liegen verschlüsselt in
 * PaymentProviderConfig (siehe src/lib/crypto.ts).
 */

export const PAYMENT_PROVIDERS = [
  {
    key: "PAYREXX",
    label: "Payrexx",
    hint: "Schweizer Zahlungsseite mit TWINT, PostFinance, Karten, Apple/Google Pay. Instanzname und API-Secret aus dem Payrexx-Backend.",
    methods: "TWINT, PostFinance, Karte",
    fees: "Payrexx verrechnet je nach Abo und Zahlart eine Transaktionsgebühr (meist 1–3 %, bei Karten plus Fixbetrag) und je nach Abo eine Monatsgebühr. Zuschläge für Zahlende im Payrexx-Backend ausgeschaltet lassen: sonst weicht der bezahlte Betrag von der Rechnung ab und die Zahlung wird nicht automatisch verbucht.",
  },
  {
    key: "STRIPE",
    label: "Stripe",
    hint: "Kreditkarte, TWINT (via Stripe), Apple/Google Pay. Zugangsdaten aus dem Stripe-Dashboard.",
    methods: "Karte, TWINT, Apple/Google Pay",
    fees: "Stripe verrechnet pro Zahlung eine Gebühr je nach Zahlart (Prozentsatz plus Fixbetrag), ohne Monatsgebühr.",
  },
  {
    key: "WORLDLINE",
    label: "Worldline (Saferpay)",
    hint: "Schweizer Zahlungsseite mit TWINT, PostFinance, Karten. Zugangsdaten aus dem Saferpay-Backoffice.",
    methods: "TWINT, PostFinance, Karte",
    fees: "Worldline verrechnet Gebühren gemäss Vertrag (Transaktionsgebühr je Zahlart, oft mit Monatsgebühr).",
  },
  {
    key: "SUMUP",
    label: "SumUp",
    hint: "Online-Checkout von SumUp. API-Key und Händlercode aus dem SumUp-Dashboard.",
    methods: "Karte",
    fees: "SumUp verrechnet pro Online-Zahlung eine prozentuale Gebühr, ohne Monatsgebühr.",
  },
] as const;

export type PaymentProviderKey = (typeof PAYMENT_PROVIDERS)[number]["key"];
export const providerKeys = PAYMENT_PROVIDERS.map((p) => p.key) as [PaymentProviderKey, ...PaymentProviderKey[]];

export function isProviderKey(v: unknown): v is PaymentProviderKey {
  return typeof v === "string" && (providerKeys as readonly string[]).includes(v);
}

export function providerLabel(k: string) {
  return PAYMENT_PROVIDERS.find((p) => p.key === k)?.label ?? k;
}

/** Kurzbeschreibung der Zahlarten für Mitglieder (z.B. «TWINT, PostFinance, Karte»). */
export function providerMethods(k: string) {
  return PAYMENT_PROVIDERS.find((p) => p.key === k)?.methods ?? "Karte";
}

export function providerFees(k: string) {
  return PAYMENT_PROVIDERS.find((p) => p.key === k)?.fees ?? null;
}

export type ProviderField = {
  key: string;
  label: string;
  /** Wird nie angezeigt; leer lassen = gespeicherten Wert behalten */
  secret?: boolean;
  hint?: string;
  options?: string[];
  /** Darf leer bleiben, auch wenn der Anbieter aktiviert ist */
  optional?: boolean;
};

/** Felder, die pro Provider verschlüsselt gespeichert werden. */
export const PROVIDER_FIELDS: Record<PaymentProviderKey, ProviderField[]> = {
  PAYREXX: [
    { key: "instance", label: "Instanz", hint: "Name vor .payrexx.com, z.B. «sgmusterhausen» für sgmusterhausen.payrexx.com" },
    { key: "apiSecret", label: "API-Secret", secret: true, hint: "Payrexx-Backend → Einstellungen → API" },
    { key: "paymentMethods", label: "Zahlarten (optional)", optional: true, hint: "Kommagetrennt, z.B. twint,postfinance_card,visa,mastercard. Leer = alle im Payrexx-Konto aktiven Zahlarten." },
  ],
  STRIPE: [
    { key: "secretKey", label: "Secret Key", secret: true, hint: "sk_live_… oder sk_test_…" },
    { key: "webhookSecret", label: "Webhook Signing Secret", secret: true, optional: true, hint: "whsec_… (optional, empfohlen). Endpoint: /api/payments/stripe/<tenant-id>" },
  ],
  WORLDLINE: [
    { key: "customerId", label: "Customer ID" },
    { key: "terminalId", label: "Terminal ID" },
    { key: "apiUsername", label: "API-Benutzer (JSON API)" },
    { key: "apiPassword", label: "API-Passwort", secret: true },
    { key: "environment", label: "Umgebung", options: ["test", "live"] },
  ],
  SUMUP: [
    { key: "apiKey", label: "API Key (Secret)", secret: true, hint: "sup_sk_…" },
    { key: "merchantCode", label: "Händlercode (Merchant Code)" },
  ],
};

/** Anbieter, deren Verbindung sich im Formular testen lässt. */
export const TESTABLE_PROVIDERS: ReadonlySet<PaymentProviderKey> = new Set<PaymentProviderKey>(["PAYREXX"]);

/** Webhook-Pfad pro Anbieter und Verein (null = Anbieter ohne Webhook, Prüfung beim Rücksprung). */
export function webhookPath(provider: PaymentProviderKey, tenantId: string): string | null {
  if (provider === "STRIPE") return `/api/payments/stripe/${tenantId}`;
  if (provider === "PAYREXX") return `/api/payments/payrexx/${tenantId}`;
  return null;
}

export const PAYMENT_ROW_STATUS: Record<string, { label: string; tone: "neutral" | "accent" | "ok" | "warn" | "outline" }> = {
  PENDING: { label: "Läuft", tone: "warn" },
  PAID: { label: "Bezahlt", tone: "ok" },
  FAILED: { label: "Fehlgeschlagen", tone: "accent" },
  REFUNDED: { label: "Erstattet", tone: "outline" },
};
