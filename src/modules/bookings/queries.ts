import "server-only";
import { db } from "@/lib/db";
import type { AppContext } from "@/lib/tenant";
import { safeJson } from "@/lib/utils";
import { computeSlots } from "./availability";
import { DEFAULT_DURATIONS, DEFAULT_OPENING_HOURS, durationOptionSchema, openingHoursSchema, type DurationOption, type OpeningHours } from "./types";
import { z } from "zod";

type TenantCtx = AppContext & { tenant: NonNullable<AppContext["tenant"]> };

export type BookingSettingsView = {
  currency: string;
  slotStepMinutes: number;
  durationOptions: DurationOption[];
  openingHours: OpeningHours;
  approvalRequired: boolean;
  allowInvoice: boolean;
  allowOnline: boolean;
  onlineProvider: string;
  lastMinuteDiscountPercent: number;
  lastMinuteWindowHours: number;
  minLeadMinutes: number;
  maxAdvanceDays: number;
  cancellationHours: number;
  invoiceDueDays: number;
  invoicePrefix: string;
  invoiceNote: string | null;
  exists: boolean;
};

export async function getBookingSettings(tenantId: string): Promise<BookingSettingsView> {
  const s = await db.bookingSettings.findUnique({ where: { tenantId } });
  if (!s) {
    return {
      currency: "CHF", slotStepMinutes: 30, durationOptions: DEFAULT_DURATIONS, openingHours: DEFAULT_OPENING_HOURS,
      approvalRequired: false, allowInvoice: true, allowOnline: false, onlineProvider: "NONE",
      lastMinuteDiscountPercent: 0, lastMinuteWindowHours: 24, minLeadMinutes: 60, maxAdvanceDays: 60, cancellationHours: 24,
      invoiceDueDays: 30, invoicePrefix: "R-", invoiceNote: null, exists: false,
    };
  }
  const d = z.array(durationOptionSchema).safeParse(safeJson(s.durationOptionsJson, []));
  const oh = openingHoursSchema.safeParse(safeJson(s.openingHoursJson, {}));
  return {
    ...s,
    durationOptions: d.success && d.data.length ? d.data : DEFAULT_DURATIONS,
    openingHours: oh.success ? oh.data : DEFAULT_OPENING_HOURS,
    exists: true,
  };
}

export type ResourceView = {
  id: string; name: string; description: string | null; kind: string; capacity: number; isActive: boolean; sortOrder: number;
  durationOptions: DurationOption[] | null;
};

function toResourceView(r: { id: string; name: string; description: string | null; kind: string; capacity: number; isActive: boolean; sortOrder: number; durationOptionsJson: string | null }): ResourceView {
  const d = r.durationOptionsJson ? z.array(durationOptionSchema).safeParse(safeJson(r.durationOptionsJson, [])) : null;
  return { ...r, durationOptions: d && d.success && d.data.length ? d.data : null };
}

