import { z } from "zod";

/**
 * Munition (Modul «ammo»). Verkauf ausschliesslich auf Rechnung – Zahlungsanbieter wie Stripe oder
 * SumUp schliessen Munition aus. Diese Datei ist ohne Server-Abhängigkeiten (Client und Server).
 */

export const ORDER_STATUSES = ["ORDERED", "APPROVED", "ISSUED", "CANCELLED"] as const;
export type AmmoOrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = ["UNPAID", "PAID", "CANCELLED"] as const;
export type AmmoPaymentStatus = (typeof PAYMENT_STATUSES)[number];

type Tone = "neutral" | "accent" | "ok" | "warn" | "danger" | "outline";

export const ORDER_STATUS: Record<string, { label: string; memberLabel: string; tone: Tone }> = {
  ORDERED: { label: "Offen", memberLabel: "Bestellt", tone: "accent" },
  APPROVED: { label: "Freigegeben", memberLabel: "Freigegeben – bereit zur Abholung", tone: "warn" },
  ISSUED: { label: "Ausgegeben", memberLabel: "Ausgegeben", tone: "ok" },
  CANCELLED: { label: "Storniert", memberLabel: "Storniert", tone: "outline" },
};

export const PAYMENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  UNPAID: { label: "Unbezahlt", tone: "warn" },
  PAID: { label: "Bezahlt", tone: "ok" },
  CANCELLED: { label: "Rechnung storniert", tone: "outline" },
};

export const OPEN_ORDER_STATUSES: AmmoOrderStatus[] = ["ORDERED", "APPROVED"];

export const CALIBER_SUGGESTIONS = [
  ".22 lr",
  "9 mm Luger",
  "7.5 × 55 GP 11",
  "5.6 × 45 GP 90",
  ".38 Special",
  ".357 Magnum",
  ".45 ACP",
  "4.5 mm Diabolo",
];

export const UNIT_SUGGESTIONS = ["Schachtel", "Packung", "Stück", "Magazin", "Dose"];

/** Neutraler Hinweis: die App unterstützt, berät aber nicht rechtlich. */
export const LEGAL_HINT =
  "Der Verein ist für die Einhaltung der gesetzlichen Vorgaben beim Munitionsverkauf verantwortlich (z.B. Erwerbsberechtigung, Abgabe zum sofortigen Verbrauch auf dem Schiessplatz). Die App bietet dazu Einstellungen und Prüfschritte, ersetzt aber keine Rechtsberatung.";

export const ON_SITE_TEXT = "Abgabe nur zum Verbrauch auf dem Platz";

export const DEFAULT_SETTINGS = {
  onSiteOnly: true,
  requireIdCheck: true,
  approvalRequired: false,
  invoicePrefix: "MU-",
  invoiceDueDays: 30,
  maxRoundsPerOrder: null as number | null,
  note: null as string | null,
};

export type AmmoSettingsView = typeof DEFAULT_SETTINGS;

/** Ziffer der Art in der QR-Referenz (1 = Reservation, 2 = Mitgliederbeitrag, 3 = Munition). */
export const AMMO_REFERENCE_KIND_DIGIT = "3";

const optText = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : typeof v === "string" ? v.trim() : v), z.string().max(max, `Maximal ${max} Zeichen.`).optional());

export const settingsSchema = z.object({
  onSiteOnly: z.boolean(),
  requireIdCheck: z.boolean(),
  approvalRequired: z.boolean(),
  invoicePrefix: z.string().trim().min(1, "Präfix fehlt.").max(10, "Präfix: maximal 10 Zeichen.").regex(/^[A-Za-z0-9-]+$/, "Präfix: nur Buchstaben, Ziffern und Bindestrich."),
  invoiceDueDays: z.coerce.number().int("Zahlungsfrist in ganzen Tagen.").min(0, "Zahlungsfrist ab 0 Tagen.").max(120, "Zahlungsfrist höchstens 120 Tage."),
  maxRoundsPerOrder: z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), z.coerce.number().int("Limit in ganzen Schuss.").min(1, "Limit mindestens 1 Schuss.").max(100_000, "Limit zu gross.").nullable()),
  note: optText(2000),
});

export const productSchema = z.object({
  name: z.string().trim().min(1, "Name fehlt.").max(191, "Name: maximal 191 Zeichen."),
  caliber: z.string().trim().min(1, "Kaliber fehlt.").max(191, "Kaliber: maximal 191 Zeichen."),
  manufacturer: optText(191),
  description: optText(2000),
  unitLabel: z.string().trim().min(1, "Einheit fehlt.").max(40, "Einheit: maximal 40 Zeichen."),
  roundsPerUnit: z.coerce.number().int("Schuss pro Einheit: ganze Zahl.").min(1, "Mindestens 1 Schuss pro Einheit.").max(10_000, "Höchstens 10'000 Schuss pro Einheit."),
  priceCents: z.number().int().min(0, "Preis darf nicht negativ sein.").max(1_000_000, "Preis zu hoch."),
  stockUnits: z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), z.coerce.number().int("Bestand: ganze Zahl.").min(0, "Bestand darf nicht negativ sein.").max(1_000_000, "Bestand zu gross.").nullable()),
  isActive: z.boolean(),
  sortOrder: z.coerce.number().int().min(-1000).max(100_000).default(0),
});

export const orderLinesSchema = z
  .array(z.object({ productId: z.string().min(1).max(40), quantity: z.number().int().min(0).max(999) }))
  .max(100);

export type OrderLineInput = z.infer<typeof orderLinesSchema>[number];

export const orderNoteSchema = optText(191);

/** Produkt, wie es im Shop und an der Ausgabe angezeigt wird. */
export type ShopProduct = {
  id: string;
  name: string;
  caliber: string;
  manufacturer: string | null;
  description: string | null;
  unitLabel: string;
  roundsPerUnit: number;
  priceCents: number;
  /** null = Bestand nicht geführt; sonst verfügbar (Bestand minus offene Bestellungen) */
  available: number | null;
};

/** Gruppiert Produkte nach Kaliber (Reihenfolge der ersten Nennung bleibt). */
export function groupByCaliber<T extends { caliber: string }>(list: T[]) {
  const map = new Map<string, T[]>();
  for (const p of list) {
    const arr = map.get(p.caliber);
    if (arr) arr.push(p);
    else map.set(p.caliber, [p]);
  }
  return [...map.entries()].map(([caliber, items]) => ({ caliber, items }));
}

export function formatRounds(n: number) {
  return `${new Intl.NumberFormat("de-CH").format(n)} Schuss`;
}

/** Titel einer Munitionsrechnung (Zahlungszweck, Übersichten). */
export function invoiceTitle(number: string | null) {
  return number ? `Munition ${number}` : "Munition";
}
