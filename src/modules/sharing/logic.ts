/**
 * Gemeinsame Anlagen (ResourceShare): reine Funktionen für Preis und Berechtigungen.
 * Bewusst ohne Datenbank und ohne "server-only", damit sie in Tests und im Client laufen.
 */

/** Erlaubter Bereich für den Preisfaktor der Partnervereine (in Prozent). */
export const PRICE_FACTOR_MIN = 0;
export const PRICE_FACTOR_MAX = 500;

/** Faktor auf einen Betrag anwenden, gerundet auf 5 Rappen (Schweizer Rundung). */
export function applyPriceFactorCents(cents: number, percent: number) {
  if (!Number.isFinite(cents) || cents <= 0) return 0;
  const p = clampFactor(percent);
  return Math.round((cents * p) / 100 / 5) * 5;
}

export function clampFactor(percent: number) {
  if (!Number.isFinite(percent)) return 100;
  return Math.min(PRICE_FACTOR_MAX, Math.max(PRICE_FACTOR_MIN, Math.round(percent)));
}

type QuoteLike = { basePriceCents: number; discountCents: number; discountReason: string | null; totalCents: number; detail?: string | null };

/**
 * Preis des Eigentümers mit dem Faktor des Partnervereins. Grundpreis und Rabatt werden einzeln
 * umgerechnet (der Spontan-Rabatt bleibt prozentual gleich), das Total ergibt sich daraus.
 * Bei einem Faktor ungleich 100 % ersetzt `detail` den Rechenweg durch «Partnertarif 120 %».
 */
export function applyPriceFactor<T extends QuoteLike>(quote: T, percent: number): T {
  const p = clampFactor(percent);
  if (p === 100) return quote;
  const base = applyPriceFactorCents(quote.basePriceCents, p);
  const discount = Math.min(base, applyPriceFactorCents(quote.discountCents, p));
  return { ...quote, basePriceCents: base, discountCents: discount, totalCents: Math.max(0, base - discount), detail: partnerRateLabel(p) };
}

export function partnerRateLabel(percent: number) {
  return `Partnertarif ${clampFactor(percent)} %`;
}

// ---------------------------------------------------------------------------
// Partnerverein suchen
// ---------------------------------------------------------------------------

/** Eingabe «Kurzname oder Beitrittscode» in Suchwerte übersetzen (Slug klein, Code gross). */
export function partnerLookupKeys(input: string) {
  const raw = input.trim().replace(/^.*\/(?=[^/]+$)/, ""); // auch eine eingefügte URL mit Slug am Ende
  if (!raw || raw.length > 64 || !/^[\w-]+$/.test(raw)) return null;
  return { slug: raw.toLowerCase(), joinCode: raw.toUpperCase(), joinCodeRaw: raw };
}

// ---------------------------------------------------------------------------
// Berechtigungen
// ---------------------------------------------------------------------------

export type ShareCheckInput = {
  /** Mitgliedschaft des Gastes im aktiven Verein (null = keine, z.B. Super-Admin ohne Mitgliedschaft). */
  guestRole: string | null;
  guestTenantId: string;
  resource: { tenantId: string; isActive: boolean } | null;
  owner: { id: string; deletedAt: Date | null; bookingsEnabled: boolean } | null;
  share: { resourceId: string; guestTenantId: string; canBook: boolean } | null;
  resourceId: string;
};

export type ShareCheck = { ok: true } | { ok: false; error: string };

const NOT_SHARED = "Diese Anlage ist für deinen Verein nicht freigegeben.";

/**
 * Darf ein Mitglied des aktiven Vereins (Gast) diese Ressource eines anderen Vereins sehen und buchen?
 * Verlangt: Mitgliedschaft im Gastverein, Ressource gehört dem Eigentümer, aktive Freigabe für genau
 * diesen Gastverein mit «darf buchen», Eigentümer nicht gelöscht und Modul «Reservationen» aktiv.
 */
export function checkGuestShare(i: ShareCheckInput): ShareCheck {
  if (!i.guestRole) return { ok: false, error: NOT_SHARED };
  if (!i.resource || !i.owner || !i.share) return { ok: false, error: NOT_SHARED };
  if (i.resource.tenantId !== i.owner.id) return { ok: false, error: NOT_SHARED };
  if (i.owner.id === i.guestTenantId) return { ok: false, error: NOT_SHARED };
  if (i.share.resourceId !== i.resourceId || i.share.guestTenantId !== i.guestTenantId) return { ok: false, error: NOT_SHARED };
  if (!i.share.canBook) return { ok: false, error: "Der Eigentümer hat Buchungen für deinen Verein pausiert." };
  if (i.owner.deletedAt || !i.owner.bookingsEnabled) return { ok: false, error: "Der Verein dieser Anlage nimmt zurzeit keine Reservationen an." };
  if (!i.resource.isActive) return { ok: false, error: "Ressource nicht verfügbar." };
  return { ok: true };
}

export type BookingAccess = "owner" | "admin" | "guest" | null;

