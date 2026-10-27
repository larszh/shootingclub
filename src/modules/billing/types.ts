import { z } from "zod";

export const FEE_INVOICE_STATUS: Record<string, { label: string; tone: "neutral" | "accent" | "ok" | "warn" | "outline" }> = {
  OPEN: { label: "Offen", tone: "warn" },
  PAID: { label: "Bezahlt", tone: "ok" },
  CANCELLED: { label: "Storniert", tone: "outline" },
};

export const categorySchema = z.object({
  name: z.string().trim().min(2, "Name zu kurz").max(60),
  amountCents: z.coerce.number().int().min(0).max(100_000_00),
  description: z.string().trim().max(200).optional(),
  isActive: z.boolean().default(true),
});
export type CategoryInput = z.infer<typeof categorySchema>;

export const profileSchema = z.object({
  payeeName: z.string().trim().max(70).optional(),
  payeeStreet: z.string().trim().max(70).optional(),
  payeeZip: z.string().trim().max(16).optional(),
  payeeCity: z.string().trim().max(35).optional(),
  iban: z.string().trim().max(40).transform((v) => v.toUpperCase().replace(/\s+/g, "")).optional(),
  currency: z.enum(["CHF", "EUR"]).default("CHF"),
});

export const runSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  title: z.string().trim().min(2).max(80),
  invoicePrefix: z.string().trim().max(10).default("MB-"),
  dueDays: z.coerce.number().int().min(1).max(365).default(30),
  note: z.string().trim().max(600).optional(),
});
export type RunInput = z.infer<typeof runSchema>;

/** Einfache IBAN-Prüfung (Mod 97). */
export function isValidIban(iban: string) {
  const s = iban.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(s)) return false;
  const rearranged = s.slice(4) + s.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let rem = 0;
  for (const ch of numeric) rem = (rem * 10 + Number(ch)) % 97;
  return rem === 1;
}
