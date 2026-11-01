"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireModule, requirePermission, requireTenant } from "@/lib/tenant";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { zurichToUtc } from "@/lib/time";
import { parseMoneyToCents } from "@/lib/money";
import { getBookingSettings, getResource, getSlotsForDay, expireUnpaidOnlineBookings } from "./queries";
import { maxPersonsFor, planRequest, quotePrice } from "./pricing";
import { isCalendarDate, PERSONS_LIMIT, resourceSchema, settingsSchema, type DurationOption } from "./types";
import { ensureInvoiceForBooking } from "./invoice";
import { startOnlinePayment } from "./payment-flow";
import { notifyBooking } from "./notify";
import { createBookingIfFree, SLOT_TAKEN } from "./create";
import { checkBookingWindow, windowRejectMessage } from "@/modules/range/booking-window";
import { bookingAccess, guestMayCancel } from "@/modules/sharing/logic";
import { audit } from "@/lib/audit";
import { recordAccountingEvent } from "@/modules/accounting/events";

/** Hinweis bei Reservationen der Verwaltung ausserhalb der bewilligten Schiesszeiten (Modul «range»). */
const OUTSIDE_WINDOW_NOTE = "Achtung: ausserhalb der bewilligten Schiesszeiten";

/** Verwaltungsrecht und aktives Modul «bookings» verlangen. */
async function requireBookingsAdmin() {
  const ctx = await requirePermission("tenant.manage");
  if (!ctx.hasModule("bookings")) redirect("/?module=bookings");
  return ctx;
}


// ---------------------------------------------------------------------------
// Mitglieder
// ---------------------------------------------------------------------------

function personsLimitError(max: number) {
  return `Höchstens ${max} ${max === 1 ? "Person" : "Personen"} pro Buchung.`;
}

const createBookingSchema = z.object({
  resourceId: z.string().min(1),
  date: z.string().refine(isCalendarDate),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  durationMinutes: z.coerce.number().int().min(5),
  persons: z.coerce.number().int().min(1).max(PERSONS_LIMIT).default(1),
  paymentMethod: z.enum(["INVOICE", "ONLINE"]).optional(),
  note: z.string().trim().max(191).optional(),
});

