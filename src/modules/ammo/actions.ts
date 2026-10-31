"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { parseMoneyToCents } from "@/lib/money";
import { requireAmmo, requireAmmoAdmin } from "./guard";
import { AmmoError, createOrder, issueOrder } from "./service";
import { bookStock } from "./stock-service";
import { audit } from "@/lib/audit";
import { orderLinesSchema, orderNoteSchema, productSchema, settingsSchema, type OrderLineInput } from "./types";

const revalidate = () => {
  revalidatePath("/ammo");
  revalidatePath("/admin/ammo", "layout");
};

const idSchema = z.string().min(1).max(40);

function handle(e: unknown): ActionResult<never> {
  if (e instanceof AmmoError) return fail(e.message);
  console.error("Munition:", e);
  return fail("Das hat nicht geklappt. Bitte nochmals versuchen.");
}

const flag = (fd: FormData, name: string) => fd.get(name) === "on";

// --- Einstellungen -------------------------------------------------------------

export async function saveAmmoSettingsAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await requireAmmoAdmin();
  const parsed = settingsSchema.safeParse({
    onSiteOnly: flag(fd, "onSiteOnly"),
    requireIdCheck: flag(fd, "requireIdCheck"),
    approvalRequired: flag(fd, "approvalRequired"),
    invoicePrefix: fd.get("invoicePrefix") ?? "",
    invoiceDueDays: fd.get("invoiceDueDays") ?? "",
    maxRoundsPerOrder: fd.get("maxRoundsPerOrder") ?? "",
    note: fd.get("note") ?? "",
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Ungültige Eingabe");
  const s = parsed.data;
  const data = { ...s, note: s.note ?? null };
  await db.ammoSettings.upsert({ where: { tenantId: ctx.tenant.id }, create: { tenantId: ctx.tenant.id, ...data }, update: data });
  revalidate();
  return ok(undefined, "Einstellungen gespeichert.");
}

// --- Sortiment -------------------------------------------------------------------

/**
 * Preis streng lesen: «15», «15.50», «15,5», «15.–», «CHF 1'200.00», «Fr. 12.50». Alles andere → null
 * (nie stillschweigend 0, sonst würde ohne Rechnung verkauft). Gleiche Regeln wie moneyField in bookings/actions.ts.
 */
function parsePriceStrict(raw: string): number | null {
  const clean = raw.replace(/CHF|EUR|Fr\.?|['’\s]/gi, "").replace(/[.,][–-]+$/, "");
  if (!/^\d+([.,]\d{0,2})?$/.test(clean)) return null;
  return parseMoneyToCents(clean);
}

/** Leerer Bestand = nicht geführt (null), sonst ganze Zahl; undefined = unlesbar. */
function parseLoadedStock(v: FormDataEntryValue | null): number | null | undefined {
  const s = String(v ?? "").trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isInteger(n) ? n : undefined;
}

export async function saveProductAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await requireAmmoAdmin();
  const id = fd.get("id") ? String(fd.get("id")) : null;
  const rawPrice = String(fd.get("price") ?? "").trim();
  if (!rawPrice) return fail("Preis fehlt.", { price: "Preis fehlt." });
  const priceCents = parsePriceStrict(rawPrice);
  if (priceCents === null) return fail("Ungültiger Betrag.", { price: "Ungültiger Betrag." });
  const parsed = productSchema.safeParse({
    name: fd.get("name") ?? "",
    caliber: fd.get("caliber") ?? "",
    manufacturer: fd.get("manufacturer") ?? "",
    description: fd.get("description") ?? "",
    unitLabel: fd.get("unitLabel") ?? "",
    roundsPerUnit: fd.get("roundsPerUnit") ?? "",
    priceCents,
    stockUnits: fd.get("stockUnits") ?? "",
    isActive: fd.get("isActive") !== "off",
    sortOrder: fd.get("sortOrder") || 0,
    fundingType: fd.get("fundingType") || "COMMERCIAL",
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path[0] === "priceCents" ? "price" : String(issue?.path[0] ?? "");
    return fail(issue?.message ?? "Ungültige Eingabe", field ? { [field]: issue?.message ?? "" } : undefined);
  }
  const p = parsed.data;
  const data = { ...p, manufacturer: p.manufacturer ?? null, description: p.description ?? null };
  const tenantId = ctx.tenant.id;
  try {
    if (id) {
      // Bestand nie blind überschreiben: Ausgaben, Stornos und Zu-/Abgänge ändern ihn, während das Formular offen ist.
      // Unverändertes Feld → Bestand bleibt unangetastet; geändertes Feld → nur, wenn der geladene Wert noch stimmt,
      // und die Differenz erscheint als Korrektur im Bestandsjournal.
      const { stockUnits, ...rest } = data;
      const loaded = fd.has("stockUnitsLoaded") ? parseLoadedStock(fd.get("stockUnitsLoaded")) : undefined;
      const stockChanged = loaded !== undefined && stockUnits !== loaded;
      const result = await db.$transaction(async (tx) => {
        const res = await tx.ammoProduct.updateMany({
          where: { id, tenantId, ...(stockChanged ? { stockUnits: loaded } : {}) },
          data: stockChanged ? data : rest,
        });
        if (res.count === 0) return "conflict" as const;
        const diff = stockChanged ? (stockUnits ?? 0) - (loaded ?? 0) : 0;
        if (stockChanged && diff !== 0) {
          await tx.ammoStockMovement.create({
            data: {
              tenantId, productId: id, kind: "CORRECTION", units: diff, createdById: ctx.user.id,
              note: stockUnits === null ? "Bestand nicht mehr geführt (Sortiment)" : loaded === null ? "Bestand erfasst (Sortiment)" : "Bestand im Sortiment geändert",
            },
          });
        }
        return "ok" as const;
      });
      if (result === "conflict") {
        const exists = stockChanged && (await db.ammoProduct.count({ where: { id, tenantId } })) > 0;
        if (!exists) return fail("Produkt nicht gefunden.");
        const msg = "Der Bestand hat sich inzwischen geändert. Bitte «Bearbeiten» neu öffnen oder den Bestand mit Zugang/Abgang korrigieren.";
        return fail(msg, { stockUnits: msg });
      }
    } else {
      await db.$transaction(async (tx) => {
        const created = await tx.ammoProduct.create({ data: { ...data, tenantId }, select: { id: true } });
        if (data.stockUnits) {
          await tx.ammoStockMovement.create({ data: { tenantId, productId: created.id, kind: "CORRECTION", units: data.stockUnits, createdById: ctx.user.id, note: "Anfangsbestand" } });
        }
      });
    }
  } catch (e) {
    return handle(e);
  }
  revalidate();
  return ok(undefined, id ? "Produkt gespeichert." : "Produkt angelegt.");
}

export async function setProductActiveAction(id: string, isActive: boolean): Promise<ActionResult> {
  const ctx = await requireAmmoAdmin();
  if (!idSchema.safeParse(id).success) return fail("Ungültige Anfrage");
  const res = await db.ammoProduct.updateMany({ where: { id, tenantId: ctx.tenant.id }, data: { isActive } });
  if (res.count === 0) return fail("Produkt nicht gefunden.");
  revalidate();
  return ok(undefined, isActive ? "Produkt wieder im Angebot." : "Produkt ausgeblendet.");
}

export async function deleteProductAction(id: string): Promise<ActionResult> {
  const ctx = await requireAmmoAdmin();
  if (!idSchema.safeParse(id).success) return fail("Ungültige Anfrage");
  const p = await db.ammoProduct.findFirst({ where: { id, tenantId: ctx.tenant.id }, include: { _count: { select: { items: true } } } });
  if (!p) return fail("Produkt nicht gefunden.");
  if (p._count.items > 0) {
    // Bestellungen behalten ihren Snapshot; das Produkt wird nur ausgeblendet, damit Auswertungen erhalten bleiben.
    await db.ammoProduct.updateMany({ where: { id, tenantId: ctx.tenant.id }, data: { isActive: false } });
    revalidate();
    return ok(undefined, "Das Produkt kommt in Bestellungen vor und wurde deshalb nur ausgeblendet.");
  }
  await db.ammoProduct.deleteMany({ where: { id, tenantId: ctx.tenant.id } });
  revalidate();
  return ok(undefined, "Produkt gelöscht.");
}

/**
 * Schnellbuchung im Sortiment: delta > 0 = Wareneingang, delta < 0 = Korrektur (Abgang). Nie unter null.
 * Ohne geführten Bestand setzt ein Zugang den Bestand. Jede Buchung erscheint im Bestandsjournal.
 */
export async function adjustStockAction(id: string, delta: number): Promise<ActionResult<{ stockUnits: number }>> {
  const ctx = await requireAmmoAdmin();
  if (!idSchema.safeParse(id).success || !Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 1_000_000) return fail("Ungültige Menge.");
  try {
    const res = await db.$transaction((tx) =>
      bookStock(tx, {
        tenantId: ctx.tenant.id, productId: id, kind: delta > 0 ? "RECEIPT" : "CORRECTION", units: delta, createdById: ctx.user.id,
        source: delta > 0 ? "Sortiment (Schnellbuchung)" : null, note: delta < 0 ? "Abgang (Sortiment)" : null,
      }),
    );
    await audit({ tenantId: ctx.tenant.id, actorId: ctx.user.id, action: "ammo.stock.adjust", entity: "AmmoProduct", entityId: id, detail: `${delta > 0 ? "+" : ""}${delta}` });
    revalidate();
    return ok({ stockUnits: res.stockUnits }, delta > 0 ? `Zugang ${delta} gebucht.` : `Abgang ${-delta} gebucht.`);
  } catch (e) {
    return handle(e);
  }
}

// --- Bestellung (Mitglied) -----------------------------------------------------------

export async function placeOrderAction(input: { lines: OrderLineInput[]; note?: string; onSiteConfirmed: boolean }): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireAmmo();
  const lines = orderLinesSchema.safeParse(input.lines);
  const note = orderNoteSchema.safeParse(input.note ?? "");
  if (!lines.success) return fail("Ungültige Mengen.");
  if (!note.success) return fail(note.error.issues[0]?.message ?? "Bemerkung zu lang.");
  const settings = await db.ammoSettings.findUnique({ where: { tenantId: ctx.tenant.id }, select: { onSiteOnly: true } });
  if ((settings?.onSiteOnly ?? true) && !input.onSiteConfirmed) return fail("Bitte bestätige, dass die Munition auf dem Platz verbraucht wird.");
  try {
    const order = await createOrder(ctx.tenant.id, ctx.user.id, lines.data, note.data ?? null);
    revalidate();
    return ok({ id: order.id }, "Bestellung aufgenommen. Die Rechnung erhältst du bei der Ausgabe.");
  } catch (e) {
    return handle(e);
  }
}

export async function cancelMyOrderAction(id: string): Promise<ActionResult> {
  const ctx = await requireAmmo();
  if (!idSchema.safeParse(id).success) return fail("Ungültige Anfrage");
  const res = await db.ammoOrder.updateMany({
    where: { id, tenantId: ctx.tenant.id, userId: ctx.user.id, status: { in: ["ORDERED", "APPROVED"] } },
    data: { status: "CANCELLED" },
  });
  if (res.count === 0) return fail("Diese Bestellung kann nicht mehr storniert werden.");
  revalidate();
  return ok(undefined, "Bestellung storniert.");
}

// --- Verwaltung: Freigabe, Ausgabe, Storno -------------------------------------------

export async function approveOrderAction(id: string): Promise<ActionResult> {
  const ctx = await requireAmmoAdmin();
  if (!idSchema.safeParse(id).success) return fail("Ungültige Anfrage");
  const res = await db.ammoOrder.updateMany({ where: { id, tenantId: ctx.tenant.id, status: "ORDERED" }, data: { status: "APPROVED" } });
  if (res.count === 0) return fail("Nur offene Bestellungen können freigegeben werden.");
  revalidate();
  return ok(undefined, "Bestellung freigegeben.");
}

export async function issueOrderAction(id: string, idChecked: boolean): Promise<ActionResult<{ invoiceNumber: string | null }>> {
  const ctx = await requireAmmoAdmin();
  if (!idSchema.safeParse(id).success) return fail("Ungültige Anfrage");
  try {
    const res = await issueOrder(ctx.tenant.id, id, ctx.user.id, idChecked === true);
    revalidate();
    return ok({ invoiceNumber: res.invoiceNumber }, res.invoiceNumber ? `Ausgegeben. Rechnung ${res.invoiceNumber} erstellt.` : "Ausgegeben.");
  } catch (e) {
    return handle(e);
  }
}

/** Direktverkauf an der Theke: Bestellung für ein Mitglied anlegen und sofort ausgeben. */
export async function counterSaleAction(input: { userId: string; lines: OrderLineInput[]; idChecked: boolean; note?: string }): Promise<ActionResult<{ id: string; invoiceNumber: string | null }>> {
  const ctx = await requireAmmoAdmin();
  const lines = orderLinesSchema.safeParse(input.lines);
  const note = orderNoteSchema.safeParse(input.note ?? "");
  if (!idSchema.safeParse(input.userId).success || !lines.success) return fail("Ungültige Eingabe.");
  if (!note.success) return fail(note.error.issues[0]?.message ?? "Bemerkung zu lang.");
  const member = await db.membership.findUnique({ where: { userId_tenantId: { userId: input.userId, tenantId: ctx.tenant.id } }, select: { id: true } });
  if (!member) return fail("Mitglied nicht gefunden.");
  const settings = await db.ammoSettings.findUnique({ where: { tenantId: ctx.tenant.id }, select: { requireIdCheck: true } });
  if ((settings?.requireIdCheck ?? true) && !input.idChecked) return fail("Bitte zuerst die Berechtigung prüfen und bestätigen.");
  let orderId: string | null = null;
  try {
    const order = await createOrder(ctx.tenant.id, input.userId, lines.data, note.data ?? null, { status: "APPROVED" });
    orderId = order.id;
    const res = await issueOrder(ctx.tenant.id, order.id, ctx.user.id, input.idChecked === true);
    revalidate();
    return ok({ id: order.id, invoiceNumber: res.invoiceNumber }, res.invoiceNumber ? `Verkauft und ausgegeben. Rechnung ${res.invoiceNumber}.` : "Verkauft und ausgegeben.");
  } catch (e) {
    // Ausgabe gescheitert (z.B. Bestand): die eben angelegte Bestellung nicht offen liegen lassen.
    if (orderId) await db.ammoOrder.updateMany({ where: { id: orderId, tenantId: ctx.tenant.id, status: { in: ["ORDERED", "APPROVED"] } }, data: { status: "CANCELLED", paymentNote: "Direktverkauf abgebrochen" } });
    revalidate();
    return handle(e);
  }
}

/**
 * Storno durch die Verwaltung. Offene Bestellungen: einfach storniert (es wurde nichts abgebucht).
 * Ausgegebene Bestellungen: Rücknahme – Rechnung storniert und, mit `restock`, Bestand zurückgebucht.
 */
export async function cancelOrderAction(id: string, opts?: { restock?: boolean }): Promise<ActionResult> {
  const ctx = await requireAmmoAdmin();
  if (!idSchema.safeParse(id).success) return fail("Ungültige Anfrage");
  const tenantId = ctx.tenant.id;
  try {
    const msg = await db.$transaction(async (tx) => {
      const order = await tx.ammoOrder.findFirst({ where: { id, tenantId }, include: { items: true } });
      if (!order) throw new AmmoError("Bestellung nicht gefunden.");
      if (order.status === "CANCELLED") throw new AmmoError("Die Bestellung ist bereits storniert.");
      if (order.status !== "ISSUED") {
        const res = await tx.ammoOrder.updateMany({ where: { id, tenantId, status: { in: ["ORDERED", "APPROVED"] } }, data: { status: "CANCELLED" } });
        if (res.count === 0) throw new AmmoError("Die Bestellung wurde inzwischen bearbeitet.");
        return "Bestellung storniert.";
      }
      if (order.paymentStatus === "PAID") throw new AmmoError("Die Rechnung ist bereits bezahlt. Zuerst als unbezahlt markieren.");
      const res = await tx.ammoOrder.updateMany({ where: { id, tenantId, status: "ISSUED" }, data: { status: "CANCELLED", paymentStatus: "CANCELLED" } });
      if (res.count === 0) throw new AmmoError("Die Bestellung wurde inzwischen bearbeitet.");
      if (opts?.restock) {
        for (const it of order.items) {
          if (!it.productId) continue;
          const back = await tx.ammoProduct.updateMany({ where: { id: it.productId, tenantId, stockUnits: { not: null } }, data: { stockUnits: { increment: it.quantity } } });
          if (back.count > 0) {
            await tx.ammoStockMovement.create({
              data: { tenantId, productId: it.productId, kind: "RETURN", units: it.quantity, orderId: order.id, source: order.invoiceNumber ? `Storno Rechnung ${order.invoiceNumber}` : "Storno", createdById: ctx.user.id },
            });
          }
        }
        return "Rücknahme gebucht, Bestand zurückgebucht, Rechnung storniert.";
      }
      return "Bestellung und Rechnung storniert.";
    });
    revalidate();
    return ok(undefined, msg);
  } catch (e) {
    return handle(e);
  }
}

// --- Rechnung: Zahlungsstatus --------------------------------------------------------

const paymentSchema = z.object({
  status: z.enum(["UNPAID", "PAID", "CANCELLED"]),
  note: z.string().trim().max(191, "Notiz: maximal 191 Zeichen.").optional(),
});

export async function setPaymentStatusAction(id: string, status: "UNPAID" | "PAID" | "CANCELLED", note?: string): Promise<ActionResult> {
  const ctx = await requireAmmoAdmin();
  const parsed = paymentSchema.safeParse({ status, note });
  if (!idSchema.safeParse(id).success || !parsed.success) return fail(parsed.success ? "Ungültige Anfrage" : (parsed.error.issues[0]?.message ?? "Ungültige Eingabe"));
  const order = await db.ammoOrder.findFirst({ where: { id, tenantId: ctx.tenant.id }, select: { invoiceNumber: true, status: true, paymentStatus: true, paidAt: true } });
  if (!order || !order.invoiceNumber) return fail("Zu dieser Bestellung gibt es keine Rechnung.");
  if (order.status !== "ISSUED") return fail("Die Bestellung ist storniert; der Zahlungsstatus lässt sich nicht mehr ändern.");
  const n = parsed.data.note;
  await db.ammoOrder.updateMany({
    where: { id, tenantId: ctx.tenant.id },
    data: {
      paymentStatus: parsed.data.status,
      paidAt: parsed.data.status === "PAID" ? (order.paymentStatus === "PAID" && order.paidAt ? order.paidAt : new Date()) : null,
      ...(n !== undefined ? { paymentNote: n || null } : {}),
    },
  });
  revalidate();
  return ok(undefined, parsed.data.status === "PAID" ? "Als bezahlt markiert." : parsed.data.status === "UNPAID" ? "Als unbezahlt markiert." : "Rechnung storniert.");
}

export async function savePaymentNoteAction(id: string, note: string): Promise<ActionResult> {
  const ctx = await requireAmmoAdmin();
  const parsed = z.string().trim().max(191, "Notiz: maximal 191 Zeichen.").safeParse(note);
  if (!idSchema.safeParse(id).success || !parsed.success) return fail(parsed.success ? "Ungültige Anfrage" : (parsed.error.issues[0]?.message ?? "Ungültige Eingabe"));
  const res = await db.ammoOrder.updateMany({ where: { id, tenantId: ctx.tenant.id }, data: { paymentNote: parsed.data || null } });
  if (res.count === 0) return fail("Bestellung nicht gefunden.");
  revalidate();
  return ok(undefined, "Notiz gespeichert.");
}
