"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireModule } from "@/lib/tenant";
import { formatMoney, parseMoneyToCents } from "@/lib/money";
import { createStandaloneFeeInvoice, finalizeStandaloneFeeInvoices, standaloneInvoiceDefaults } from "@/modules/billing/standalone-invoice";
import { appendPaymentNote } from "@/modules/billing/types";
import { formatDateZurich } from "@/lib/time";
import {
  KIOSK_RELEASED_NOTE, UNDO_WINDOW_MS, invoiceCategoryName, invoiceYear, isBatchId, lineClientId, normalizeCart, periodLabel, periodToUtcRange, saleTime, validatePeriod, type Period,
} from "./logic";
import { entryInputSchema, firstIssue, productSchema, type EntryInput } from "./types";

const idSchema = z.string().min(1).max(40);
const NO_RIGHT = "Dafür fehlt dir die Berechtigung.";
const str = (fd: FormData, k: string) => (fd.get(k) === null ? "" : String(fd.get(k)));

const revalidate = () => {
  revalidatePath("/kiosk", "layout");
  revalidatePath("/admin/kiosk", "layout");
};

async function sellCtx() {
  const ctx = await requireModule("kiosk");
  return ctx.can("kiosk.sell") ? ctx : null;
}

async function manageCtx() {
  const ctx = await requireModule("kiosk");
  return ctx.can("kiosk.manage") ? ctx : null;
}

function handle(e: unknown): ActionResult<never> {
  console.error("Schützenstube:", e);
  return fail("Das hat nicht geklappt. Bitte nochmals versuchen.");
}

const isUniqueError = (e: unknown) => typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";

// ---------------------------------------------------------------------------
// Sortiment
// ---------------------------------------------------------------------------

export async function saveProductAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await manageCtx();
  if (!ctx) return fail(NO_RIGHT);
  const priceRaw = str(fd, "price").trim();
  if (!priceRaw || !/^\d+([.,]\d{1,2})?$/.test(priceRaw)) return fail("Bitte einen gültigen Preis eingeben.", { price: "z.B. 4.50" });
  const sortRaw = str(fd, "sortOrder").trim();
  if (sortRaw && !/^-?\d{1,4}$/.test(sortRaw)) return fail("Bitte eine ganze Zahl als Reihenfolge eingeben.", { sortOrder: "z.B. 10" });
  const parsed = productSchema.safeParse({
    name: str(fd, "name"),
    category: str(fd, "category"),
    priceCents: parseMoneyToCents(priceRaw),
    sortOrder: sortRaw ? Math.trunc(Number(sortRaw)) : 0,
    isActive: fd.getAll("isActive").includes("on"),
  });
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) {
      const k = i.path[0] === "priceCents" ? "price" : String(i.path[0]);
      fe[k] ??= i.message;
    }
    return fail(firstIssue(parsed.error), fe);
  }
  const v = parsed.data;
  const id = str(fd, "id");
  const tenantId = ctx.tenant.id;
  try {
    if (id) {
      const r = await db.kioskProduct.updateMany({ where: { id, tenantId }, data: v });
      if (!r.count) return fail("Produkt nicht gefunden.");
    } else {
      await db.kioskProduct.create({ data: { ...v, tenantId } });
    }
    await audit({ tenantId, actorId: ctx.user.id, actorName: ctx.user.name, action: id ? "kiosk.product.update" : "kiosk.product.create", entity: "KioskProduct", entityId: id || undefined, detail: `${v.name} ${formatMoney(v.priceCents)}` });
    revalidate();
    return ok(undefined, id ? "Produkt gespeichert." : "Produkt angelegt.");
  } catch (e) {
    return handle(e);
  }
}

export async function setProductActiveAction(id: string, active: boolean): Promise<ActionResult> {
  const ctx = await manageCtx();
  if (!ctx) return fail(NO_RIGHT);
  if (!idSchema.safeParse(id).success) return fail("Produkt nicht gefunden.");
  const r = await db.kioskProduct.updateMany({ where: { id, tenantId: ctx.tenant.id }, data: { isActive: !!active } });
  if (!r.count) return fail("Produkt nicht gefunden.");
  revalidate();
  return ok(undefined, active ? "Wieder im Angebot." : "Ausgeblendet.");
}

