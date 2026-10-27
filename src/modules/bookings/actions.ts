"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireModule, requirePermission } from "@/lib/tenant";
import { encryptJson, decryptJson } from "@/lib/crypto";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { zurichToUtc } from "@/lib/time";
import { parseMoneyToCents } from "@/lib/money";
import { getBookingSettings, getResource, getSlotsForDay, expireUnpaidOnlineBookings } from "./queries";
import { quotePrice } from "./pricing";
import { PROVIDER_FIELDS, providerKeys, resourceSchema, settingsSchema, type DurationOption, type PaymentProviderKey } from "./types";
import { ensureInvoiceForBooking } from "./invoice";
import { startOnlinePayment } from "./payment-flow";

// ---------------------------------------------------------------------------
// Mitglieder
// ---------------------------------------------------------------------------

const createBookingSchema = z.object({
  resourceId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  durationMinutes: z.coerce.number().int().min(5),
  paymentMethod: z.enum(["INVOICE", "ONLINE"]).optional(),
  note: z.string().trim().max(300).optional(),
});

export async function createBookingAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireModule("bookings");
  const parsed = createBookingSchema.safeParse({
    resourceId: formData.get("resourceId"),
    date: formData.get("date"),
    time: formData.get("time"),
    durationMinutes: formData.get("durationMinutes"),
    paymentMethod: formData.get("paymentMethod") || undefined,
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return fail("Bitte Ressource, Datum, Zeit und Dauer wählen.");
  const { resourceId, date, time, durationMinutes, note } = parsed.data;

  const [settings, resource] = await Promise.all([getBookingSettings(ctx.tenant.id), getResource(ctx.tenant.id, resourceId)]);
  if (!resource || !resource.isActive) return fail("Ressource nicht verfügbar.");
  const options = resource.durationOptions ?? settings.durationOptions;
  const option = options.find((o) => o.minutes === durationMinutes);
  if (!option) return fail("Diese Dauer ist nicht buchbar.");

  await expireUnpaidOnlineBookings(ctx.tenant.id);
  const slots = await getSlotsForDay(ctx.tenant.id, resource, settings, date, durationMinutes);
  const slot = slots.find((s) => s.time === time);
  if (!slot) return fail("Diese Zeit liegt ausserhalb der Öffnungszeiten.");
  if (!slot.available) return fail(`Dieser Termin ist nicht verfügbar (${slot.reason}).`);

  const quote = quotePrice(option, slot.startsAt, settings);
  let paymentMethod: "NONE" | "INVOICE" | "ONLINE" = "NONE";
  if (quote.totalCents > 0) {
    const allowed: Array<"INVOICE" | "ONLINE"> = [];
    if (settings.allowInvoice) allowed.push("INVOICE");
    if (settings.allowOnline && settings.onlineProvider !== "NONE") allowed.push("ONLINE");
    if (allowed.length === 0) return fail("Für diesen Verein ist keine Zahlungsart eingerichtet. Bitte Admin kontaktieren.");
    const chosen = parsed.data.paymentMethod && allowed.includes(parsed.data.paymentMethod) ? parsed.data.paymentMethod : allowed.length === 1 ? allowed[0]! : null;
    if (!chosen) return fail("Bitte Zahlungsart wählen.");
    paymentMethod = chosen;
  }

  const status = settings.approvalRequired ? "PENDING" : "CONFIRMED";
  const booking = await db.booking.create({
    data: {
      tenantId: ctx.tenant.id,
      resourceId,
      userId: ctx.user.id,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      durationMinutes,
      status,
      paymentMethod,
      paymentStatus: paymentMethod === "NONE" ? "NOT_REQUIRED" : "UNPAID",
      basePriceCents: quote.basePriceCents,
      discountCents: quote.discountCents,
      discountReason: quote.discountReason,
      totalCents: quote.totalCents,
      currency: settings.currency,
      note: note ?? null,
      confirmedAt: status === "CONFIRMED" ? new Date() : null,
    },
  });

  if (status === "CONFIRMED" && paymentMethod === "INVOICE") await ensureInvoiceForBooking(booking.id);

  revalidatePath("/bookings");
  if (status === "CONFIRMED" && paymentMethod === "ONLINE") redirect(`/bookings/${booking.id}/pay`);
  redirect(`/bookings/${booking.id}`);
}

export async function cancelBookingAction(bookingId: string): Promise<ActionResult> {
  const ctx = await requireModule("bookings");
  const b = await db.booking.findUnique({ where: { id: bookingId } });
  if (!b || b.tenantId !== ctx.tenant.id) return fail("Nicht gefunden");
  const isAdmin = ctx.can("tenant.manage");
  if (b.userId !== ctx.user.id && !isAdmin) return fail("Keine Berechtigung");
  if (!["PENDING", "CONFIRMED"].includes(b.status)) return fail("Buchung ist bereits beendet.");
  if (!isAdmin) {
    const settings = await getBookingSettings(ctx.tenant.id);
    const hoursAhead = (b.startsAt.getTime() - Date.now()) / 3_600_000;
    if (hoursAhead < settings.cancellationHours) return fail(`Stornierung nur bis ${settings.cancellationHours} Stunden vor Beginn möglich.`);
  }
  const refundNote = b.paymentStatus === "PAID" ? "Rückerstattung prüfen." : null;
  await db.$transaction([
    db.booking.update({ where: { id: bookingId }, data: { status: "CANCELLED", cancelledAt: new Date(), adminNote: refundNote ? [b.adminNote, refundNote].filter(Boolean).join(" ") : b.adminNote } }),
    db.invoice.updateMany({ where: { bookingId, status: "OPEN" }, data: { status: "CANCELLED" } }),
  ]);
  revalidatePath("/bookings");
  revalidatePath("/admin/bookings");
  return ok(undefined, "Buchung storniert.");
}

/** Startet die Online-Zahlung und leitet zur Zahlungsseite weiter. */
export async function payBookingAction(bookingId: string): Promise<ActionResult> {
  const ctx = await requireModule("bookings");
  const b = await db.booking.findUnique({ where: { id: bookingId } });
  if (!b || b.tenantId !== ctx.tenant.id || b.userId !== ctx.user.id) return fail("Nicht gefunden");
  if (b.status !== "CONFIRMED") return fail("Buchung ist noch nicht bestätigt.");
  if (b.paymentStatus === "PAID") return fail("Bereits bezahlt.");
  if (b.paymentMethod !== "ONLINE") return fail("Diese Buchung wird per Rechnung bezahlt.");
  const result = await startOnlinePayment(b, ctx.user.email);
  if (!result.ok) return fail(result.error);
  redirect(result.redirectUrl);
}

// ---------------------------------------------------------------------------
// Admin: Einstellungen
// ---------------------------------------------------------------------------

function parseDurations(raw: unknown): DurationOption[] {
  const arr = typeof raw === "string" ? (JSON.parse(raw) as Array<{ minutes: unknown; price: unknown }>) : [];
  return arr
    .map((d) => ({ minutes: Number(d.minutes), priceCents: parseMoneyToCents(d.price as string) }))
    .filter((d) => Number.isFinite(d.minutes) && d.minutes > 0)
    .sort((a, b) => a.minutes - b.minutes);
}

export async function saveBookingSettingsAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requirePermission("tenant.manage");
  let durationOptions: DurationOption[];
  let openingHours: unknown;
  try {
    durationOptions = parseDurations(formData.get("durationsJson"));
    openingHours = JSON.parse(String(formData.get("openingHoursJson") ?? "{}"));
  } catch {
    return fail("Ungültige Eingaben bei Dauer oder Öffnungszeiten.");
  }
  const parsed = settingsSchema.safeParse({
    currency: formData.get("currency") || "CHF",
    slotStepMinutes: formData.get("slotStepMinutes"),
    durationOptions,
    openingHours,
    approvalRequired: formData.get("approvalRequired") === "on",
    allowInvoice: formData.get("allowInvoice") === "on",
    allowOnline: formData.get("allowOnline") === "on",
    onlineProvider: formData.get("onlineProvider") || "NONE",
    lastMinuteDiscountPercent: formData.get("lastMinuteDiscountPercent") || 0,
    lastMinuteWindowHours: formData.get("lastMinuteWindowHours") || 24,
    minLeadMinutes: formData.get("minLeadMinutes") || 0,
    maxAdvanceDays: formData.get("maxAdvanceDays") || 60,
    cancellationHours: formData.get("cancellationHours") || 0,
    invoiceDueDays: formData.get("invoiceDueDays") || 30,
    invoicePrefix: formData.get("invoicePrefix") ?? "R-",
    payeeName: formData.get("payeeName") || undefined,
    payeeStreet: formData.get("payeeStreet") || undefined,
    payeeZip: formData.get("payeeZip") || undefined,
    payeeCity: formData.get("payeeCity") || undefined,
    iban: formData.get("iban") || undefined,
    invoiceNote: formData.get("invoiceNote") || undefined,
  });
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return fail(i ? `${i.path.join(".")}: ${i.message}` : "Ungültige Eingabe");
  }
  const s = parsed.data;
  if (s.allowOnline && s.onlineProvider === "NONE") return fail("Für Online-Zahlung muss ein Zahlungsanbieter gewählt sein.");
  if (s.allowOnline && s.onlineProvider !== "NONE") {
    const cfg = await db.paymentProviderConfig.findUnique({ where: { tenantId_provider: { tenantId: ctx.tenant.id, provider: s.onlineProvider } } });
    if (!cfg?.enabled) return fail(`${s.onlineProvider} ist noch nicht eingerichtet oder nicht aktiviert (Reiter «Zahlungsanbieter»).`);
  }
  const data = {
    currency: s.currency,
    slotStepMinutes: s.slotStepMinutes,
    durationOptionsJson: JSON.stringify(s.durationOptions),
    openingHoursJson: JSON.stringify(s.openingHours),
    approvalRequired: s.approvalRequired,
    allowInvoice: s.allowInvoice,
    allowOnline: s.allowOnline,
    onlineProvider: s.onlineProvider,
    lastMinuteDiscountPercent: s.lastMinuteDiscountPercent,
    lastMinuteWindowHours: s.lastMinuteWindowHours,
    minLeadMinutes: s.minLeadMinutes,
    maxAdvanceDays: s.maxAdvanceDays,
    cancellationHours: s.cancellationHours,
    invoiceDueDays: s.invoiceDueDays,
    invoicePrefix: s.invoicePrefix,
    payeeName: s.payeeName ?? null,
    payeeStreet: s.payeeStreet ?? null,
    payeeZip: s.payeeZip ?? null,
    payeeCity: s.payeeCity ?? null,
    iban: s.iban ?? null,
    invoiceNote: s.invoiceNote ?? null,
  };
  await db.bookingSettings.upsert({ where: { tenantId: ctx.tenant.id }, create: { tenantId: ctx.tenant.id, ...data }, update: data });
  revalidatePath("/bookings");
  revalidatePath("/admin/bookings");
  return ok(undefined, "Einstellungen gespeichert.");
}