export async function createBookingAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireModule("bookings");
  const parsed = createBookingSchema.safeParse({
    resourceId: formData.get("resourceId"),
    date: formData.get("date"),
    time: formData.get("time"),
    durationMinutes: formData.get("durationMinutes"),
    persons: formData.get("persons") || undefined,
    paymentMethod: formData.get("paymentMethod") || undefined,
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return fail("Bitte Ressource, Datum, Zeit, Dauer und Anzahl Personen wählen.");
  const { resourceId, date, time, durationMinutes, persons, note } = parsed.data;

  const [settings, resource] = await Promise.all([getBookingSettings(ctx.tenant.id), getResource(ctx.tenant.id, resourceId)]);
  if (!resource || !resource.isActive) return fail("Ressource nicht verfügbar.");
  const options = resource.durationOptions ?? settings.durationOptions;
  const option = options.find((o) => o.minutes === durationMinutes);
  if (!option) return fail("Diese Dauer ist nicht buchbar.");
  const maxPersons = maxPersonsFor(resource, settings);
  if (persons > maxPersons) return fail(personsLimitError(maxPersons));
  const plan = planRequest(option, resource, settings, persons);

  await expireUnpaidOnlineBookings(ctx.tenant.id);
  const slots = await getSlotsForDay(ctx.tenant.id, resource, settings, date, durationMinutes, { requestedUnits: plan.units });
  const slot = slots.find((s) => s.time === time);
  if (!slot) return fail("Diese Zeit liegt ausserhalb der Öffnungszeiten.");
  if (!slot.available) return fail(`Dieser Termin ist nicht verfügbar (${slot.reason}).`);

  // Standbetrieb: bewilligte Schiesszeiten. Mitglieder werden abgewiesen, die Verwaltung erhält einen Vermerk.
  let windowNote: string | null = null;
  if (ctx.hasModule("range")) {
    const check = await checkBookingWindow(ctx.tenant.id, resourceId, slot.startsAt, slot.endsAt);
    if (!check.ok) {
      if (!ctx.can("tenant.manage")) return fail(windowRejectMessage(check));
      windowNote = `${OUTSIDE_WINDOW_NOTE} (${check.allowed})`.slice(0, 191);
    }
  }

  const quote = quotePrice(option, slot.startsAt, settings, plan.persons);
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
  const booking = await createBookingIfFree({ tenantId: ctx.tenant.id, resource, settings, date, time, durationMinutes, requestedUnits: plan.units }, {
    tenantId: ctx.tenant.id,
    resourceId,
    userId: ctx.user.id,
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
    durationMinutes,
    persons: plan.persons,
    units: plan.units,
    isFlatRate: plan.isFlatRate,
    status,
    paymentMethod,
    paymentStatus: paymentMethod === "NONE" ? "NOT_REQUIRED" : "UNPAID",
    basePriceCents: quote.basePriceCents,
    discountCents: quote.discountCents,
    discountReason: quote.discountReason,
    totalCents: quote.totalCents,
    currency: settings.currency,
    note: note ?? null,
    adminNote: windowNote,
    confirmedAt: status === "CONFIRMED" ? new Date() : null,
  });
  if (!booking) return fail(SLOT_TAKEN);

  if (status === "CONFIRMED" && paymentMethod === "INVOICE") await ensureInvoiceForBooking(booking.id);
  if (status === "PENDING") void notifyBooking(booking.id, "pending", ctx.user).catch(() => undefined);

  revalidatePath("/bookings");
  if (status === "CONFIRMED" && paymentMethod === "ONLINE") redirect(`/bookings/${booking.id}/pay`);
  // Verwaltung hat ausserhalb der Schiesszeiten gebucht: Hinweis auf der Detailseite anzeigen.
  redirect(windowNote ? `/bookings/${booking.id}?created=1&outsideWindow=1` : `/bookings/${booking.id}`);
}

export async function cancelBookingAction(bookingId: string): Promise<ActionResult> {
  // Kein requireModule: das Mitglied eines Partnervereins storniert beim Eigentümer, auch wenn der
  // eigene Verein das Modul inzwischen ausgeschaltet hat. Im eigenen Verein gilt das Modul (unten).
  const ctx = await requireTenant();
  if (typeof bookingId !== "string" || !bookingId || bookingId.length > 40) return fail("Nicht gefunden");
  const b = await db.booking.findUnique({ where: { id: bookingId } });
  if (!b) return fail("Nicht gefunden");
  // Gemeinsame Anlage: das Mitglied eines Partnervereins storniert die eigene Buchung beim Eigentümer.
  const access = bookingAccess(b, { userId: ctx.user.id, activeTenantId: ctx.tenant.id, canManageActive: ctx.can("tenant.manage") });
  if (!access) return fail("Nicht gefunden");
  if (access !== "guest" && !ctx.hasModule("bookings")) redirect("/?module=bookings");
  const isAdmin = access === "admin" || (access === "owner" && ctx.can("tenant.manage"));
  if (!["PENDING", "CONFIRMED"].includes(b.status)) return fail("Buchung ist bereits beendet.");
  if (!isAdmin) {
    // Regeln des Vereins, dem die Anlage gehört (bei Partnerbuchungen der Eigentümer).
    const settings = await getBookingSettings(b.tenantId);
    const allowed = guestMayCancel(b, settings.cancellationHours);
    if (!allowed.ok) return fail(allowed.error);
  }
  const refundNote = b.paymentStatus === "PAID" ? "Rückerstattung prüfen." : null;
  // Offene Zahlungen entfallen mit der Stornierung; bezahlte bleiben sichtbar (Rückerstattung).
  const paymentStatus = ["UNPAID", "PENDING", "FAILED"].includes(b.paymentStatus) ? "NOT_REQUIRED" : b.paymentStatus;
  await db.$transaction([
    db.booking.update({ where: { id: bookingId }, data: { status: "CANCELLED", cancelledAt: new Date(), paymentStatus, adminNote: refundNote ? [b.adminNote, refundNote].filter(Boolean).join(" ").slice(-191) : b.adminNote } }),
    db.invoice.updateMany({ where: { bookingId, status: "OPEN" }, data: { status: "CANCELLED" } }),
  ]);
  if (access === "guest") void audit({ tenantId: b.tenantId, actorId: ctx.user.id, actorName: ctx.user.name, action: "booking.partner.cancel", entity: "Booking", entityId: b.id, detail: `Storniert durch Mitglied eines Partnervereins (${ctx.tenant.name})` });
  // Storniert die Verwaltung eine fremde Buchung, wird das Mitglied informiert
  if (b.userId && b.userId !== ctx.user.id) void notifyBooking(bookingId, "cancelled", ctx.user).catch(() => undefined);
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

/** Eine Zeile aus dem Dauer-Editor (Beträge als Text, wie eingegeben). */
const durationRowSchema = z.object({
  minutes: z.coerce.number(),
  price: z.union([z.string(), z.number()]).optional(),
  personPrices: z.array(z.union([z.string(), z.number(), z.null()])).max(PERSONS_LIMIT).optional(),
  flatFrom: z.union([z.string(), z.number(), z.null()]).optional(),
  flatPrice: z.union([z.string(), z.number(), z.null()]).optional(),
});

function isBlank(v: unknown) {
  return v === null || v === undefined || String(v).trim() === "";
}

/** Betrag aus dem Formular; wirft bei unlesbarer Eingabe (z.B. «abc»). */
function moneyField(v: unknown, label: string) {
  const txt = String(v).trim();
  // Erlaubt «15», «15.50», «15,5», «15.–», «CHF 1'200.00».
  const clean = txt.replace(/CHF|EUR|Fr\.?|['’\s]/gi, "").replace(/[.,][–-]+$/, "");
  if (!/^\d+([.,]\d{0,2})?$/.test(clean)) throw new Error(`${label}: ungültiger Betrag «${txt.slice(0, 20)}».`);
  return parseMoneyToCents(clean);
}

/**
 * Dauer-Zeilen in Optionen übersetzen. Leere Personenpreise = Rückfall auf «Preis pro Person».
 * Wirft Error mit verständlicher Meldung bei unvollständiger Pauschale oder unlesbaren Beträgen.
 */
function parseDurations(raw: unknown): DurationOption[] {
  const json = typeof raw === "string" ? JSON.parse(raw) : [];
  const rows = z.array(durationRowSchema).max(50).safeParse(json);
  if (!rows.success) throw new Error("Ungültige Dauer-Angaben.");
  return rows.data
    .filter((d) => Number.isFinite(d.minutes) && d.minutes > 0)
    .map((d) => {
      const label = `Dauer ${d.minutes} Min.`;
      const opt: DurationOption = { minutes: Math.round(d.minutes), priceCents: isBlank(d.price) ? 0 : moneyField(d.price, label) };
      const personPrices = (d.personPrices ?? []).map((p, i) => (isBlank(p) ? null : moneyField(p, `${label}, ${i + 1} Pers.`)));
      while (personPrices.length && personPrices[personPrices.length - 1] === null) personPrices.pop();
      if (personPrices.length) opt.personPrices = personPrices;
      const hasFrom = !isBlank(d.flatFrom);
      const hasFlatPrice = !isBlank(d.flatPrice);
      if (hasFrom !== hasFlatPrice) throw new Error(`${label}: Für die Pauschale braucht es «ab … Personen» und den Pauschalpreis.`);
      if (hasFrom) {
        const from = Number(String(d.flatFrom).trim());
        if (!Number.isInteger(from) || from < 1 || from > PERSONS_LIMIT) throw new Error(`${label}: «Pauschal ab» muss eine Zahl zwischen 1 und ${PERSONS_LIMIT} sein.`);
        opt.flatFromPersons = from;
        opt.flatPriceCents = moneyField(d.flatPrice, `${label}, Pauschalpreis`);
      }
      return opt;
    })
    .sort((a, b) => a.minutes - b.minutes);
}

function durationsError(e: unknown, fallback: string) {
  return e instanceof Error && !(e instanceof SyntaxError) && e.message ? e.message : fallback;
}

export async function saveBookingSettingsAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireBookingsAdmin();
  let durationOptions: DurationOption[];
  let openingHours: unknown;
  try {
    durationOptions = parseDurations(formData.get("durationsJson"));
    openingHours = JSON.parse(String(formData.get("openingHoursJson") ?? "{}"));
  } catch (e) {
    return fail(durationsError(e, "Ungültige Eingaben bei Dauer oder Öffnungszeiten."));
  }
  if (new Set(durationOptions.map((d) => d.minutes)).size !== durationOptions.length) return fail("Jede Dauer darf nur einmal vorkommen.");
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
    invoiceNote: formData.get("invoiceNote") || undefined,
    personPricing: formData.get("personPricing") === "on",
    maxPersons: formData.get("maxPersons") || 1,
    flatExclusive: formData.get("flatExclusive") === "on",
    capacityPerPerson: formData.get("capacityPerPerson") === "on",
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
    invoiceNote: s.invoiceNote ?? null,
    personPricing: s.personPricing,
    maxPersons: s.maxPersons,
    flatExclusive: s.flatExclusive,
    capacityPerPerson: s.capacityPerPerson,
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
  const ctx = await requireBookingsAdmin();
  const id = formData.get("id") ? String(formData.get("id")) : null;
  let durationOptions: DurationOption[] | undefined;
  try {
    const raw = formData.get("durationsJson");
    durationOptions = raw && formData.get("ownDurations") === "on" ? parseDurations(raw) : undefined;
  } catch (e) {
    return fail(durationsError(e, "Ungültige Dauer-Angaben."));
  }
  if (durationOptions && new Set(durationOptions.map((d) => d.minutes)).size !== durationOptions.length) return fail("Jede Dauer darf nur einmal vorkommen.");
  const parsed = resourceSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    kind: formData.get("kind") ?? "LANE",
    capacity: formData.get("capacity") || 1,
    maxPersons: formData.get("maxPersons") ? formData.get("maxPersons") : null,
    durationOptions,
    isActive: formData.get("isActive") !== "off",
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Ungültige Eingabe");
  const r = parsed.data;
  const data = { name: r.name, description: r.description ?? null, kind: r.kind, capacity: r.capacity, maxPersons: r.maxPersons, isActive: r.isActive, durationOptionsJson: r.durationOptions && r.durationOptions.length ? JSON.stringify(r.durationOptions) : null };
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
  const ctx = await requireBookingsAdmin();
  const ex = await db.resource.findUnique({ where: { id } });
  if (!ex || ex.tenantId !== ctx.tenant.id) return fail("Nicht gefunden");
  await db.resource.update({ where: { id }, data: { isActive: active } });
  revalidatePath("/bookings");
  revalidatePath("/admin/bookings/resources");
  return ok();
}

export async function deleteResourceAction(id: string): Promise<ActionResult> {
  const ctx = await requireBookingsAdmin();
  const ex = await db.resource.findUnique({ where: { id }, include: { _count: { select: { bookings: true } } } });
  if (!ex || ex.tenantId !== ctx.tenant.id) return fail("Nicht gefunden");
  if (ex._count.bookings > 0) return fail("Ressource hat Buchungen. Bitte deaktivieren statt löschen.");
  await db.resource.delete({ where: { id } });
  revalidatePath("/admin/bookings/resources");
  return ok();
}

const blockSchema = z.object({
  resourceId: z.string().optional(),
  date: z.string().refine(isCalendarDate),
  from: z.string().regex(/^\d{2}:\d{2}$/),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{2}:\d{2}$/),
  reason: z.string().trim().max(120).optional(),
});

export async function addBlockAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireBookingsAdmin();
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
  const ctx = await requireBookingsAdmin();
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
  const ctx = await requireBookingsAdmin();
  const b = await db.booking.findUnique({ where: { id: bookingId } });
  if (!b || b.tenantId !== ctx.tenant.id) return fail("Nicht gefunden");
  if (b.status !== "PENDING") return fail("Buchung wartet nicht auf Freigabe.");
  if (decision !== "APPROVE" && decision !== "REJECT") return fail("Ungültige Entscheidung");
  adminNote = adminNote?.trim().slice(0, 191) || undefined;
  // Bedingt auf PENDING: bei gleichzeitiger Entscheidung gewinnt nur eine.
  const data = decision === "APPROVE"
    ? { status: "CONFIRMED", confirmedAt: new Date(), adminNote: adminNote ?? b.adminNote }
    : { status: "REJECTED", paymentStatus: ["UNPAID", "PENDING", "FAILED"].includes(b.paymentStatus) ? "NOT_REQUIRED" : b.paymentStatus, adminNote: adminNote ?? b.adminNote };
  const res = await db.booking.updateMany({ where: { id: bookingId, tenantId: ctx.tenant.id, status: "PENDING" }, data });
  if (res.count === 0) return fail("Buchung wartet nicht auf Freigabe.");
  if (decision === "APPROVE" && b.paymentMethod === "INVOICE") await ensureInvoiceForBooking(bookingId);
  void notifyBooking(bookingId, decision === "APPROVE" ? "confirmed" : "rejected", ctx.user).catch(() => undefined);
  revalidatePath("/bookings");
  revalidatePath("/admin/bookings");
  return ok(undefined, decision === "APPROVE" ? "Buchung freigegeben." : "Buchung abgelehnt.");
}

export async function markBookingPaidAction(bookingId: string, paid: boolean): Promise<ActionResult> {
  const ctx = await requireBookingsAdmin();
  const b = await db.booking.findUnique({ where: { id: bookingId } });
  if (!b || b.tenantId !== ctx.tenant.id) return fail("Nicht gefunden");
  if (!["PENDING", "CONFIRMED"].includes(b.status)) return fail("Die Buchung ist storniert oder abgelehnt.");
  const now = new Date();
  await db.$transaction([
    db.booking.update({ where: { id: bookingId }, data: { paymentStatus: paid ? "PAID" : "UNPAID", paidAt: paid ? now : null } }),
    db.invoice.updateMany({ where: { bookingId, status: { not: "CANCELLED" } }, data: { status: paid ? "PAID" : "OPEN", paidAt: paid ? now : null } }),
  ]);
  revalidatePath("/bookings");
  revalidatePath("/admin/bookings");
  return ok();
}

export async function markBookingRefundedAction(bookingId: string): Promise<ActionResult> {
  const ctx = await requireBookingsAdmin();
  const b = await db.booking.findUnique({ where: { id: bookingId } });
  if (!b || b.tenantId !== ctx.tenant.id) return fail("Nicht gefunden");
  await db.booking.update({ where: { id: bookingId }, data: { paymentStatus: "REFUNDED" } });
  if (b.paymentStatus !== "REFUNDED") {
    await recordAccountingEvent({ tenantId: ctx.tenant.id, kind: "refund", entity: "Booking", entityId: bookingId, actorId: ctx.user.id, actorName: ctx.user.name });
  }
  revalidatePath("/admin/bookings");
  return ok();
}

// ---------------------------------------------------------------------------
// Admin: Buchung für ein Mitglied erfassen
// ---------------------------------------------------------------------------

const adminBookingSchema = z.object({
  userId: z.string().min(1).max(40),
  resourceId: z.string().min(1).max(40),
  date: z.string().refine(isCalendarDate),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  durationMinutes: z.coerce.number().int().min(5).max(24 * 60),
  persons: z.coerce.number().int().min(1).max(PERSONS_LIMIT).default(1),
  payment: z.enum(["INVOICE", "CASH", "FREE"]),
  note: z.string().trim().max(191).optional(),
});

/**
 * Verwaltung bucht im Namen eines Mitglieds. Öffnungszeiten, Sperrzeiten und Kapazität gelten,
 * Vorlauf und Vorausbuchungsgrenze nicht. Die Buchung ist sofort bestätigt.
 */
export async function adminCreateBookingAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireBookingsAdmin();
  if (!ctx.hasModule("bookings")) return fail("Das Modul Reservationen ist nicht aktiv.");
  const parsed = adminBookingSchema.safeParse({
    userId: formData.get("userId"),
    resourceId: formData.get("resourceId"),
    date: formData.get("date"),
    time: formData.get("time"),
    durationMinutes: formData.get("durationMinutes"),
    persons: formData.get("persons") || undefined,
    payment: formData.get("payment") || "INVOICE",
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return fail("Bitte Mitglied, Ressource, Datum, Zeit, Dauer und Anzahl Personen wählen.");
  const { userId, resourceId, date, time, durationMinutes, persons, payment, note } = parsed.data;

  const membership = await db.membership.findFirst({ where: { userId, tenantId: ctx.tenant.id, status: { not: "LEFT" }, user: { deletedAt: null } }, select: { id: true } });
  if (!membership) return fail("Mitglied nicht gefunden oder ausgetreten.");
  const [settings, resource] = await Promise.all([getBookingSettings(ctx.tenant.id), getResource(ctx.tenant.id, resourceId)]);
  if (!resource) return fail("Ressource nicht gefunden.");
  const option = (resource.durationOptions ?? settings.durationOptions).find((o) => o.minutes === durationMinutes);
  if (!option) return fail("Diese Dauer ist für die Ressource nicht eingerichtet.");
  const maxPersons = maxPersonsFor(resource, settings);
  if (persons > maxPersons) return fail(personsLimitError(maxPersons));
  const plan = planRequest(option, resource, settings, persons);

  await expireUnpaidOnlineBookings(ctx.tenant.id);
  const slots = await getSlotsForDay(ctx.tenant.id, resource, settings, date, durationMinutes, { bypassLimits: true, requestedUnits: plan.units });
  const slot = slots.find((s) => s.time === time);
  if (!slot) return fail("Diese Zeit liegt ausserhalb der Öffnungszeiten.");
  if (!slot.available) return fail(`Dieser Termin ist nicht verfügbar (${slot.reason}).`);

  // Standbetrieb: ausserhalb der bewilligten Schiesszeiten darf die Verwaltung reservieren, mit Vermerk.
  let windowNote: string | null = null;
  if (ctx.hasModule("range")) {
    const check = await checkBookingWindow(ctx.tenant.id, resourceId, slot.startsAt, slot.endsAt);
    if (!check.ok) windowNote = `${OUTSIDE_WINDOW_NOTE} (${check.allowed})`;
  }

  const quote = quotePrice(option, slot.startsAt, settings, plan.persons);
  const now = new Date();
  let pricing: { basePriceCents: number; discountCents: number; discountReason: string | null; totalCents: number } = quote;
  let paymentMethod = "NONE";
  let paymentStatus = "NOT_REQUIRED";
  let paidAt: Date | null = null;
  if (payment === "FREE" || quote.totalCents === 0) {
    pricing = quote.basePriceCents > 0
      ? { basePriceCents: quote.basePriceCents, discountCents: quote.basePriceCents, discountReason: "Gratis (Verwaltung)", totalCents: 0 }
      : quote;
  } else if (payment === "CASH") {
    paymentMethod = "CASH";
    paymentStatus = "PAID";
    paidAt = now;
  } else {
    paymentMethod = "INVOICE";
    paymentStatus = "UNPAID";
  }

  const booking = await createBookingIfFree({ tenantId: ctx.tenant.id, resource, settings, date, time, durationMinutes, requestedUnits: plan.units, bypassLimits: true }, {
    tenantId: ctx.tenant.id,
    resourceId,
    userId,
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
    durationMinutes,
    persons: plan.persons,
    units: plan.units,
    isFlatRate: plan.isFlatRate,
    status: "CONFIRMED",
    paymentMethod,
    paymentStatus,
    basePriceCents: pricing.basePriceCents,
    discountCents: pricing.discountCents,
    discountReason: pricing.discountReason,
    totalCents: pricing.totalCents,
    currency: settings.currency,
    note: note ?? null,
    adminNote: [`Erfasst durch ${ctx.user.name}`, windowNote].filter(Boolean).join(" · ").slice(0, 191),
    confirmedAt: now,
    paidAt,
  });
  if (!booking) return fail(SLOT_TAKEN);
  if (paymentMethod === "INVOICE") await ensureInvoiceForBooking(booking.id);
  void notifyBooking(booking.id, "created", ctx.user).catch(() => undefined);

  revalidatePath("/bookings");
  revalidatePath("/admin/bookings");
  redirect(`/bookings/${booking.id}?created=1${windowNote ? "&outsideWindow=1" : ""}`);
}

// ---------------------------------------------------------------------------
// Admin: Zahlungsanbieter
// ---------------------------------------------------------------------------

// Zugangsdaten der Zahlungsanbieter: savePaymentProviderAction in src/lib/payments/actions.ts
// (gemeinsam für Reservationen und Beiträge, inkl. Payrexx).