/** Löscht ein Produkt. Bestehende Einträge behalten Name und Preis (Momentaufnahme). */
export async function deleteProductAction(id: string): Promise<ActionResult> {
  const ctx = await manageCtx();
  if (!ctx) return fail(NO_RIGHT);
  if (!idSchema.safeParse(id).success) return fail("Produkt nicht gefunden.");
  const p = await db.kioskProduct.findFirst({ where: { id, tenantId: ctx.tenant.id }, select: { id: true, name: true } });
  if (!p) return fail("Produkt nicht gefunden.");
  await db.kioskProduct.delete({ where: { id: p.id } });
  await audit({ tenantId: ctx.tenant.id, actorId: ctx.user.id, actorName: ctx.user.name, action: "kiosk.product.delete", entity: "KioskProduct", entityId: p.id, detail: p.name });
  revalidate();
  return ok(undefined, "Produkt gelöscht.");
}

// ---------------------------------------------------------------------------
// Theke
// ---------------------------------------------------------------------------

/**
 * Konsumationen aufschreiben. Idempotent über `batchId` (vom Gerät erzeugt): jede Position erhält
 * die clientId «batchId:n». Wird dieselbe Erfassung erneut gesendet (Doppelklick, Wiederholung nach
 * Verbindungsabbruch), meldet die Aktion Erfolg, ohne doppelt zu buchen.
 * Gäste zahlen immer bar; Mitglieder wahlweise bar oder auf Rechnung.
 */
export async function recordEntriesAction(input: EntryInput): Promise<ActionResult<{ batchId: string; totalCents: number; duplicate: boolean }>> {
  const ctx = await sellCtx();
  if (!ctx) return fail(NO_RIGHT);
  const parsed = entryInputSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const v = parsed.data;
  const tenantId = ctx.tenant.id;

  const existing = await db.kioskEntry.findMany({ where: { clientId: { startsWith: `${v.batchId}:` } }, select: { tenantId: true, totalCents: true } });
  if (existing.length) {
    if (existing.some((e) => e.tenantId !== tenantId)) return fail("Ungültige Erfassung.");
    return ok({ batchId: v.batchId, totalCents: existing.reduce((s, e) => s + e.totalCents, 0), duplicate: true }, "Bereits erfasst.");
  }

  let who = "Gast";
  if (v.userId) {
    const m = await db.membership.findFirst({ where: { tenantId, userId: v.userId, status: { not: "LEFT" }, user: { deletedAt: null } }, select: { user: { select: { name: true } } } });
    if (!m) return fail("Mitglied nicht gefunden oder ausgetreten.");
    who = m.user.name;
  } else if (v.guestName) {
    who = `Gast ${v.guestName}`;
  }
  const paidCash = v.userId ? v.paidCash : true;

  // Offline gespeicherte Erfassungen zählen zum Zeitpunkt des Verkaufs (Kassentag, Abrechnungszeitraum),
  // nicht zum Zeitpunkt der Übertragung. Ausnahme: wurden für dieses Mitglied seither schon Einträge
  // verrechnet, gilt «jetzt», damit die Konsumation nicht in einem bereits abgerechneten Zeitraum hängen bleibt.
  const now = new Date();
  let createdAt = saleTime(v.soldAt, now);
  if (v.userId && !paidCash && now.getTime() - createdAt.getTime() > 60_000) {
    const billedSince = await db.kioskEntry.count({ where: { tenantId, userId: v.userId, billedInvoiceId: { not: null }, createdAt: { gte: createdAt } } });
    if (billedSince) createdAt = now;
  }

  const lines = normalizeCart(v.lines);
  // Auch inzwischen ausgeblendete Produkte annehmen: eine offline gespeicherte Erfassung soll nicht verloren gehen.
  // Die Theke zeigt nur aktive Produkte; gelöschte Produkte lassen sich nicht mehr buchen.
  const products = await db.kioskProduct.findMany({ where: { tenantId, id: { in: lines.map((l) => l.productId) } }, select: { id: true, name: true, priceCents: true } });
  const byId = new Map(products.map((p) => [p.id, p]));
  if (lines.some((l) => !byId.has(l.productId))) return fail("Ein Produkt gibt es nicht mehr. Bitte die Seite neu laden.");

  const data = lines.map((l, i) => {
    const p = byId.get(l.productId)!;
    return {
      tenantId, userId: v.userId, guestName: v.userId ? null : v.guestName, productId: p.id, productName: p.name.slice(0, 191),
      quantity: l.quantity, unitPriceCents: p.priceCents, totalCents: p.priceCents * l.quantity, createdById: ctx.user.id,
      clientId: lineClientId(v.batchId, i), paidCash, createdAt,
    };
  });
  const totalCents = data.reduce((s, d) => s + d.totalCents, 0);
  try {
    await db.kioskEntry.createMany({ data });
  } catch (e) {
    if (isUniqueError(e)) {
      const again = await db.kioskEntry.count({ where: { tenantId, clientId: { startsWith: `${v.batchId}:` } } });
      if (again) return ok({ batchId: v.batchId, totalCents, duplicate: true }, "Bereits erfasst.");
    }
    return handle(e);
  }
  revalidate();
  return ok({ batchId: v.batchId, totalCents, duplicate: false }, `${formatMoney(totalCents)} ${paidCash ? "bar" : "aufgeschrieben"}: ${who}.`);
}

