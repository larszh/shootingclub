import { describe, expect, it } from "vitest";
import { applyPriceFactor, applyPriceFactorCents, bookingAccess, checkGuestShare, clampFactor, formatHours, guestMayCancel, ownerBadge, partnerBadge, partnerLookupKeys, partnerReport, type ShareCheckInput } from "./logic";
import { quotePrice } from "../bookings/pricing";

describe("Preisfaktor", () => {
  it("rechnet Prozent auf 5 Rappen gerundet", () => {
    expect(applyPriceFactorCents(1800, 120)).toBe(2160);
    expect(applyPriceFactorCents(1000, 100)).toBe(1000);
    expect(applyPriceFactorCents(1010, 115)).toBe(1160); // 1161.5 → 1160
    expect(applyPriceFactorCents(1000, 0)).toBe(0);
    expect(applyPriceFactorCents(0, 150)).toBe(0);
    expect(applyPriceFactorCents(-100, 150)).toBe(0);
  });

  it("begrenzt den Faktor auf 0–500 %", () => {
    expect(clampFactor(-20)).toBe(0);
    expect(clampFactor(9999)).toBe(500);
    expect(clampFactor(Number.NaN)).toBe(100);
    expect(clampFactor(119.6)).toBe(120);
  });

  it("lässt den Preis bei 100 % unverändert", () => {
    const q = quotePrice({ minutes: 60, priceCents: 1800 }, new Date("2030-01-01T10:00:00Z"), { lastMinuteDiscountPercent: 0, lastMinuteWindowHours: 24 }, 1, new Date("2029-12-01T10:00:00Z"));
    expect(applyPriceFactor(q, 100)).toBe(q);
  });

  it("skaliert Grundpreis und Spontan-Rabatt getrennt", () => {
    const now = new Date("2030-01-01T08:00:00Z");
    const q = quotePrice({ minutes: 60, priceCents: 2000 }, new Date("2030-01-01T10:00:00Z"), { lastMinuteDiscountPercent: 20, lastMinuteWindowHours: 24 }, 1, now);
    expect(q.totalCents).toBe(1600);
    const p = applyPriceFactor(q, 120);
    expect(p.basePriceCents).toBe(2400);
    expect(p.discountCents).toBe(480);
    expect(p.totalCents).toBe(1920);
    expect(p.discountReason).toBe("Spontan-Rabatt 20%");
    expect(p.detail).toBe("Partnertarif 120 %");
  });

  it("gilt auch für Personen- und Pauschalpreise", () => {
    const opt = { minutes: 60, priceCents: 1000, flatFromPersons: 4, flatPriceCents: 3000 };
    const settings = { lastMinuteDiscountPercent: 0, lastMinuteWindowHours: 24, personPricing: true };
    const at = new Date("2030-01-01T10:00:00Z");
    const now = new Date("2029-01-01T10:00:00Z");
    expect(applyPriceFactor(quotePrice(opt, at, settings, 3, now), 150).totalCents).toBe(4500);
    const flat = applyPriceFactor(quotePrice(opt, at, settings, 5, now), 150);
    expect(flat.totalCents).toBe(4500);
    expect(flat.isFlatRate).toBe(true);
  });

  it("gratis bleibt gratis", () => {
    const q = quotePrice({ minutes: 60, priceCents: 0 }, new Date("2030-01-01T10:00:00Z"), { lastMinuteDiscountPercent: 0, lastMinuteWindowHours: 24 });
    expect(applyPriceFactor(q, 200).totalCents).toBe(0);
  });
});

describe("Partnerverein suchen", () => {
  it("normalisiert Kurzname und Beitrittscode", () => {
    expect(partnerLookupKeys("  SG-Musterhausen ")).toEqual({ slug: "sg-musterhausen", joinCode: "SG-MUSTERHAUSEN", joinCodeRaw: "SG-Musterhausen" });
    expect(partnerLookupKeys("demo42")?.joinCode).toBe("DEMO42");
    expect(partnerLookupKeys("https://standchef.ch/embed/sg-muster")?.slug).toBe("sg-muster");
  });
  it("weist unsinnige Eingaben ab", () => {
    expect(partnerLookupKeys("")).toBeNull();
    expect(partnerLookupKeys("a b")).toBeNull();
    expect(partnerLookupKeys("x".repeat(65))).toBeNull();
    expect(partnerLookupKeys("'; DROP")).toBeNull();
  });
});

