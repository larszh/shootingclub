import type { DurationOption } from "./types";

export type PricingSettings = { lastMinuteDiscountPercent: number; lastMinuteWindowHours: number };

export type PriceQuote = { basePriceCents: number; discountCents: number; discountReason: string | null; totalCents: number };

export function quotePrice(option: DurationOption, startsAt: Date, settings: PricingSettings, now = new Date()): PriceQuote {
  const base = option.priceCents;
  let discount = 0;
  let reason: string | null = null;
  if (base > 0 && settings.lastMinuteDiscountPercent > 0) {
    const hoursAhead = (startsAt.getTime() - now.getTime()) / 3_600_000;
    if (hoursAhead <= settings.lastMinuteWindowHours) {
      discount = Math.round((base * settings.lastMinuteDiscountPercent) / 100);
      reason = `Spontan-Rabatt ${settings.lastMinuteDiscountPercent}%`;
    }
  }
  return { basePriceCents: base, discountCents: discount, discountReason: reason, totalCents: Math.max(0, base - discount) };
}