/** Letzte Erfassung rückgängig machen (nur eigene, unverrechnete, höchstens 2 Minuten alt). */
export async function undoBatchAction(batchId: string): Promise<ActionResult> {
  const ctx = await sellCtx();
  if (!ctx) return fail(NO_RIGHT);
  if (!isBatchId(batchId)) return fail("Erfassung nicht gefunden.");
  const tenantId = ctx.tenant.id;
  const where = {
    tenantId, clientId: { startsWith: `${batchId}:` }, createdById: ctx.user.id, billedInvoiceId: null,
    createdAt: { gte: new Date(Date.now() - UNDO_WINDOW_MS) },
  };
  try {
    const rows = await db.kioskEntry.findMany({ where, select: { totalCents: true, productName: true, quantity: true } });
    if (!rows.length) return fail("Rückgängig ist nicht mehr möglich (älter als 2 Minuten oder bereits verrechnet).");
    const r = await db.kioskEntry.deleteMany({ where });
    const total = rows.reduce((s, x) => s + x.totalCents, 0);
    await audit({
      tenantId, actorId: ctx.user.id, actorName: ctx.user.name, action: "kiosk.entry.undo", entity: "KioskEntry", entityId: batchId,
      detail: `${r.count} Position(en), ${formatMoney(total)}: ${rows.map((x) => `${x.quantity}× ${x.productName}`).join(", ")}`,
    });
    revalidate();
    return ok(undefined, "Erfassung rückgängig gemacht.");
  } catch (e) {
    return handle(e);
  }
}

// ---------------------------------------------------------------------------
// Verwaltung: Storno, Abrechnung
// ---------------------------------------------------------------------------

/** Storniert (löscht) einen noch nicht verrechneten Eintrag. */
export async function stornoEntryAction(id: string): Promise<ActionResult> {
  const ctx = await manageCtx();
  if (!ctx) return fail(NO_RIGHT);
  if (!idSchema.safeParse(id).success) return fail("Eintrag nicht gefunden.");
  const tenantId = ctx.tenant.id;
  const e = await db.kioskEntry.findFirst({ where: { id, tenantId }, select: { id: true, productName: true, quantity: true, totalCents: true, billedInvoiceId: true, userId: true, guestName: true, paidCash: true } });
  if (!e) return fail("Eintrag nicht gefunden.");
  if (e.billedInvoiceId) return fail("Bereits verrechnet: bitte die Rechnung stornieren und den Eintrag danach freigeben.");
  const r = await db.kioskEntry.deleteMany({ where: { id, tenantId, billedInvoiceId: null } });
  if (!r.count) return fail("Der Eintrag wurde inzwischen verrechnet.");
  await audit({
    tenantId, actorId: ctx.user.id, actorName: ctx.user.name, action: "kiosk.entry.storno", entity: "KioskEntry", entityId: id,
    detail: `${e.quantity}× ${e.productName}, ${formatMoney(e.totalCents)}${e.paidCash ? " (bar)" : ""}${e.guestName ? `, Gast ${e.guestName}` : ""}`,
  });
  revalidate();
  return ok(undefined, "Eintrag storniert.");
}

