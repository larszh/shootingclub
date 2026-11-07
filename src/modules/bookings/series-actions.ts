"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/tenant";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { audit } from "@/lib/audit";
import { isCalendarDate, PERSONS_LIMIT } from "./types";
import { cancellableOccurrences, conflictSummary, formatWeekdaysCsv, minutesBetween, partitionOccurrences, validatePattern, weekdaysLabel, type ConflictReason, type SeriesPatternError } from "./series";
import { planSeries, type SeriesInput } from "./series-queries";
import { notifyBooking, notifySeriesCancelled } from "./notify";

/** Serienbuchungen: Recht «bookings.series» (Trainer und höher) und aktives Modul. */
async function requireSeriesCtx() {
  const ctx = await requirePermission("bookings.series");
  if (!ctx.hasModule("bookings")) redirect("/?module=bookings");
  return ctx;
}

const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;
const seriesSchema = z.object({
  resourceId: z.string().min(1).max(40),
  weekdays: z.array(z.coerce.number().int().min(1).max(7)).min(1).max(7),
  fromDate: z.string().refine(isCalendarDate),
  untilDate: z.string().refine(isCalendarDate),
  startTime: z.string().regex(timeRe),
  endTime: z.string().regex(timeRe),
  persons: z.coerce.number().int().min(1).max(PERSONS_LIMIT).default(1),
  note: z.string().trim().max(191).optional(),
});

const PATTERN_ERROR: Record<SeriesPatternError, string> = {
  invalidDate: "Bitte gültige Daten wählen.",
  untilBeforeFrom: "Das Enddatum liegt vor dem Beginn.",
  tooLong: "Eine Serie darf höchstens ein Jahr dauern.",
  noWeekdays: "Bitte mindestens einen Wochentag wählen.",
  invalidTime: "Bitte gültige Zeiten wählen.",
  endBeforeStart: "Das Ende muss nach dem Beginn liegen.",
  tooMany: "Zu viele Termine (höchstens 200). Bitte den Zeitraum verkürzen.",
  empty: "Im gewählten Zeitraum liegt kein passender Wochentag.",
};