// ---------------------------------------------------------------------------
// Admin: Ressourcen und Sperrzeiten
// ---------------------------------------------------------------------------

export async function saveResourceAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requirePermission("tenant.manage");
  const id = formData.get("id") ? String(formData.get("id")) : null;
  let durationOptions: DurationOption[] | undefined;
  try {
    const raw = formData.get("durationsJson");
    durationOptions = raw && formData.get("ownDurations") === "on" ? parseDurations(raw) : undefined;
  } catch {
    return fail("Ungültige Dauer-Angaben.");
  }
  const parsed = resourceSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    kind: formData.get("kind") ?? "LANE",
    capacity: formData.get("capacity") || 1,
    durationOptions,
    isActive: formData.get("isActive") !== "off",
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Ungültige Eingabe");
  const r = parsed.data;
  const data = { name: r.name, description: r.description ?? null, kind: r.kind, capacity: r.capacity, isActive: r.isActive, durationOptionsJson: r.durationOptions && r.durationOptions.length ? JSON.stringify(r.durationOptions) : null };
  if (id) {
    const ex = await db.resource.findUnique({ where: { id } });
    if (!ex || ex.tenantId !== ctx.tenant.id) return fail("Nicht gefunden");
    await db.resource.update({ where: { id }, data });
  } else {
    const count = await db.resource.count({ where: { tenantId: ctx.tenant.id } });
    await db.resource.create({ data: { ...data, tenantId: ctx.tenant.id, sortOrder: count } });
  }
  revalidatePath("/bookings");
  revalidatePath("/admin/bookings/resources");
  redirect("/admin/bookings/resources");
}