/**
 * Konsumationen verrechnen: pro Mitglied eine Beitragsrechnung «Schützenstube <Zeitraum>» über alle
 * unverrechneten, nicht bar bezahlten Einträge im Zeitraum. Nummer und QR-Referenz wie die übrigen
 * Einzelrechnungen (Ersatzabgabe). Die Einträge werden pro Mitglied mit SELECT … FOR UPDATE gesperrt
 * und in derselben Transaktion mit der Rechnung verknüpft: zwei gleichzeitige Läufe verrechnen nie doppelt.
 * `userIds` stammt aus der bestätigten Vorschau; die Beträge werden serverseitig neu berechnet.
 */
export async function billKioskAction(input: { from: string; to: string; userIds: string[] }): Promise<ActionResult<{ count: number; totalCents: number }>> {
  const ctx = await manageCtx();
  if (!ctx) return fail(NO_RIGHT);
  const period: Period = { from: String(input?.from ?? ""), to: String(input?.to ?? "") };
  const pErr = validatePeriod(period);
  if (pErr) return fail(pErr);
  const ids = z.array(idSchema).min(1).max(5000).safeParse(input?.userIds);
  if (!ids.success) return fail("Keine Mitglieder ausgewählt.");
  if (!ctx.hasModule("billing")) return fail("Bitte zuerst das Modul «Mitgliederbeiträge» aktivieren: die Rechnungen erscheinen dort und unter «Zahlungen».");
  const tenantId = ctx.tenant.id;
  const year = invoiceYear(period);
  const defaults = await standaloneInvoiceDefaults(db, tenantId, year);
  if (!defaults.profileComplete) return fail("Bitte zuerst das Rechnungsprofil (Zahlungsempfänger und IBAN) ausfüllen.");

  const { start, end } = periodToUtcRange(period);
  const categoryName = invoiceCategoryName(period);
  // Nur aktive Konten (gelöschte Benutzer lassen sich nicht verrechnen).
  const users = await db.user.findMany({ where: { id: { in: [...new Set(ids.data)] }, deletedAt: null }, select: { id: true } });
  const userIds = users.map((u) => u.id).sort();
  if (!userIds.length) return fail("Keine verrechenbaren Mitglieder ausgewählt.");

  try {
    const created = await db.$transaction(async (tx) => {
      const out = [];
      for (const userId of userIds) {
        const locked = await tx.$queryRaw<Array<{ id: string; totalCents: number | bigint }>>`
          SELECT id, totalCents FROM \`KioskEntry\`
          WHERE tenantId = ${tenantId} AND userId = ${userId} AND billedInvoiceId IS NULL AND paidCash = false
            AND createdAt >= ${start} AND createdAt < ${end}
          ORDER BY id FOR UPDATE`;
        if (!locked.length) continue;
        const amountCents = locked.reduce((s, r) => s + Number(r.totalCents), 0);
        if (amountCents <= 0) continue;
        const inv = await createStandaloneFeeInvoice(tx, { tenantId, userId, year, categoryName, amountCents });
        const upd = await tx.kioskEntry.updateMany({
          where: { tenantId, id: { in: locked.map((r) => r.id) }, billedInvoiceId: null, paidCash: false },
          data: { billedInvoiceId: inv.id },
        });
        if (upd.count !== locked.length) throw new Error("Einträge wurden gleichzeitig geändert.");
        out.push(inv);
      }
      return out;
    }, { maxWait: 15_000, timeout: 120_000 });
    if (!created.length) return fail("Keine offenen Konsumationen im Zeitraum (bereits verrechnet oder bar bezahlt).");
    await finalizeStandaloneFeeInvoices(tenantId, created);
    const total = created.reduce((s, i) => s + i.amountCents, 0);
    await audit({
      tenantId, actorId: ctx.user.id, actorName: ctx.user.name, action: "kiosk.bill", entity: "KioskEntry", entityId: tenantId,
      detail: `Schützenstube ${periodLabel(period)}: ${created.length} Rechnungen, total ${formatMoney(total)} (${created.map((i) => i.number).join(", ")})`.slice(0, 1900),
    });
    revalidate();
    revalidatePath("/admin/billing");
    revalidatePath("/admin/payments");
    revalidatePath("/payments");
    return ok({ count: created.length, totalCents: total }, `${created.length} ${created.length === 1 ? "Rechnung" : "Rechnungen"} erstellt (total ${formatMoney(total)}).`);
  } catch (e) {
    return handle(e);
  }
}