function readForm(formData: FormData) {
  return seriesSchema.safeParse({
    resourceId: formData.get("resourceId"),
    weekdays: formData.getAll("weekdays").map(String),
    fromDate: formData.get("fromDate"),
    untilDate: formData.get("untilDate"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    persons: formData.get("persons") || undefined,
    note: formData.get("note") || undefined,
  });
}

export type SeriesPreviewItem = { date: string; startsAt: string; endsAt: string; conflict: ConflictReason | null };
export type SeriesPreview = { items: SeriesPreviewItem[]; freeCount: number; summary: string; resourceName: string };

/** Vorschau: alle Termine mit Konflikten, ohne etwas anzulegen. */
export async function previewSeriesAction(formData: FormData): Promise<ActionResult<SeriesPreview>> {
  const ctx = await requireSeriesCtx();
  const parsed = readForm(formData);
  if (!parsed.success) return fail("Bitte Ressource, Wochentage, Zeitraum und Zeiten angeben.");
  const input: SeriesInput = parsed.data;
  const patternError = validatePattern(input);
  if (patternError) return fail(PATTERN_ERROR[patternError]);
  const plan = await planSeries(ctx.tenant.id, input, { withWindows: ctx.hasModule("range") });
  if ("error" in plan) return fail(plan.error === "persons" ? `Höchstens ${plan.max} ${plan.max === 1 ? "Person" : "Personen"} pro Buchung.` : "Ressource nicht verfügbar.");
  const { free, byReason } = partitionOccurrences(plan.items);
  return ok({
    items: plan.items.map((o) => ({ date: o.date, startsAt: o.startsAt.toISOString(), endsAt: o.endsAt.toISOString(), conflict: o.conflict })),
    freeCount: free.length,
    summary: conflictSummary(free.length, byReason),
    resourceName: plan.resource.name,
  });
}

/**
 * Legt die Serie und die einzelnen Buchungen an. Jeder Termin wird in derselben Transaktion erneut
 * geprüft (Ressource gesperrt, wie bei Einzelbuchungen); Konflikte werden übersprungen.
 * Serienbuchungen sind Trainings des Vereins: bestätigt, ohne Zahlung.
 */
export async function createSeriesAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireSeriesCtx();
  const parsed = readForm(formData);
  if (!parsed.success) return fail("Bitte Ressource, Wochentage, Zeitraum und Zeiten angeben.");
  const { note, ...input } = parsed.data;
  const patternError = validatePattern(input);
  if (patternError) return fail(PATTERN_ERROR[patternError]);
  const withWindows = ctx.hasModule("range");
  const durationMinutes = minutesBetween(input.startTime, input.endTime);
  const weekdaysCsv = formatWeekdaysCsv(input.weekdays);
  const label = `Serie ${weekdaysLabel(weekdaysCsv)} ${input.startTime}–${input.endTime}`;
  const now = new Date();

  const result = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM \`Resource\` WHERE id = ${input.resourceId} FOR UPDATE`;
    const plan = await planSeries(ctx.tenant.id, input, { withWindows, client: tx, now });
    if ("error" in plan) return plan;
    const { free, byReason } = partitionOccurrences(plan.items);
    if (!free.length) return { error: "none" as const, byReason };
    const series = await tx.bookingSeries.create({
      data: {
        tenantId: ctx.tenant.id, resourceId: input.resourceId, userId: ctx.user.id, weekdays: weekdaysCsv,
        startTime: input.startTime, endTime: input.endTime,
        fromDate: new Date(`${input.fromDate}T00:00:00Z`), untilDate: new Date(`${input.untilDate}T00:00:00Z`),
        persons: input.persons, note: note ?? null, status: "ACTIVE",
      },
    });
    await tx.booking.createMany({
      data: free.map((o) => ({
        tenantId: ctx.tenant.id, resourceId: input.resourceId, userId: ctx.user.id, seriesId: series.id,
        startsAt: o.startsAt, endsAt: o.endsAt, durationMinutes, persons: input.persons, units: plan.units, isFlatRate: false,
        status: "CONFIRMED", paymentMethod: "NONE", paymentStatus: "NOT_REQUIRED",
        basePriceCents: 0, discountCents: 0, discountReason: null, totalCents: 0, currency: plan.settings.currency,
        note: note ?? null, adminNote: label.slice(0, 191), confirmedAt: now,
      })),
    });
    return { seriesId: series.id, created: free.length, byReason };
  }, { timeout: 20_000 });

  if ("error" in result) {
    if (result.error === "persons") return fail(`Höchstens ${result.max} ${result.max === 1 ? "Person" : "Personen"} pro Buchung.`);
    if (result.error === "resource") return fail("Ressource nicht verfügbar.");
    return fail(`Kein Termin ist frei: ${conflictSummary(0, "byReason" in result ? result.byReason : {})}.`);
  }
  const skipped = Object.values(result.byReason).reduce((s, n) => s + (n ?? 0), 0);
  await audit({
    tenantId: ctx.tenant.id, actorId: ctx.user.id, actorName: ctx.user.name, action: "booking.series.create", entity: "BookingSeries", entityId: result.seriesId,
    detail: `${label}, ${input.fromDate} bis ${input.untilDate}: ${conflictSummary(result.created, result.byReason)}`,
  });
  revalidatePath("/bookings");
  revalidatePath("/admin/bookings");
  redirect(`/bookings/series/${result.seriesId}?created=${result.created}&skipped=${skipped}`);
}

