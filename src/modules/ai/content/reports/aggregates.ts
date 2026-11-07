/**
 * Jahresbericht: Kennzahlen eines Vereinsjahrs (reine Logik, getestet).
 * Die Abfragen (queries.ts) liefern nur die nötigen Felder; hier entstehen daraus Zahlen.
 * An Claude geht ausschliesslich reportPromptPayload() – ohne Namen oder andere Personendaten.
 */
import { fsStats, isJunior, opStats, passRate, type FsLite } from "@/modules/association/stats";
import type { OfficialResultLite } from "@/modules/federal/types";

export const REPORT_MIN_YEAR = 2000;

/** Jahr aus der URL; ungültig → Vorjahr (der GV-Bericht betrifft meist das abgeschlossene Jahr). */
export function parseReportYear(raw: string | null | undefined, currentYear: number): number {
  const n = Number(raw);
  if (Number.isInteger(n) && n >= REPORT_MIN_YEAR && n <= currentYear) return n;
  return currentYear - 1 >= REPORT_MIN_YEAR ? currentYear - 1 : currentYear;
}

export type MembershipLite = { status: string; joinedAt: Date | null; leftAt: Date | null; birthYear: number | null };
export type EventLite = { kind: string; isCancelled: boolean; yes: number; guests: number };
export type BookingLite = { status: string; persons: number };
export type ChampionshipLite = {
  name: string;
  isPublished: boolean;
  classified: number;
  /** Rangierte (Rang 1–3). Namen bleiben in der App, gehen nie an Claude. */
  podium: Array<{ rank: number; name: string; total: number }>;
};
export type FinanceEntryLite = { kind: string; type: string; amountCents: number; currency: string };

export type ReportInput = {
  year: number;
  memberships: readonly MembershipLite[];
  /** null = Modul nicht aktiv */
  events: readonly EventLite[] | null;
  bookings: readonly BookingLite[] | null;
  op: readonly OfficialResultLite[] | null;
  fs: readonly FsLite[] | null;
  championships: readonly ChampionshipLite[] | null;
  finance: readonly FinanceEntryLite[] | null;
};

const MEMBER_STATUSES = ["ACTIVE", "PASSIVE", "HONORARY", "JUNIOR", "SUPPORTER"] as const;
const FINANCE_KINDS = ["fee", "workfee", "booking", "ammo", "kiosk"] as const;
export type FinanceKind = (typeof FINANCE_KINDS)[number];

/** Kalendertag eines @db.Date-Werts (UTC-Mitternacht). */
function day(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

export type ReportAggregates = ReturnType<typeof buildReportAggregates>;

export function buildReportAggregates(input: ReportInput) {
  const y = input.year;
  const first = `${y}-01-01`;
  const last = `${y}-12-31`;

  // Mitglieder: Bestand am Jahresende, Ein- und Austritte im Jahr
  let joined = 0;
  let left = 0;
  let total = 0;
  let juniors = 0;
  const byStatus: Record<string, number> = Object.fromEntries(MEMBER_STATUSES.map((s) => [s, 0]));
  for (const m of input.memberships) {
    if (m.status === "PENDING") continue;
    const j = day(m.joinedAt);
    const l = day(m.leftAt);
    if (j && j >= first && j <= last) joined += 1;
    if (l && l >= first && l <= last) left += 1;
    const inAtEnd = (!j || j <= last) && (l ? l > last : m.status !== "LEFT");
    if (!inAtEnd) continue;
    total += 1;
    if (m.status in byStatus) byStatus[m.status]! += 1;
    if (isJunior({ status: m.status, birthYear: m.birthYear }, y)) juniors += 1;
  }
  const members = { atYearEnd: total, joined, left, juniors, byStatus };

  const events = input.events
    ? (() => {
        const byKind: Record<string, number> = {};
        let held = 0;
        let cancelled = 0;
        let registrations = 0;
        for (const e of input.events) {
          if (e.isCancelled) {
            cancelled += 1;
            continue;
          }
          held += 1;
          byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;
          registrations += e.yes + e.guests;
        }
        return { held, cancelled, byKind, registrations };
      })()
    : null;

  const bookings = input.bookings
    ? {
        confirmed: input.bookings.filter((b) => b.status === "CONFIRMED").length,
        cancelled: input.bookings.filter((b) => b.status === "CANCELLED").length,
        persons: input.bookings.filter((b) => b.status === "CONFIRMED").reduce((a, b) => a + Math.max(0, b.persons), 0),
      }
    : null;

  const op = input.op
    ? (() => {
        const s = opStats(input.op);
        return { shooters: s.shooters, passed: s.passed, remaining: s.remaining, passRatePercent: passRate(s) };
      })()
    : null;

  const fs = input.fs ? (() => {
    const s = fsStats(input.fs);
    return { participants: s.participants, members: s.members, guests: s.guests };
  })() : null;

  const published = input.championships ? input.championships.filter((c) => c.isPublished) : null;
  const championships = published
    ? published.map((c) => ({ name: c.name, classified: c.classified, podium: c.podium.filter((p) => p.rank >= 1 && p.rank <= 3).sort((a, b) => a.rank - b.rank) }))
    : null;

  const finance = input.finance
    ? (() => {
        const revenue: Record<FinanceKind, { invoicedCents: number; receivedCents: number }> = Object.fromEntries(
          FINANCE_KINDS.map((k) => [k, { invoicedCents: 0, receivedCents: 0 }]),
        ) as Record<FinanceKind, { invoicedCents: number; receivedCents: number }>;
        for (const e of input.finance) {
          if (e.currency !== "CHF" || !(FINANCE_KINDS as readonly string[]).includes(e.kind)) continue;
          const r = revenue[e.kind as FinanceKind];
          if (e.type === "issue") r.invoicedCents += e.amountCents;
          else if (e.type === "reversal") r.invoicedCents -= e.amountCents;
          else if (e.type === "payment") r.receivedCents += e.amountCents;
          else if (e.type === "refund") r.receivedCents -= e.amountCents;
        }
        const totals = Object.values(revenue).reduce((a, r) => ({ invoicedCents: a.invoicedCents + r.invoicedCents, receivedCents: a.receivedCents + r.receivedCents }), { invoicedCents: 0, receivedCents: 0 });
        return { currency: "CHF" as const, revenue, totals };
      })()
    : null;

  return { year: y, members, events, bookings, op, fs, championships, finance };
}

/** Rappen → «CHF 1’234.00» (Format der App, in allen Sprachen gleich). */
export function chf(cents: number): string {
  const neg = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const whole = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "’");
  return `${neg ? "-" : ""}CHF ${whole}.${String(abs % 100).padStart(2, "0")}`;
}

