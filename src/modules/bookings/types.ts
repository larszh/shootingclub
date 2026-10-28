import { z } from "zod";

export const RESOURCE_KINDS = [
  { key: "RANGE", label: "Schiessanlage / Stand" },
  { key: "LANE", label: "Bahn / Scheibe" },
  { key: "ROOM", label: "Raum" },
  { key: "OTHER", label: "Anderes" },
] as const;
export const resourceKindKeys = RESOURCE_KINDS.map((k) => k.key) as [string, ...string[]];
export function resourceKindLabel(k: string) {
  return RESOURCE_KINDS.find((x) => x.key === k)?.label ?? k;
}

export const PAYMENT_PROVIDERS = [
  { key: "STRIPE", label: "Stripe", hint: "Kreditkarte, TWINT (via Stripe), Apple/Google Pay. Zugangsdaten aus dem Stripe-Dashboard." },
  { key: "WORLDLINE", label: "Worldline (Saferpay)", hint: "Schweizer Zahlungsseite mit TWINT, PostFinance, Karten. Zugangsdaten aus dem Saferpay-Backoffice." },
  { key: "SUMUP", label: "SumUp", hint: "Online-Checkout von SumUp. API-Key und Händlercode aus dem SumUp-Dashboard." },
] as const;
export type PaymentProviderKey = (typeof PAYMENT_PROVIDERS)[number]["key"];
export const providerKeys = PAYMENT_PROVIDERS.map((p) => p.key) as [PaymentProviderKey, ...PaymentProviderKey[]];
export function providerLabel(k: string) {
  return PAYMENT_PROVIDERS.find((p) => p.key === k)?.label ?? k;
}

/** Felder, die pro Provider verschlüsselt gespeichert werden. */
export const PROVIDER_FIELDS: Record<PaymentProviderKey, Array<{ key: string; label: string; secret?: boolean; hint?: string; options?: string[] }>> = {
  STRIPE: [
    { key: "secretKey", label: "Secret Key", secret: true, hint: "sk_live_… oder sk_test_…" },
    { key: "webhookSecret", label: "Webhook Signing Secret", secret: true, hint: "whsec_… (optional, empfohlen). Endpoint: /api/payments/stripe/<tenant-id>" },
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

export const BOOKING_STATUS: Record<string, { label: string; tone: "neutral" | "accent" | "ok" | "warn" | "outline" }> = {
  PENDING: { label: "Wartet auf Freigabe", tone: "warn" },
  CONFIRMED: { label: "Bestätigt", tone: "ok" },
  REJECTED: { label: "Abgelehnt", tone: "accent" },
  CANCELLED: { label: "Storniert", tone: "outline" },
};
export const PAYMENT_STATUS: Record<string, { label: string; tone: "neutral" | "accent" | "ok" | "warn" | "outline" }> = {
  NOT_REQUIRED: { label: "Kostenlos", tone: "outline" },
  UNPAID: { label: "Offen", tone: "warn" },
  PENDING: { label: "Zahlung läuft", tone: "warn" },
  PAID: { label: "Bezahlt", tone: "ok" },
  FAILED: { label: "Fehlgeschlagen", tone: "accent" },
  REFUNDED: { label: "Erstattet", tone: "outline" },
};
/**
 * Zahlungsstatus für die Anzeige. Bei stornierten oder abgelehnten Buchungen ist eine offene
 * Zahlung hinfällig («Entfällt»); bezahlte und erstattete bleiben sichtbar.
 */
export function paymentStatusView(b: { status: string; paymentStatus: string }) {
  if ((b.status === "CANCELLED" || b.status === "REJECTED") && b.paymentStatus !== "PAID" && b.paymentStatus !== "REFUNDED") {
    return { label: "Entfällt", tone: "outline" as const, void: true };
  }
  const ps = PAYMENT_STATUS[b.paymentStatus] ?? { label: b.paymentStatus, tone: "neutral" as const };
  return { ...ps, void: false };
}
export const PAYMENT_METHOD_LABEL: Record<string, string> = { NONE: "Keine Zahlung", INVOICE: "Rechnung", ONLINE: "Online-Zahlung", CASH: "Bar / vor Ort" };

export const durationOptionSchema = z.object({
  minutes: z.coerce.number().int().min(5).max(24 * 60),
  priceCents: z.coerce.number().int().min(0).max(100_000_00),
});
export type DurationOption = z.infer<typeof durationOptionSchema>;

const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;
export const openingHoursSchema = z.record(z.string(), z.array(z.tuple([z.string().regex(timeRe), z.string().regex(timeRe)])));
export type OpeningHours = z.infer<typeof openingHoursSchema>;

export const settingsSchema = z.object({
  currency: z.string().length(3).toUpperCase().default("CHF"),
  slotStepMinutes: z.coerce.number().int().min(5).max(120),
  durationOptions: z.array(durationOptionSchema).min(1, "Mindestens eine Dauer"),
  openingHours: openingHoursSchema,
  approvalRequired: z.boolean(),
  allowInvoice: z.boolean(),
  allowOnline: z.boolean(),
  onlineProvider: z.enum(["NONE", ...providerKeys]),
  lastMinuteDiscountPercent: z.coerce.number().int().min(0).max(100),
  lastMinuteWindowHours: z.coerce.number().int().min(1).max(24 * 14),
  minLeadMinutes: z.coerce.number().int().min(0).max(24 * 60 * 30),
  maxAdvanceDays: z.coerce.number().int().min(1).max(730),
  cancellationHours: z.coerce.number().int().min(0).max(24 * 60),
  invoiceDueDays: z.coerce.number().int().min(1).max(365),
  invoicePrefix: z.string().trim().max(10),
  invoiceNote: z.string().trim().max(500).optional(),
});
export type SettingsInput = z.infer<typeof settingsSchema>;

export const DEFAULT_OPENING_HOURS: OpeningHours = {
  "0": [],
  "1": [["17:00", "21:00"]],
  "2": [["17:00", "21:00"]],
  "3": [["17:00", "21:00"]],
  "4": [["17:00", "21:00"]],
  "5": [["17:00", "21:00"]],
  "6": [["09:00", "17:00"]],
};
export const DEFAULT_DURATIONS: DurationOption[] = [
  { minutes: 30, priceCents: 1000 },
  { minutes: 60, priceCents: 1800 },
  { minutes: 90, priceCents: 2500 },
];

export const resourceSchema = z.object({
  name: z.string().trim().min(2, "Name zu kurz").max(80),
  description: z.string().trim().max(400).optional(),
  kind: z.enum(resourceKindKeys),
  capacity: z.coerce.number().int().min(1).max(200),
  durationOptions: z.array(durationOptionSchema).optional(),
  isActive: z.boolean().default(true),
});
export type ResourceInput = z.infer<typeof resourceSchema>;

/** true für ein echtes Kalenderdatum im Format YYYY-MM-DD (z.B. nicht 2026-13-45 oder 2026-02-30). */
export function isCalendarDate(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export const WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

export function formatDuration(min: number) {
  if (min < 60) return `${min} Min.`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} Min.` : `${h} h`;
}
