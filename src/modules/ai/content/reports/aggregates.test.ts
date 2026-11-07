import { describe, expect, it } from "vitest";
import { buildReportPrompt } from "../prompts";
import { buildReportAggregates, chf, parseReportYear, reportPromptPayload, type ReportInput } from "./aggregates";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

const input: ReportInput = {
  year: 2025,
  memberships: [
    { status: "ACTIVE", joinedAt: d("2010-03-01"), leftAt: null, birthYear: 1970 },
    { status: "ACTIVE", joinedAt: d("2025-04-01"), leftAt: null, birthYear: 1990 },
    { status: "JUNIOR", joinedAt: d("2025-05-01"), leftAt: null, birthYear: 2008 },
    { status: "ACTIVE", joinedAt: null, leftAt: null, birthYear: 2006 }, // 19 → Junior nach Alter
    { status: "LEFT", joinedAt: d("2001-01-01"), leftAt: d("2025-12-31"), birthYear: 1950 },
    { status: "LEFT", joinedAt: d("2001-01-01"), leftAt: d("2026-01-15"), birthYear: 1950 }, // am 31.12.2025 noch dabei
    { status: "PASSIVE", joinedAt: d("2026-02-01"), leftAt: null, birthYear: 1980 }, // erst 2026
    { status: "PENDING", joinedAt: null, leftAt: null, birthYear: 1999 },
    { status: "LEFT", joinedAt: null, leftAt: null, birthYear: null },
  ],
  events: [
    { kind: "TRAINING", isCancelled: false, yes: 10, guests: 2 },
    { kind: "TRAINING", isCancelled: true, yes: 4, guests: 0 },
    { kind: "MEETING", isCancelled: false, yes: 30, guests: 0 },
  ],
  bookings: [{ status: "CONFIRMED", persons: 2 }, { status: "CONFIRMED", persons: 3 }, { status: "CANCELLED", persons: 1 }, { status: "PENDING", persons: 1 }],
  op: [
    { userId: "u1", passed: true, attempt: 1, date: d("2025-05-01") },
    { userId: "u2", passed: false, attempt: 1, date: d("2025-05-01") },
    { userId: "u2", passed: true, attempt: 2, date: d("2025-06-01") },
    { userId: "u3", passed: false, attempt: 1, date: d("2025-06-01") },
  ],
  fs: [{ userId: "u1", isOfficial: true }, { userId: "u1", isOfficial: true }, { userId: null, isOfficial: false }],
  championships: [
    { name: "Jahresmeisterschaft 300 m", isPublished: true, classified: 12, podium: [{ rank: 2, name: "Beat Muster", total: 480 }, { rank: 1, name: "Anna Schütz", total: 492 }] },
    { name: "Geheime Meisterschaft", isPublished: false, classified: 3, podium: [{ rank: 1, name: "Hans Versteckt", total: 400 }] },
  ],
  finance: [
    { kind: "fee", type: "issue", amountCents: 10_000, currency: "CHF" },
    { kind: "fee", type: "issue", amountCents: 10_000, currency: "CHF" },
    { kind: "fee", type: "reversal", amountCents: 10_000, currency: "CHF" },
    { kind: "fee", type: "payment", amountCents: 10_000, currency: "CHF" },
    { kind: "ammo", type: "payment", amountCents: 2_550, currency: "CHF" },
    { kind: "booking", type: "payment", amountCents: 5_000, currency: "EUR" },
    { kind: "kiosk", type: "refund", amountCents: 100, currency: "CHF" },
  ],
};

describe("buildReportAggregates", () => {
  const a = buildReportAggregates(input);

  it("Mitglieder: Bestand am Jahresende, Ein-/Austritte, Junioren", () => {
    expect(a.members.atYearEnd).toBe(5);
    expect(a.members.joined).toBe(2);
    expect(a.members.left).toBe(1);
    expect(a.members.juniors).toBe(2);
    expect(a.members.byStatus).toMatchObject({ ACTIVE: 3, JUNIOR: 1, PASSIVE: 0 });
  });

  it("Anlässe, Reservationen, Bundesübungen", () => {
    expect(a.events).toEqual({ held: 2, cancelled: 1, byKind: { TRAINING: 1, MEETING: 1 }, registrations: 42 });
    expect(a.bookings).toEqual({ confirmed: 2, cancelled: 1, persons: 5 });
    expect(a.op).toEqual({ shooters: 3, passed: 2, remaining: 1, passRatePercent: expect.any(Number) });
    expect(a.op!.passRatePercent).toBeCloseTo(66.7, 0);
    expect(a.fs).toEqual({ participants: 2, members: 1, guests: 1 });
  });

  it("Meisterschaft nur veröffentlicht, Podest sortiert", () => {
    expect(a.championships).toHaveLength(1);
    expect(a.championships![0]!.podium.map((p) => p.rank)).toEqual([1, 2]);
  });

  it("Finanzen: nur CHF, Storno und Rückerstattung abgezogen", () => {
    expect(a.finance!.revenue.fee).toEqual({ invoicedCents: 10_000, receivedCents: 10_000 });
    expect(a.finance!.revenue.ammo.receivedCents).toBe(2_550);
    expect(a.finance!.revenue.booking.receivedCents).toBe(0);
    expect(a.finance!.totals).toEqual({ invoicedCents: 10_000, receivedCents: 12_450 });
  });

  it("inaktive Module bleiben null", () => {
    const b = buildReportAggregates({ ...input, events: null, bookings: null, op: null, fs: null, championships: null, finance: null });
    expect(b.events).toBeNull();
    expect(reportPromptPayload(b)).toMatchObject({ events: null, rangeBookings: null, obligatoryProgramme: null, revenueFromApp: null, annualChampionships: null });
  });
});

describe("reportPromptPayload: keine Personendaten", () => {
  it("enthält keine Namen, IDs oder Geburtsjahre – nur Zahlen", () => {
    const payload = reportPromptPayload(buildReportAggregates(input));
    const prompt = buildReportPrompt({ locale: "de", clubName: "SV Muster", year: 2025, payload });
    const all = prompt.system + prompt.systemExtra + prompt.user;
    for (const secret of ["Beat Muster", "Anna Schütz", "Hans Versteckt", "Geheime Meisterschaft", "u1", "u2", "1970", "2008"]) {
      expect(all).not.toContain(secret);
    }
    expect(prompt.user).toContain("Jahresmeisterschaft 300 m");
    expect(prompt.user).toContain("CHF 100.00");
    expect(payload.annualChampionships).toEqual([{ name: "Jahresmeisterschaft 300 m", classifiedShooters: 12 }]);
  });
});

describe("Hilfen", () => {
  it("chf", () => {
    expect(chf(438_000)).toBe("CHF 4’380.00");
    expect(chf(-150)).toBe("-CHF 1.50");
    expect(chf(5)).toBe("CHF 0.05");
  });
  it("parseReportYear", () => {
    expect(parseReportYear("2024", 2026)).toBe(2024);
    expect(parseReportYear("2027", 2026)).toBe(2025);
    expect(parseReportYear("abc", 2026)).toBe(2025);
    expect(parseReportYear(undefined, 2026)).toBe(2025);
  });
});
