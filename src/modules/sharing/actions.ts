"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireModule, requirePermission } from "@/lib/tenant";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { audit } from "@/lib/audit";
import { THROTTLE, clientIp, throttle } from "@/lib/auth";
import { notify, tenantUserIdsWithRole } from "@/lib/notify";
import { checkBookingWindow, windowRejectMessage } from "@/modules/range/booking-window";
import { expireUnpaidOnlineBookings, getSlotsForDay } from "@/modules/bookings/queries";
import { maxPersonsFor, planRequest, quotePrice } from "@/modules/bookings/pricing";
import { isCalendarDate, PERSONS_LIMIT } from "@/modules/bookings/types";
import { createBookingIfFree, SLOT_TAKEN } from "@/modules/bookings/create";
import { ensureInvoiceForBooking } from "@/modules/bookings/invoice";
import { notifyBooking } from "@/modules/bookings/notify";
import type { SlotsResult } from "@/modules/bookings/slot-actions";
import { applyPriceFactor, partnerLookupKeys, partnerRateLabel, PRICE_FACTOR_MAX, PRICE_FACTOR_MIN } from "./logic";
import { resolveGuestShare, tenantModuleEnabled } from "./queries";
import { guestSlots } from "./service";

/** Verwaltung des Eigentümers mit aktivem Modul «Reservationen». */
async function requireBookingsAdmin() {
  const ctx = await requirePermission("tenant.manage");
  if (!ctx.hasModule("bookings")) redirect("/?module=bookings");
  return ctx;
}

function revalidateShares(resourceId: string) {
  revalidatePath("/admin/bookings/resources");
  revalidatePath(`/admin/bookings/resources/${resourceId}`);
  revalidatePath("/bookings");
}

// ---------------------------------------------------------------------------
// Eigentümer: Ressource mit Partnerverein teilen
// ---------------------------------------------------------------------------

const shareSchema = z.object({
  resourceId: z.string().min(1).max(40),
  partner: z.string().trim().min(2, "Bitte Kurzname oder Beitrittscode des Partnervereins angeben.").max(64),
  canBook: z.boolean(),
  priceFactorPercent: z.coerce.number().int("Preisfaktor als ganze Zahl in Prozent").min(PRICE_FACTOR_MIN).max(PRICE_FACTOR_MAX, `Höchstens ${PRICE_FACTOR_MAX} %`),
  note: z.string().trim().max(191).optional(),
});