/** Eigene Serien oder (mit Verwaltungsrecht) alle Serien des Vereins. */
async function loadOwnSeries(ctx: Awaited<ReturnType<typeof requireSeriesCtx>>, seriesId: string) {
  if (typeof seriesId !== "string" || !seriesId || seriesId.length > 40) return null;
  const s = await db.bookingSeries.findUnique({ where: { id: seriesId } });
  if (!s || s.tenantId !== ctx.tenant.id) return null;
  if (s.userId !== ctx.user.id && !ctx.can("tenant.manage")) return null;
  return s;
}

/** Ganze Serie stornieren: alle künftigen aktiven Termine; vergangene bleiben als Verlauf. */
export async function cancelSeriesAction(seriesId: string): Promise<ActionResult> {
  const ctx = await requireSeriesCtx();
  const s = await loadOwnSeries(ctx, seriesId);
  if (!s) return fail("Nicht gefunden");
  if (s.status === "CANCELLED") return fail("Die Serie ist bereits storniert.");
  const now = new Date();
  const bookings = await db.booking.findMany({ where: { seriesId: s.id, tenantId: ctx.tenant.id }, select: { id: true, status: true, startsAt: true } });
  const ids = cancellableOccurrences(bookings, now).map((b) => b.id);
  await db.$transaction([
    db.booking.updateMany({ where: { id: { in: ids }, status: { in: ["PENDING", "CONFIRMED"] } }, data: { status: "CANCELLED", cancelledAt: now } }),
    db.bookingSeries.update({ where: { id: s.id }, data: { status: "CANCELLED" } }),
  ]);
  if (s.userId && s.userId !== ctx.user.id && ids.length) void notifySeriesCancelled(s.id, ids.length, ctx.user).catch(() => undefined);
  await audit({ tenantId: ctx.tenant.id, actorId: ctx.user.id, actorName: ctx.user.name, action: "booking.series.cancel", entity: "BookingSeries", entityId: s.id, detail: `${ids.length} künftige Termine storniert` });
  revalidatePath("/bookings");
  revalidatePath("/admin/bookings");
  revalidatePath(`/bookings/series/${s.id}`);
  return ok(undefined, ids.length === 1 ? "Serie storniert (1 Termin)." : `Serie storniert (${ids.length} Termine).`);
}

/** Einzelnen Termin einer Serie stornieren (ohne Stornofrist: es ist ein Vereinstraining). */
export async function cancelSeriesOccurrenceAction(bookingId: string): Promise<ActionResult> {
  const ctx = await requireSeriesCtx();
  if (typeof bookingId !== "string" || !bookingId || bookingId.length > 40) return fail("Nicht gefunden");
  const b = await db.booking.findUnique({ where: { id: bookingId }, select: { id: true, tenantId: true, seriesId: true, status: true, userId: true, startsAt: true } });
  if (!b || b.tenantId !== ctx.tenant.id || !b.seriesId) return fail("Nicht gefunden");
  const s = await loadOwnSeries(ctx, b.seriesId);
  if (!s) return fail("Nicht gefunden");
  if (b.status !== "PENDING" && b.status !== "CONFIRMED") return fail("Der Termin ist bereits beendet.");
  if (b.startsAt <= new Date()) return fail("Vergangene Termine können nicht storniert werden.");
  const res = await db.booking.updateMany({ where: { id: b.id, status: { in: ["PENDING", "CONFIRMED"] } }, data: { status: "CANCELLED", cancelledAt: new Date() } });
  if (res.count === 0) return fail("Der Termin ist bereits beendet.");
  if (b.userId && b.userId !== ctx.user.id) void notifyBooking(b.id, "cancelled", ctx.user).catch(() => undefined);
  await audit({ tenantId: ctx.tenant.id, actorId: ctx.user.id, actorName: ctx.user.name, action: "booking.series.cancelOne", entity: "Booking", entityId: b.id, detail: `Serie ${s.id}` });
  revalidatePath("/bookings");
  revalidatePath("/admin/bookings");
  revalidatePath(`/bookings/series/${s.id}`);
  return ok(undefined, "Termin storniert.");
}