describe("checkGuestShare", () => {
  const base: ShareCheckInput = {
    guestRole: "MEMBER",
    guestTenantId: "guest",
    resourceId: "r1",
    resource: { tenantId: "owner", isActive: true },
    owner: { id: "owner", deletedAt: null, bookingsEnabled: true },
    share: { resourceId: "r1", guestTenantId: "guest", canBook: true },
  };
  it("erlaubt eine gültige Freigabe", () => {
    expect(checkGuestShare(base)).toEqual({ ok: true });
  });
  it("verlangt eine Mitgliedschaft im Gastverein", () => {
    expect(checkGuestShare({ ...base, guestRole: null }).ok).toBe(false);
  });
  it("verlangt eine Freigabe für genau diesen Verein und diese Ressource", () => {
    expect(checkGuestShare({ ...base, share: null }).ok).toBe(false);
    expect(checkGuestShare({ ...base, share: { ...base.share!, guestTenantId: "other" } }).ok).toBe(false);
    expect(checkGuestShare({ ...base, share: { ...base.share!, resourceId: "r2" } }).ok).toBe(false);
  });
  it("Ressource muss dem Eigentümer gehören", () => {
    expect(checkGuestShare({ ...base, resource: { tenantId: "third", isActive: true } }).ok).toBe(false);
    expect(checkGuestShare({ ...base, resource: null }).ok).toBe(false);
  });
  it("nicht für den eigenen Verein", () => {
    expect(checkGuestShare({ ...base, guestTenantId: "owner", share: { ...base.share!, guestTenantId: "owner" } }).ok).toBe(false);
  });
  it("pausiert, gelöscht, Modul aus oder inaktiv", () => {
    expect(checkGuestShare({ ...base, share: { ...base.share!, canBook: false } })).toEqual({ ok: false, error: expect.stringContaining("pausiert") });
    expect(checkGuestShare({ ...base, owner: { ...base.owner!, deletedAt: new Date() } }).ok).toBe(false);
    expect(checkGuestShare({ ...base, owner: { ...base.owner!, bookingsEnabled: false } }).ok).toBe(false);
    expect(checkGuestShare({ ...base, resource: { tenantId: "owner", isActive: false } }).ok).toBe(false);
  });
});

describe("bookingAccess", () => {
  const viewer = { userId: "u1", activeTenantId: "owner", canManageActive: false };
  it("eigene Buchung im eigenen Verein", () => {
    expect(bookingAccess({ tenantId: "owner", userId: "u1", viaTenantId: null }, viewer)).toBe("owner");
  });
  it("Verwaltung des Eigentümers sieht alle Buchungen, auch von Partnern", () => {
    expect(bookingAccess({ tenantId: "owner", userId: "u2", viaTenantId: "guest" }, { ...viewer, canManageActive: true })).toBe("admin");
    expect(bookingAccess({ tenantId: "owner", userId: "u2", viaTenantId: null }, viewer)).toBeNull();
  });
  it("Gast sieht nur die eigene Partnerbuchung", () => {
    const b = { tenantId: "owner", userId: "u1", viaTenantId: "guest" };
    expect(bookingAccess(b, { userId: "u1", activeTenantId: "guest", canManageActive: false })).toBe("guest");
    expect(bookingAccess(b, { userId: "u9", activeTenantId: "guest", canManageActive: false })).toBeNull();
  });
  it("Verwaltung des Gastvereins sieht fremde Partnerbuchungen nicht", () => {
    expect(bookingAccess({ tenantId: "owner", userId: "u1", viaTenantId: "guest" }, { userId: "admin", activeTenantId: "guest", canManageActive: true })).toBeNull();
  });
  it("ohne viaTenantId keine Sicht aus einem anderen Verein", () => {
    expect(bookingAccess({ tenantId: "owner", userId: "u1", viaTenantId: null }, { userId: "u1", activeTenantId: "guest", canManageActive: true })).toBeNull();
    expect(bookingAccess({ tenantId: "owner", userId: null, viaTenantId: "guest" }, { userId: "u1", activeTenantId: "guest", canManageActive: true })).toBeNull();
  });
});