/** Freigabe anlegen oder (gleicher Partnerverein) aktualisieren. */
export async function saveResourceShareAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireBookingsAdmin();
  const parsed = shareSchema.safeParse({
    resourceId: formData.get("resourceId"),
    partner: formData.get("partner") ?? "",
    canBook: formData.get("canBook") === "on",
    priceFactorPercent: formData.get("priceFactorPercent") || 100,
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Ungültige Eingabe");
  const { resourceId, partner, canBook, priceFactorPercent, note } = parsed.data;

  const resource = await db.resource.findUnique({ where: { id: resourceId }, select: { id: true, tenantId: true, name: true } });
  if (!resource || resource.tenantId !== ctx.tenant.id) return fail("Ressource nicht gefunden.");
  const keys = partnerLookupKeys(partner);
  if (!keys) return fail("Bitte den Kurznamen (z.B. sg-musterhausen) oder den Beitrittscode des Partnervereins angeben.");
  // Die Suche akzeptiert Beitrittscodes: gleiches Budget wie beim Beitreten, damit sich Codes nicht durchprobieren lassen.
  const limited =
    throttle(`share-partner-user:${ctx.user.id}`, THROTTLE.joinCode.limit, THROTTLE.joinCode.windowMs) ??
    throttle(`share-partner-tenant:${ctx.tenant.id}`, THROTTLE.joinCode.limit, THROTTLE.joinCode.windowMs) ??
    throttle(`share-partner-ip:${await clientIp()}`, THROTTLE.joinCode.limit, THROTTLE.joinCode.windowMs);
  if (limited) return fail(limited);
  const guest = await db.tenant.findFirst({
    where: { deletedAt: null, OR: [{ slug: keys.slug }, { joinCode: keys.joinCode }, { joinCode: keys.joinCodeRaw }] },
    select: { id: true, name: true },
  });
  if (!guest) return fail("Kein Verein mit diesem Kurznamen oder Beitrittscode gefunden.");
  if (guest.id === ctx.tenant.id) return fail("Die Anlage gehört bereits deinem Verein.");
  const guestHasBookings = await tenantModuleEnabled(guest.id, "bookings");

  const existing = await db.resourceShare.findUnique({ where: { resourceId_guestTenantId: { resourceId, guestTenantId: guest.id } } });
  const data = { canBook, priceFactorPercent, note: note ?? null };
  const share = existing
    ? await db.resourceShare.update({ where: { id: existing.id }, data })
    : await db.resourceShare.create({ data: { resourceId, guestTenantId: guest.id, ...data } });

  void audit({
    tenantId: ctx.tenant.id, actorId: ctx.user.id, actorName: ctx.user.name,
    action: existing ? "booking.share.update" : "booking.share.create", entity: "ResourceShare", entityId: share.id,
    detail: `«${resource.name}» mit ${guest.name} · ${canBook ? "buchbar" : "pausiert"} · Tarif ${priceFactorPercent} %`,
  });
  if (!existing) {
    const admins = await tenantUserIdsWithRole(guest.id, ["OWNER", "ADMIN"]);
    void notify({
      tenantId: guest.id,
      userIds: admins,
      topic: "bookings",
      title: "Neue gemeinsame Anlage",
      body: canBook && !guestHasBookings
        ? `${ctx.tenant.name} teilt «${resource.name}» mit eurem Verein. Aktiviert zuerst unter «Verein» das Modul «Reservationen», dann können eure Mitglieder sie buchen${priceFactorPercent !== 100 ? ` (Tarif ${priceFactorPercent} %)` : ""}.`
        : `${ctx.tenant.name} teilt «${resource.name}» mit eurem Verein${canBook ? ". Eure Mitglieder können sie unter «Reservationen» buchen" : ""}${priceFactorPercent !== 100 ? ` (Tarif ${priceFactorPercent} %)` : ""}.`,
      url: canBook && !guestHasBookings ? "/admin" : "/bookings",
      tag: `share:${share.id}`,
      dedupeKey: `share-create:${share.id}`,
    }).catch(() => undefined);
  }
  revalidateShares(resourceId);
  const moduleHint = canBook && !guestHasBookings ? ` Hinweis: Bei ${guest.name} ist das Modul «Reservationen» noch aus; die Mitglieder können erst buchen, wenn der Verein es einschaltet.` : "";
  return ok(undefined, `${existing ? `Freigabe für ${guest.name} aktualisiert.` : `Mit ${guest.name} geteilt.`}${moduleHint}`);
}

/** Buchungen für einen Partnerverein pausieren oder wieder erlauben. */
export async function setShareCanBookAction(shareId: string, canBook: boolean): Promise<ActionResult> {
  const ctx = await requireBookingsAdmin();
  if (typeof shareId !== "string" || shareId.length > 40) return fail("Nicht gefunden");
  const share = await db.resourceShare.findUnique({ where: { id: shareId }, include: { resource: { select: { tenantId: true, name: true } }, guestTenant: { select: { name: true } } } });
  if (!share || share.resource.tenantId !== ctx.tenant.id) return fail("Nicht gefunden");
  await db.resourceShare.update({ where: { id: shareId }, data: { canBook: !!canBook } });
  void audit({ tenantId: ctx.tenant.id, actorId: ctx.user.id, actorName: ctx.user.name, action: canBook ? "booking.share.resume" : "booking.share.pause", entity: "ResourceShare", entityId: shareId, detail: `«${share.resource.name}» · ${share.guestTenant.name}` });
  revalidateShares(share.resourceId);
  return ok(undefined, canBook ? "Buchungen wieder erlaubt." : "Buchungen pausiert.");
}

/**
 * Freigabe entfernen. Bestehende Buchungen des Partnervereins bleiben gültig (Rechnung, Stornierung
 * durch das Mitglied); neue Buchungen sind nicht mehr möglich.
 */
export async function revokeResourceShareAction(shareId: string): Promise<ActionResult> {
  const ctx = await requireBookingsAdmin();
  if (typeof shareId !== "string" || shareId.length > 40) return fail("Nicht gefunden");
  const share = await db.resourceShare.findUnique({ where: { id: shareId }, include: { resource: { select: { tenantId: true, name: true } }, guestTenant: { select: { id: true, name: true, deletedAt: true } } } });
  if (!share || share.resource.tenantId !== ctx.tenant.id) return fail("Nicht gefunden");
  await db.resourceShare.delete({ where: { id: shareId } });
  void audit({ tenantId: ctx.tenant.id, actorId: ctx.user.id, actorName: ctx.user.name, action: "booking.share.revoke", entity: "ResourceShare", entityId: shareId, detail: `«${share.resource.name}» · ${share.guestTenant.name}` });
  if (!share.guestTenant.deletedAt) {
    const admins = await tenantUserIdsWithRole(share.guestTenant.id, ["OWNER", "ADMIN"]);
    void notify({
      tenantId: share.guestTenant.id,
      userIds: admins,
      topic: "bookings",
      title: "Gemeinsame Anlage beendet",
      body: `${ctx.tenant.name} teilt «${share.resource.name}» nicht mehr mit eurem Verein. Bestehende Reservationen bleiben gültig.`,
      url: "/bookings",
      tag: `share:${shareId}`,
      dedupeKey: `share-revoke:${shareId}`,
    }).catch(() => undefined);
  }
  revalidateShares(share.resourceId);
  return ok(undefined, "Freigabe entfernt.");
}

// ---------------------------------------------------------------------------
// Gast: freie Zeiten und Buchung auf einer Anlage eines Partnervereins
// ---------------------------------------------------------------------------

/** Freie Zeiten einer geteilten Ressource (nur mit gültiger Freigabe für den aktiven Verein). */
export async function fetchGuestSlotsAction(resourceId: string, dateStr: string, durationMinutes: number, persons = 1): Promise<SlotsResult> {
  const ctx = await requireModule("bookings");
  const g = await resolveGuestShare(ctx, resourceId);
  if (!g.ok) return { slots: [], error: g.error };
  return guestSlots(g, dateStr, durationMinutes, persons);
}

const guestBookingSchema = z.object({
  resourceId: z.string().min(1).max(40),
  date: z.string().refine(isCalendarDate),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  durationMinutes: z.coerce.number().int().min(5).max(24 * 60),
  persons: z.coerce.number().int().min(1).max(PERSONS_LIMIT).default(1),
  note: z.string().trim().max(191).optional(),
});

/**
 * Buchung durch ein Mitglied eines Partnervereins. Die Buchung gehört dem Eigentümer (tenantId),
 * userId = Gast, viaTenantId = aktiver Verein des Gastes. Es gelten die Regeln des Eigentümers;
 * bezahlt wird per Rechnung des Eigentümers (keine Online-Zahlung für Partnerbuchungen).
 */
export async function createGuestBookingAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireModule("bookings");
  const parsed = guestBookingSchema.safeParse({
    resourceId: formData.get("resourceId"),
    date: formData.get("date"),
    time: formData.get("time"),
    durationMinutes: formData.get("durationMinutes"),
    persons: formData.get("persons") || undefined,
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return fail("Bitte Ressource, Datum, Zeit, Dauer und Anzahl Personen wählen.");
  const { resourceId, date, time, durationMinutes, persons, note } = parsed.data;

  const g = await resolveGuestShare(ctx, resourceId);
  if (!g.ok) return fail(g.error);
  const { resource, settings, owner } = g;
  const option = (resource.durationOptions ?? settings.durationOptions).find((o) => o.minutes === durationMinutes);
  if (!option) return fail("Diese Dauer ist nicht buchbar.");
  const maxPersons = maxPersonsFor(resource, settings);
  if (persons > maxPersons) return fail(`Höchstens ${maxPersons} ${maxPersons === 1 ? "Person" : "Personen"} pro Buchung.`);
  const plan = planRequest(option, resource, settings, persons);

  await expireUnpaidOnlineBookings(owner.id);
  const slots = await getSlotsForDay(owner.id, resource, settings, date, durationMinutes, { requestedUnits: plan.units });
  const slot = slots.find((s) => s.time === time);
  if (!slot) return fail("Diese Zeit liegt ausserhalb der Öffnungszeiten.");
  if (!slot.available) return fail(`Dieser Termin ist nicht verfügbar (${slot.reason}).`);
  if (g.ownerHasRange) {
    const check = await checkBookingWindow(owner.id, resourceId, slot.startsAt, slot.endsAt);
    if (!check.ok) return fail(windowRejectMessage(check));
  }

  const quote = applyPriceFactor(quotePrice(option, slot.startsAt, settings, plan.persons), g.priceFactorPercent);
  let paymentMethod: "NONE" | "INVOICE" = "NONE";
  if (quote.totalCents > 0) {
    if (!settings.allowInvoice) return fail(`${owner.name} bietet für Partnervereine keine Bezahlung auf Rechnung an. Bitte direkt beim Verein reservieren.`);
    paymentMethod = "INVOICE";
  }

  const status = settings.approvalRequired ? "PENDING" : "CONFIRMED";
  const booking = await createBookingIfFree({ tenantId: owner.id, resource, settings, date, time, durationMinutes, requestedUnits: plan.units }, {
    tenantId: owner.id,
    resourceId,
    userId: ctx.user.id,
    viaTenantId: ctx.tenant.id,
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
    // Kein Vermerk in adminNote: das Mitglied sieht diese Notiz als Ablehnungsgrund. Der Partnerverein
    // steht in viaTenantId, der Tarif im Audit-Eintrag.
    adminNote: null,
    confirmedAt: status === "CONFIRMED" ? new Date() : null,
  });
  if (!booking) return fail(SLOT_TAKEN);

  if (status === "CONFIRMED" && paymentMethod === "INVOICE") await ensureInvoiceForBooking(booking.id);
  if (status === "PENDING") void notifyBooking(booking.id, "pending", ctx.user).catch(() => undefined);
  void audit({ tenantId: owner.id, actorId: ctx.user.id, actorName: ctx.user.name, action: "booking.partner.create", entity: "Booking", entityId: booking.id, detail: `«${resource.name}» über Partnerverein ${ctx.tenant.name}${g.priceFactorPercent !== 100 ? ` · ${partnerRateLabel(g.priceFactorPercent)}` : ""}` });

  revalidatePath("/bookings");
  redirect(`/bookings/${booking.id}`);
}