export async function listResources(tenantId: string, opts?: { includeInactive?: boolean }) {
  const rows = await db.resource.findMany({ where: { tenantId, ...(opts?.includeInactive ? {} : { isActive: true }) }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  return rows.map(toResourceView);
}

export async function getResource(tenantId: string, id: string) {
  const r = await db.resource.findUnique({ where: { id } });
  return r && r.tenantId === tenantId ? toResourceView(r) : null;
}

/** Verfallene Online-Buchungen ohne Zahlung freigeben (lazy, beim Lesen). */
export async function expireUnpaidOnlineBookings(tenantId: string) {
  const cutoff = new Date(Date.now() - 30 * 60_000);
  await db.booking.updateMany({
    where: { tenantId, status: "CONFIRMED", paymentMethod: "ONLINE", paymentStatus: { in: ["UNPAID", "PENDING"] }, createdAt: { lt: cutoff } },
    data: { status: "CANCELLED", cancelledAt: new Date(), adminNote: "Automatisch storniert: Online-Zahlung nicht abgeschlossen." },
  });
}

export async function getSlotsForDay(tenantId: string, resource: ResourceView, settings: BookingSettingsView, dateStr: string, durationMinutes: number) {
  const dayStart = new Date(`${dateStr}T00:00:00Z`);
  const dayEnd = new Date(dayStart.getTime() + 48 * 3_600_000);
  const windowStart = new Date(dayStart.getTime() - 24 * 3_600_000);
  const [bookings, blocks] = await Promise.all([
    db.booking.findMany({ where: { resourceId: resource.id, status: { in: ["PENDING", "CONFIRMED"] }, startsAt: { lt: dayEnd }, endsAt: { gt: windowStart } }, select: { startsAt: true, endsAt: true } }),
    db.resourceBlock.findMany({ where: { tenantId, OR: [{ resourceId: null }, { resourceId: resource.id }], startsAt: { lt: dayEnd }, endsAt: { gt: windowStart } }, select: { startsAt: true, endsAt: true } }),
  ]);
  return computeSlots({
    dateStr, durationMinutes, slotStepMinutes: settings.slotStepMinutes, openingHours: settings.openingHours, capacity: resource.capacity,
    minLeadMinutes: settings.minLeadMinutes, maxAdvanceDays: settings.maxAdvanceDays, bookings, blocks,
  });
}

const bookingInclude = {
  resource: { select: { id: true, name: true, kind: true } },
  user: { select: { id: true, name: true, email: true } },
  invoice: true,
  payments: { orderBy: { createdAt: "desc" as const } },
};

export async function listMyBookings(ctx: TenantCtx) {
  await expireUnpaidOnlineBookings(ctx.tenant.id);
  return db.booking.findMany({ where: { tenantId: ctx.tenant.id, userId: ctx.user.id }, include: bookingInclude, orderBy: { startsAt: "desc" }, take: 100 });
}

export async function listTenantBookings(tenantId: string, opts?: { status?: string; from?: Date; limit?: number }) {
  await expireUnpaidOnlineBookings(tenantId);
  return db.booking.findMany({
    where: { tenantId, ...(opts?.status ? { status: opts.status } : {}), ...(opts?.from ? { startsAt: { gte: opts.from } } : {}) },
    include: bookingInclude,
    orderBy: opts?.status === "PENDING" ? { createdAt: "asc" } : { startsAt: "desc" },
    take: opts?.limit ?? 200,
  });
}

export async function getBooking(ctx: TenantCtx, id: string) {
  const b = await db.booking.findUnique({ where: { id }, include: bookingInclude });
  if (!b || b.tenantId !== ctx.tenant.id) return null;
  const isOwner = b.userId === ctx.user.id;
  if (!isOwner && !ctx.can("tenant.manage")) return null;
  return { ...b, isOwner };
}
export type BookingView = NonNullable<Awaited<ReturnType<typeof getBooking>>>;
export type BookingRow = Awaited<ReturnType<typeof listMyBookings>>[number];

export async function listBlocks(tenantId: string) {
  return db.resourceBlock.findMany({ where: { tenantId, endsAt: { gte: new Date() } }, include: { resource: { select: { name: true } } }, orderBy: { startsAt: "asc" } });
}

export async function listProviderConfigs(tenantId: string) {
  return db.paymentProviderConfig.findMany({ where: { tenantId }, select: { provider: true, enabled: true, updatedAt: true } });
}

export async function bookingStats(tenantId: string) {
  const now = new Date();
  const [pending, upcoming, unpaidInvoices] = await Promise.all([
    db.booking.count({ where: { tenantId, status: "PENDING" } }),
    db.booking.count({ where: { tenantId, status: "CONFIRMED", startsAt: { gte: now } } }),
    db.invoice.count({ where: { tenantId, status: "OPEN" } }),
  ]);
  return { pending, upcoming, unpaidInvoices };
}

/** Teilt Buchungen in kommende (aktiv) und vergangene/beendete. */
export function partitionBookings<T extends { endsAt: Date; status: string; startsAt: Date }>(list: T[]) {
  const now = Date.now();
  const upcoming = list.filter((b) => b.endsAt.getTime() >= now && ["PENDING", "CONFIRMED"].includes(b.status)).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const past = list.filter((b) => !upcoming.includes(b));
  return { upcoming, past };
}

/** Stornierbarkeit einer Buchung aus Sicht des Aufrufers. */
export function cancellationInfo(b: { startsAt: Date; status: string }, cancellationHours: number, isAdmin: boolean) {
  const active = ["PENDING", "CONFIRMED"].includes(b.status);
  const hoursAhead = (b.startsAt.getTime() - Date.now()) / 3_600_000;
  return { active, canCancel: active && (isAdmin || hoursAhead >= cancellationHours) };
}