describe("guestMayCancel", () => {
  const now = new Date("2030-01-01T10:00:00Z");
  it("nach den Stunden des Eigentümers", () => {
    expect(guestMayCancel({ status: "CONFIRMED", startsAt: new Date("2030-01-02T12:00:00Z") }, 24, now).ok).toBe(true);
    expect(guestMayCancel({ status: "CONFIRMED", startsAt: new Date("2030-01-02T09:00:00Z") }, 24, now).ok).toBe(false);
    expect(guestMayCancel({ status: "CANCELLED", startsAt: new Date("2030-02-01T09:00:00Z") }, 0, now).ok).toBe(false);
  });
});

describe("partnerReport", () => {
  it("summiert bestätigte Buchungen pro Partnerverein", () => {
    const list = [
      { viaTenantId: "a", status: "CONFIRMED", durationMinutes: 90, persons: 2, totalCents: 3000, paymentStatus: "PAID" },
      { viaTenantId: "a", status: "CONFIRMED", durationMinutes: 60, persons: 1, totalCents: 2000, paymentStatus: "UNPAID" },
      { viaTenantId: "a", status: "CANCELLED", durationMinutes: 60, persons: 1, totalCents: 2000, paymentStatus: "NOT_REQUIRED" },
      { viaTenantId: "b", status: "CONFIRMED", durationMinutes: 30, persons: 4, totalCents: 8000, paymentStatus: "UNPAID" },
      { viaTenantId: "b", status: "PENDING", durationMinutes: 30, persons: 4, totalCents: 8000, paymentStatus: "UNPAID" },
      { viaTenantId: null, status: "CONFIRMED", durationMinutes: 60, persons: 1, totalCents: 1000, paymentStatus: "PAID" },
      { viaTenantId: "gone", status: "CONFIRMED", durationMinutes: 60, persons: 1, totalCents: 0, paymentStatus: "NOT_REQUIRED" },
    ];
    const r = partnerReport(list, { a: "SG Alpha", b: "PC Beta" });
    expect(r.rows.map((x) => x.name)).toEqual(["PC Beta", "SG Alpha", "Partnerverein (gelöscht)"]);
    const alpha = r.rows.find((x) => x.tenantId === "a")!;
    expect(alpha).toMatchObject({ bookings: 2, minutes: 150, hours: 2.5, persons: 3, amountCents: 5000, paidCents: 3000, openCents: 2000 });
    expect(r.total).toMatchObject({ bookings: 4, minutes: 240, hours: 4, persons: 8, amountCents: 13000, paidCents: 3000, openCents: 10000 });
  });
  it("formatiert Stunden", () => {
    expect(formatHours(2)).toBe("2");
    expect(formatHours(2.5)).toBe("2.5");
    expect(formatHours(1.25)).toBe("1.25");
  });
});

describe("Abzeichen", () => {
  it("kennzeichnet fremde Anlagen und Partnerbuchungen", () => {
    expect(ownerBadge({ tenantId: "o", tenant: { name: "SV Ost" } }, "g")).toBe("Anlage von SV Ost");
    expect(ownerBadge({ tenantId: "g", tenant: { name: "SV G" } }, "g")).toBeNull();
    expect(partnerBadge({ viaTenantId: "g" }, { g: "SG Gast" })).toBe("Partner: SG Gast");
    expect(partnerBadge({ viaTenantId: null }, {})).toBeNull();
  });
});