export async function setResourceActiveAction(id: string, active: boolean): Promise<ActionResult> {
  const ctx = await requirePermission("tenant.manage");
  const ex = await db.resource.findUnique({ where: { id } });
  if (!ex || ex.tenantId !== ctx.tenant.id) return fail("Nicht gefunden");
  await db.resource.update({ where: { id }, data: { isActive: active } });
  revalidatePath("/bookings");
  revalidatePath("/admin/bookings/resources");
  return ok();
}

export async function deleteResourceAction(id: string): Promise<ActionResult> {
  const ctx = await requirePermission("tenant.manage");
  const ex = await db.resource.findUnique({ where: { id }, include: { _count: { select: { bookings: true } } } });
  if (!ex || ex.tenantId !== ctx.tenant.id) return fail("Nicht gefunden");
  if (ex._count.bookings > 0) return fail("Ressource hat Buchungen. Bitte deaktivieren statt löschen.");
  await db.resource.delete({ where: { id } });
  revalidatePath("/admin/bookings/resources");
  return ok();
}

const blockSchema = z.object({
  resourceId: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  from: z.string().regex(/^\d{2}:\d{2}$/),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{2}:\d{2}$/),
  reason: z.string().trim().max(120).optional(),
});

export async function addBlockAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requirePermission("tenant.manage");
  const parsed = blockSchema.safeParse({
    resourceId: formData.get("resourceId") || undefined,
    date: formData.get("date"),
    from: formData.get("from"),
    toDate: formData.get("toDate") || undefined,
    to: formData.get("to"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) return fail("Bitte Datum und Zeiten angeben.");
  const { resourceId, date, from, toDate, to, reason } = parsed.data;
  const startsAt = zurichToUtc(date, from);
  const endsAt = zurichToUtc(toDate ?? date, to);
  if (endsAt <= startsAt) return fail("Ende muss nach dem Beginn liegen.");
  if (resourceId) {
    const r = await db.resource.findUnique({ where: { id: resourceId } });
    if (!r || r.tenantId !== ctx.tenant.id) return fail("Ressource nicht gefunden");
  }
  await db.resourceBlock.create({ data: { tenantId: ctx.tenant.id, resourceId: resourceId ?? null, startsAt, endsAt, reason: reason ?? null } });
  revalidatePath("/bookings");
  revalidatePath("/admin/bookings/resources");
  return ok(undefined, "Sperrzeit angelegt.");
}

export async function deleteBlockAction(id: string): Promise<ActionResult> {
  const ctx = await requirePermission("tenant.manage");
  const b = await db.resourceBlock.findUnique({ where: { id } });
  if (!b || b.tenantId !== ctx.tenant.id) return fail("Nicht gefunden");
  await db.resourceBlock.delete({ where: { id } });
  revalidatePath("/admin/bookings/resources");
  return ok();
}

// ---------------------------------------------------------------------------
// Admin: Freigaben, Zahlungen
// ---------------------------------------------------------------------------

export async function decideBookingAction(bookingId: string, decision: "APPROVE" | "REJECT", adminNote?: string): Promise<ActionResult> {
  const ctx = await requirePermission("tenant.manage");
  const b = await db.booking.findUnique({ where: { id: bookingId } });
  if (!b || b.tenantId !== ctx.tenant.id) return fail("Nicht gefunden");
  if (b.status !== "PENDING") return fail("Buchung wartet nicht auf Freigabe.");
  if (decision === "APPROVE") {
    await db.booking.update({ where: { id: bookingId }, data: { status: "CONFIRMED", confirmedAt: new Date(), adminNote: adminNote ?? b.adminNote } });
    if (b.paymentMethod === "INVOICE") await ensureInvoiceForBooking(bookingId);
  } else {
    await db.booking.update({ where: { id: bookingId }, data: { status: "REJECTED", adminNote: adminNote ?? b.adminNote } });
  }
  revalidatePath("/bookings");
  revalidatePath("/admin/bookings");
  return ok(undefined, decision === "APPROVE" ? "Buchung freigegeben." : "Buchung abgelehnt.");
}

export async function markBookingPaidAction(bookingId: string, paid: boolean): Promise<ActionResult> {
  const ctx = await requirePermission("tenant.manage");
  const b = await db.booking.findUnique({ where: { id: bookingId } });
  if (!b || b.tenantId !== ctx.tenant.id) return fail("Nicht gefunden");
  const now = new Date();
  await db.$transaction([
    db.booking.update({ where: { id: bookingId }, data: { paymentStatus: paid ? "PAID" : "UNPAID", paidAt: paid ? now : null } }),
    db.invoice.updateMany({ where: { bookingId }, data: { status: paid ? "PAID" : "OPEN", paidAt: paid ? now : null } }),
  ]);
  revalidatePath("/bookings");
  revalidatePath("/admin/bookings");
  return ok();
}

export async function markBookingRefundedAction(bookingId: string): Promise<ActionResult> {
  const ctx = await requirePermission("tenant.manage");
  const b = await db.booking.findUnique({ where: { id: bookingId } });
  if (!b || b.tenantId !== ctx.tenant.id) return fail("Nicht gefunden");
  await db.booking.update({ where: { id: bookingId }, data: { paymentStatus: "REFUNDED" } });
  revalidatePath("/admin/bookings");
  return ok();
}

// ---------------------------------------------------------------------------
// Admin: Zahlungsanbieter
// ---------------------------------------------------------------------------

export async function saveProviderConfigAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requirePermission("tenant.manage");
  const provider = String(formData.get("provider") ?? "");
  if (!(providerKeys as readonly string[]).includes(provider)) return fail("Unbekannter Anbieter");
  const fields = PROVIDER_FIELDS[provider as PaymentProviderKey];
  const existing = await db.paymentProviderConfig.findUnique({ where: { tenantId_provider: { tenantId: ctx.tenant.id, provider } } });
  const current = existing ? decryptJson<Record<string, string>>(existing.credentialsEnc) : {};
  const next: Record<string, string> = { ...current };
  for (const f of fields) {
    const v = String(formData.get(f.key) ?? "").trim();
    // Geheime Felder: leer lassen = bestehenden Wert behalten
    if (v === "" && f.secret && current[f.key]) continue;
    if (v !== "") next[f.key] = v;
    else delete next[f.key];
  }
  const missing = fields.filter((f) => !f.options && !next[f.key] && !(provider === "STRIPE" && f.key === "webhookSecret"));
  const enabled = formData.get("enabled") === "on";
  if (enabled && missing.length) return fail(`Fehlende Angaben: ${missing.map((m) => m.label).join(", ")}`);
  await db.paymentProviderConfig.upsert({
    where: { tenantId_provider: { tenantId: ctx.tenant.id, provider } },
    create: { tenantId: ctx.tenant.id, provider, enabled, credentialsEnc: encryptJson(next) },
    update: { enabled, credentialsEnc: encryptJson(next) },
  });
  if (!enabled) {
    await db.bookingSettings.updateMany({ where: { tenantId: ctx.tenant.id, onlineProvider: provider }, data: { onlineProvider: "NONE", allowOnline: false } });
  }
  revalidatePath("/admin/bookings");
  return ok(undefined, "Gespeichert.");
}
