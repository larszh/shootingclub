"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { todayZurich } from "@/lib/time";
import { requireAmmoAdmin } from "./guard";
import { AmmoError } from "./service";
import { bookStock, movementDate } from "./stock-service";
import { inventoryDelta, MANUAL_KINDS, signedUnits, STOCK_KIND } from "./stock";

const revalidate = () => {
  revalidatePath("/ammo");
  revalidatePath("/admin/ammo", "layout");
};

const optText = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : typeof v === "string" ? v.trim() : v ?? null), z.string().max(max, `Maximal ${max} Zeichen.`).nullable());

const dayKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ungültiges Datum.").refine((s) => !Number.isNaN(Date.parse(s)), "Ungültiges Datum.");

const movementSchema = z.object({
  productId: z.string().min(1).max(40),
  kind: z.enum(MANUAL_KINDS),
  quantity: z.coerce.number().int("Menge: ganze Zahl.").min(1, "Menge mindestens 1.").max(1_000_000, "Menge zu gross."),
  direction: z.union([z.literal(1), z.literal(-1)]).default(1),
  date: dayKey,
  rangeDayId: z.string().max(40).nullable().default(null),
  source: optText(191),
  note: optText(191),
});

function handle(e: unknown): ActionResult<never> {
  if (e instanceof AmmoError) return fail(e.message);
  console.error("Munitionskontrolle:", e);
  return fail("Das hat nicht geklappt. Bitte nochmals versuchen.");
}

/** Bewegung im Journal buchen: Wareneingang, Abgabe am Stand (optional mit Standbuch), Rücknahme, Korrektur. */
export async function bookMovementAction(input: z.input<typeof movementSchema>): Promise<ActionResult<{ stockUnits: number }>> {
  const ctx = await requireAmmoAdmin();
  const parsed = movementSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(issue?.message ?? "Ungültige Eingabe.", issue?.path[0] ? { [String(issue.path[0])]: issue.message } : undefined);
  }
  const v = parsed.data;
  if (v.date > todayZurich()) return fail("Das Datum liegt in der Zukunft.", { date: "Das Datum liegt in der Zukunft." });
  const tenantId = ctx.tenant.id;
  let rangeDayId: string | null = null;
  if (v.kind === "ISSUE" && v.rangeDayId) {
    const day = await db.rangeDay.findFirst({ where: { id: v.rangeDayId, tenantId }, select: { id: true, date: true } });
    if (!day) return fail("Standbuch nicht gefunden.");
    if (day.date.toISOString().slice(0, 10) !== v.date) return fail("Das Standbuch gehört zu einem anderen Datum.");
    rangeDayId = day.id;
  }
  if (v.kind === "RECEIPT" && !v.source) return fail("Bitte die Herkunft angeben (z.B. «Bund, Lieferschein 123»).", { source: "Herkunft fehlt." });
  const units = signedUnits(v.kind, v.quantity, v.direction);
  try {
    const res = await db.$transaction((tx) =>
      bookStock(tx, { tenantId, productId: v.productId, kind: v.kind, units, date: movementDate(v.date), rangeDayId, source: v.source, note: v.note, createdById: ctx.user.id }),
    );
    await audit({ tenantId, actorId: ctx.user.id, action: "ammo.stock.movement", entity: "AmmoProduct", entityId: v.productId, detail: `${STOCK_KIND[v.kind].label} ${units > 0 ? "+" : ""}${units}${v.source ? ` (${v.source})` : ""}` });
    revalidate();
    return ok({ stockUnits: res.stockUnits }, `${STOCK_KIND[v.kind].label} gebucht. Neuer Bestand: ${res.stockUnits}.`);
  } catch (e) {
    return handle(e);
  }
}

const inventorySchema = z.object({
  lines: z
    .array(z.object({
      productId: z.string().min(1).max(40),
      loaded: z.number().int().min(0).nullable(),
      counted: z.number().int("Gezählt: ganze Zahl.").min(0, "Gezählt: ab 0.").max(10_000_000, "Gezählt: zu gross."),
    }))
    .min(1, "Bitte mindestens ein Produkt zählen.")
    .max(500),
  note: optText(191),
});

/**
 * Inventur: gezählte Einheiten pro Produkt. Pro Produkt eine INVENTORY-Bewegung mit der Differenz (auch 0, damit
 * der Differenzbericht vollständig ist), alle mit demselben Zeitpunkt. Hat sich ein Bestand seit dem Laden der
 * Seite geändert, wird nichts gebucht.
 */
export async function inventoryAction(input: z.input<typeof inventorySchema>): Promise<ActionResult<{ at: number }>> {
  const ctx = await requireAmmoAdmin();
  const parsed = inventorySchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Ungültige Eingabe.");
  const { lines, note } = parsed.data;
  if (new Set(lines.map((l) => l.productId)).size !== lines.length) return fail("Ein Produkt ist doppelt erfasst.");
  const tenantId = ctx.tenant.id;
  const at = new Date();
  // Millisekunden weglassen: der Zeitpunkt dient als Schlüssel des Durchgangs (Differenzbericht).
  at.setMilliseconds(0);
  try {
    await db.$transaction(async (tx) => {
      for (const l of lines) {
        const p = await tx.ammoProduct.findFirst({ where: { id: l.productId, tenantId }, select: { name: true, stockUnits: true } });
        if (!p) throw new AmmoError("Ein Produkt wurde inzwischen gelöscht. Bitte Seite neu laden.");
        const res = await tx.ammoProduct.updateMany({ where: { id: l.productId, tenantId, stockUnits: l.loaded }, data: { stockUnits: l.counted } });
        if (res.count === 0) throw new AmmoError(`Der Bestand von «${p.name}» hat sich inzwischen geändert (z.B. Ausgabe). Bitte Seite neu laden und nochmals zählen.`);
        await tx.ammoStockMovement.create({
          data: { tenantId, productId: l.productId, kind: "INVENTORY", units: inventoryDelta(l.loaded, l.counted), date: at, source: `Inventur, gezählt ${l.counted}`, note, createdById: ctx.user.id },
        });
      }
    });
  } catch (e) {
    return handle(e);
  }
  const diffs = lines.filter((l) => inventoryDelta(l.loaded, l.counted) !== 0).length;
  await audit({ tenantId, actorId: ctx.user.id, action: "ammo.stock.inventory", entity: "AmmoStockMovement", detail: `${lines.length} Produkte gezählt, ${diffs} mit Differenz` });
  revalidate();
  return ok({ at: at.getTime() }, diffs ? `Inventur gebucht: ${diffs} ${diffs === 1 ? "Differenz" : "Differenzen"}.` : "Inventur gebucht: keine Differenzen.");
}