/**
 * Einträge stornierter Rechnungen wieder freigeben (danach erneut verrechenbar).
 * Die Rechnung wird dabei markiert (Zahlungsnotiz) und kann danach nicht mehr reaktiviert werden.
 * Nach dem Storno online bezahlte Rechnungen bleiben verknüpft: die Konsumation ist bezahlt.
 */
export async function releaseCancelledAction(): Promise<ActionResult<{ count: number }>> {
  const ctx = await manageCtx();
  if (!ctx) return fail(NO_RIGHT);
  const tenantId = ctx.tenant.id;
  try {
    const billed = await db.kioskEntry.findMany({ where: { tenantId, billedInvoiceId: { not: null } }, distinct: ["billedInvoiceId"], select: { billedInvoiceId: true } });
    const ids = billed.map((b) => b.billedInvoiceId!);
    const cancelled = ids.length
      ? await db.feeInvoice.findMany({ where: { tenantId, id: { in: ids }, status: "CANCELLED", payments: { none: { status: "PAID" } } }, select: { id: true, number: true } })
      : [];
    if (!cancelled.length) return fail("Keine Einträge aus stornierten Rechnungen.");
    const note = `${KIOSK_RELEASED_NOTE} ${formatDateZurich(new Date(), { weekday: undefined })}`;
    const released = await db.$transaction(async (tx) => {
      const out: Array<{ number: string; count: number }> = [];
      for (const c of cancelled) {
        // Status in der Transaktion sperren und erneut prüfen (inzwischen reaktiviert oder online bezahlt?).
        const [row] = await tx.$queryRaw<Array<{ status: string; paymentNote: string | null }>>`
          SELECT status, paymentNote FROM \`FeeInvoice\` WHERE id = ${c.id} AND tenantId = ${tenantId} FOR UPDATE`;
        if (!row || row.status !== "CANCELLED") continue;
        if (await tx.payment.count({ where: { feeInvoiceId: c.id, status: "PAID" } })) continue;
        const r = await tx.kioskEntry.updateMany({ where: { tenantId, billedInvoiceId: c.id }, data: { billedInvoiceId: null } });
        await tx.feeInvoice.update({ where: { id: c.id }, data: { paymentNote: appendPaymentNote(row.paymentNote, note) } });
        out.push({ number: c.number, count: r.count });
      }
      return out;
    });
    const count = released.reduce((s, r) => s + r.count, 0);
    if (!released.length) return fail("Keine Einträge aus stornierten Rechnungen.");
    await audit({
      tenantId, actorId: ctx.user.id, actorName: ctx.user.name, action: "kiosk.release", entity: "KioskEntry", entityId: tenantId,
      detail: `${count} Einträge freigegeben (${released.map((c) => c.number).join(", ")})`.slice(0, 1900),
    });
    revalidate();
    revalidatePath("/admin/billing", "layout");
    revalidatePath("/admin/payments");
    return ok({ count }, `${count} ${count === 1 ? "Eintrag" : "Einträge"} wieder offen.`);
  } catch (e) {
    return handle(e);
  }
}
