import { z } from "zod";
import { MAX_LINES, MAX_QUANTITY, isBatchId } from "./logic";

export const productSchema = z.object({
  name: z.string().trim().min(1, "Bitte einen Namen eingeben.").max(191, "Höchstens 191 Zeichen."),
  category: z.string().trim().max(191, "Höchstens 191 Zeichen.").transform((s) => s || null),
  priceCents: z.number().int().min(0, "Preis darf nicht negativ sein.").max(100_000, "Preis zu hoch (max. CHF 1000)."),
  sortOrder: z.number().int().min(-9999).max(9999),
  isActive: z.boolean(),
});
export type ProductInput = z.infer<typeof productSchema>;

export const entryInputSchema = z.object({
  batchId: z.string().refine(isBatchId, "Ungültige Erfassung."),
  userId: z.string().min(1).max(40).nullable(),
  guestName: z.string().trim().max(80).optional().transform((s) => s || null),
  paidCash: z.boolean(),
  /** Zeitpunkt der Erfassung am Gerät (ms seit Epoch); offline gespeicherte Erfassungen werden später gesendet. */
  soldAt: z.number().int().positive().optional(),
  lines: z.array(z.object({ productId: z.string().min(1).max(40), quantity: z.number().int().min(1).max(MAX_QUANTITY) })).min(1, "Bitte mindestens ein Produkt wählen.").max(MAX_LINES),
});
export type EntryInput = z.input<typeof entryInputSchema>;

export const CATEGORY_SUGGESTIONS = ["Getränke", "Warme Getränke", "Essen", "Snacks", "Scheiben & Material"];

export function firstIssue(e: z.ZodError) {
  return e.issues[0]?.message ?? "Ungültige Eingabe.";
}