const FINANCE_LABEL: Record<FinanceKind, string> = {
  fee: "membership fees",
  workfee: "substitute fee for work hours",
  booking: "range rental / bookings",
  ammo: "ammunition sales",
  kiosk: "clubhouse kiosk",
};

const KIND_LABEL: Record<string, string> = {
  TRAINING: "trainings",
  COMPETITION: "competitions",
  OBLIGATORY: "obligatory programme dates",
  MEETING: "meetings / assemblies",
  SOCIAL: "social events",
  WORK: "work assignments",
  OTHER: "other",
};

/**
 * Daten für Claude: nur Zahlen und Bezeichnungen (Programm-/Meisterschaftsnamen), keine Namen
 * von Personen, keine Kontakt- oder Geburtsdaten. Leere Bereiche bleiben null.
 */
export function reportPromptPayload(a: ReportAggregates) {
  return {
    year: a.year,
    members: {
      atYearEnd: a.members.atYearEnd,
      joinedDuringYear: a.members.joined,
      leftDuringYear: a.members.left,
      juniorsUpTo20: a.members.juniors,
      byStatus: {
        active: a.members.byStatus.ACTIVE ?? 0,
        passive: a.members.byStatus.PASSIVE ?? 0,
        honorary: a.members.byStatus.HONORARY ?? 0,
        junior: a.members.byStatus.JUNIOR ?? 0,
        supporter: a.members.byStatus.SUPPORTER ?? 0,
      },
    },
    events: a.events && (a.events.held || a.events.cancelled)
      ? {
          held: a.events.held,
          cancelled: a.events.cancelled,
          byKind: Object.fromEntries(Object.entries(a.events.byKind).map(([k, n]) => [KIND_LABEL[k] ?? "other", n])),
          registrationsInclGuests: a.events.registrations,
        }
      : null,
    rangeBookings: a.bookings && (a.bookings.confirmed || a.bookings.cancelled) ? a.bookings : null,
    obligatoryProgramme: a.op && a.op.shooters ? a.op : null,
    fieldShooting: a.fs && a.fs.participants ? a.fs : null,
    annualChampionships: a.championships && a.championships.length
      ? a.championships.map((c) => ({ name: c.name, classifiedShooters: c.classified }))
      : null,
    revenueFromApp: a.finance && (a.finance.totals.invoicedCents || a.finance.totals.receivedCents)
      ? {
          note: "Revenue booked through the app only (no expenses, not the annual accounts).",
          byKind: Object.fromEntries(
            Object.entries(a.finance.revenue)
              .filter(([, r]) => r.invoicedCents || r.receivedCents)
              .map(([k, r]) => [FINANCE_LABEL[k as FinanceKind], { invoiced: chf(r.invoicedCents), received: chf(r.receivedCents) }]),
          ),
          total: { invoiced: chf(a.finance.totals.invoicedCents), received: chf(a.finance.totals.receivedCents) },
        }
      : null,
  };
}