/**
 * Wer darf eine Buchung sehen?
 * - Im eigenen Verein (aktiver Verein = Eigentümer): das buchende Mitglied und die Verwaltung.
 * - Buchung eines Partnervereins (viaTenantId gesetzt): zusätzlich nur das buchende Mitglied selbst,
 *   auch ohne Mitgliedschaft im Eigentümer-Verein. Die Verwaltung des Gastvereins sieht sie nicht.
 */
export function bookingAccess(
  b: { tenantId: string; userId: string | null; viaTenantId: string | null },
  viewer: { userId: string; activeTenantId: string; canManageActive: boolean },
): BookingAccess {
  if (b.tenantId === viewer.activeTenantId) {
    if (b.userId && b.userId === viewer.userId) return "owner";
    if (viewer.canManageActive) return "admin";
    return null;
  }
  if (b.viaTenantId && b.userId && b.userId === viewer.userId) return "guest";
  return null;
}

/** Stornierung durch Mitglied oder Gast nach den Regeln des Vereins, dem die Anlage gehört (Stunden vor Beginn). */
export function guestMayCancel(b: { status: string; startsAt: Date }, cancellationHours: number, now = new Date()) {
  if (!["PENDING", "CONFIRMED"].includes(b.status)) return { ok: false as const, error: "Buchung ist bereits beendet." };
  const hoursAhead = (b.startsAt.getTime() - now.getTime()) / 3_600_000;
  if (hoursAhead < cancellationHours) return { ok: false as const, error: `Stornierung nur bis ${cancellationHours} Stunden vor Beginn möglich.` };
  return { ok: true as const };
}

// ---------------------------------------------------------------------------
// Auswertung pro Partnerverein
// ---------------------------------------------------------------------------

export type PartnerReportBooking = { viaTenantId: string | null; status: string; durationMinutes: number; persons: number; totalCents: number; paymentStatus: string };
export type PartnerReportRow = { tenantId: string; name: string; bookings: number; minutes: number; hours: number; persons: number; amountCents: number; paidCents: number; openCents: number };

/**
 * Summen pro Partnerverein: nur bestätigte Buchungen zählen (keine Anfragen, Stornierungen, Ablehnungen).
 * Sortiert nach Betrag, dann Name.
 */
export function partnerReport(list: PartnerReportBooking[], names: Record<string, string>): { rows: PartnerReportRow[]; total: Omit<PartnerReportRow, "tenantId" | "name"> } {
  const map = new Map<string, PartnerReportRow>();
  for (const b of list) {
    if (!b.viaTenantId || b.status !== "CONFIRMED") continue;
    const row = map.get(b.viaTenantId) ?? { tenantId: b.viaTenantId, name: names[b.viaTenantId] ?? "Partnerverein (gelöscht)", bookings: 0, minutes: 0, hours: 0, persons: 0, amountCents: 0, paidCents: 0, openCents: 0 };
    row.bookings++;
    row.minutes += b.durationMinutes;
    row.persons += b.persons;
    row.amountCents += b.totalCents;
    if (b.paymentStatus === "PAID") row.paidCents += b.totalCents;
    else if (b.totalCents > 0 && b.paymentStatus !== "REFUNDED" && b.paymentStatus !== "NOT_REQUIRED") row.openCents += b.totalCents;
    map.set(b.viaTenantId, row);
  }
  const rows = [...map.values()].map((r) => ({ ...r, hours: Math.round((r.minutes / 60) * 100) / 100 }))
    .sort((a, b) => b.amountCents - a.amountCents || a.name.localeCompare(b.name, "de-CH"));
  const total = rows.reduce((t, r) => ({ bookings: t.bookings + r.bookings, minutes: t.minutes + r.minutes, hours: 0, persons: t.persons + r.persons, amountCents: t.amountCents + r.amountCents, paidCents: t.paidCents + r.paidCents, openCents: t.openCents + r.openCents }), { bookings: 0, minutes: 0, hours: 0, persons: 0, amountCents: 0, paidCents: 0, openCents: 0 });
  total.hours = Math.round((total.minutes / 60) * 100) / 100;
  return { rows, total };
}

/** Stunden für Anzeige und CSV: «1.5», «2». */
export function formatHours(h: number) {
  return Number.isInteger(h) ? String(h) : h.toFixed(2).replace(/0$/, "");
}

/** Abzeichen in «Meine Reservationen»: Buchungen auf Anlagen anderer Vereine kennzeichnen. */
export function ownerBadge(b: { tenantId: string; tenant: { name: string } }, activeTenantId: string) {
  return b.tenantId !== activeTenantId ? `Anlage von ${b.tenant.name}` : null;
}

/** Abzeichen in der Verwaltung des Eigentümers für Buchungen eines Partnervereins. */
export function partnerBadge(b: { viaTenantId: string | null }, names: Record<string, string>) {
  if (!b.viaTenantId) return null;
  return `Partner: ${names[b.viaTenantId] ?? "Partnerverein"}`;
}
