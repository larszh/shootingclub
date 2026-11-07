/**
 * Übersetzte Anzeigetexte der Reservationen (Mitgliederseiten). Ohne Server-Abhängigkeiten:
 * Server-Seiten und Client-Komponenten rufen die Helfer mit `getT(locale)` auf.
 * Wörterbuch: src/lib/i18n/extra/bookings.ts (Namensraum «bookings.»).
 */
import { INTL_LOCALE, normalizeLocale, type TFunction } from "@/lib/i18n/core";
import { paymentStatusView } from "./types";

const TZ = "Europe/Zurich";

/** Gründe aus computeSlots/slotsFor (Deutsch) → Schlüssel. Unbekannte Gründe bleiben unverändert. */
const SLOT_REASON_KEY: Record<string, string> = {
  "Zu weit im Voraus": "bookings.reason.tooFar",
  "Zu kurzfristig": "bookings.reason.tooShort",
  "Gesperrt": "bookings.reason.blocked",
  "Belegt": "bookings.reason.taken",
  "Nicht genug Plätze frei": "bookings.reason.notEnough",
  "Ausserhalb der Schiesszeiten": "bookings.reason.outsideWindow",
};

export function slotReasonLabel(reason: string | null | undefined, t: TFunction): string {
  if (!reason) return t("bookings.reason.unavailable");
  const key = SLOT_REASON_KEY[reason];
  return key ? t(key) : reason;
}

/** Fehlertexte aus slotsFor (Deutsch) → Schlüssel. */
const SLOT_ERROR_KEY: Record<string, string> = {
  "Ungültiges Datum": "bookings.err.invalidDate",
  "Ungültige Eingabe": "bookings.err.invalidInput",
  "Ungültige Anzahl Personen": "bookings.err.invalidPersons",
  "Ressource nicht gefunden": "bookings.err.resourceNotFound",
  "Dauer nicht verfügbar": "bookings.err.durationUnavailable",
};

export function slotErrorLabel(error: string, t: TFunction, maxPersons?: number): string {
  const key = SLOT_ERROR_KEY[error];
  if (key) return t(key);
  if (error.startsWith("Höchstens ") && maxPersons) return t(maxPersons === 1 ? "bookings.err.maxPersonsOne" : "bookings.err.maxPersonsMany", { max: maxPersons });
  return error;
}

export type Tone = "neutral" | "accent" | "ok" | "warn" | "outline";

const STATUS_TONE: Record<string, Tone> = { PENDING: "warn", CONFIRMED: "ok", REJECTED: "accent", CANCELLED: "outline" };

export function bookingStatusView(status: string, t: TFunction): { label: string; tone: Tone } {
  const tone = STATUS_TONE[status];
  return tone ? { label: t(`bookings.status.${status}`), tone } : { label: status, tone: "neutral" };
}

const PAYMENT_KEYS = new Set(["NOT_REQUIRED", "UNPAID", "PENDING", "PAID", "FAILED", "REFUNDED"]);

/** Wie paymentStatusView, mit übersetzter Bezeichnung. */
export function paymentStatusViewT(b: { status: string; paymentStatus: string }, t: TFunction) {
  const v = paymentStatusView(b);
  if (v.void) return { ...v, label: t("bookings.payment.void") };
  return { ...v, label: PAYMENT_KEYS.has(b.paymentStatus) ? t(`bookings.payment.${b.paymentStatus}`) : v.label };
}

const METHOD_KEYS = new Set(["NONE", "INVOICE", "ONLINE", "CASH"]);
export function paymentMethodLabel(method: string, t: TFunction) {
  return METHOD_KEYS.has(method) ? t(`bookings.method.${method}`) : method;
}

const KIND_KEYS = new Set(["RANGE", "LANE", "ROOM", "OTHER"]);
export function resourceKindLabelT(kind: string, t: TFunction) {
  return t(`bookings.kind.${KIND_KEYS.has(kind) ? kind : "OTHER"}`);
}

/** «den ganzen Raum», «die ganze Anlage» … */
export function wholeResourceLabelT(kind: string, t: TFunction) {
  return t(`bookings.whole.${KIND_KEYS.has(kind) ? kind : "OTHER"}`);
}

/** «1 Person» / «3 Personen» */
export function personsText(n: number, t: TFunction) {
  return t(n === 1 ? "bookings.persons.one" : "bookings.persons.many", { count: n });
}

export function placesText(n: number, t: TFunction) {
  return t(n === 1 ? "bookings.places.one" : "bookings.places.many", { count: n });
}

/** Spontan-Rabatt in der Anzeige (gespeicherter Grund ist Deutsch, z.B. «Spontan-Rabatt 20%»). */
export function discountReasonLabel(reason: string | null | undefined, t: TFunction): string | null {
  if (!reason) return null;
  const m = /^Spontan-Rabatt (\d+)%$/.exec(reason);
  if (m) return t("bookings.discount.lastMinute", { percent: m[1]! });
  if (reason === "Gratis (Verwaltung)") return t("bookings.discount.freeAdmin");
  return reason;
}

/** Datum in der Sprache, Zeitzone Europe/Zurich. Ohne Optionen «Di., 03.11.2026». */
export function formatDateL(d: Date, locale: string | null | undefined, opts?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(INTL_LOCALE[normalizeLocale(locale)], { timeZone: TZ, weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", ...opts }).format(d);
}

export function formatDateTimeL(d: Date, locale: string | null | undefined) {
  return new Intl.DateTimeFormat(INTL_LOCALE[normalizeLocale(locale)], { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
}

export function formatTimeRangeL(start: Date, end: Date, locale: string | null | undefined) {
  const f = new Intl.DateTimeFormat(INTL_LOCALE[normalizeLocale(locale)], { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return `${f.format(start)}–${f.format(end)}`;
}

/** Kalendertag «YYYY-MM-DD» als «Dienstag, 3. November» in der Sprache. */
export function formatDayLabel(dateStr: string, locale: string | null | undefined) {
  return new Intl.DateTimeFormat(INTL_LOCALE[normalizeLocale(locale)], { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${dateStr}T12:00:00Z`));
}

/** Schiesszeiten eines Tages (aus slotsFor) als Satz in der Sprache der Person, z.B. «Bewilligte Schiesszeiten: Samstag 09:00–17:00». */
export function windowHintLabel(w: { weekday: number; ranges: Array<{ from: string; to: string }> }, locale: string | null | undefined, t: TFunction): string {
  // 2023-01-01 ist ein Sonntag (weekday 0), passend zu getUTCDay().
  const day = new Intl.DateTimeFormat(INTL_LOCALE[normalizeLocale(locale)], { weekday: "long", timeZone: "UTC" })
    .format(new Date(Date.UTC(2023, 0, 1 + w.weekday)));
  const list = w.ranges.length
    ? `${day} ${w.ranges.map((r) => `${r.from}–${r.to}`).join(", ")}`
    : t("bookings.wizard.windowNone", { day });
  return t("bookings.wizard.windowHint", { list });
}

// ---------------------------------------------------------------------------
// Serienbuchungen

/** ISO-Wochentage (1 = Mo … 7 = So, CSV oder Liste) als «Di, Do» bzw. «Dienstag, Donnerstag» in der Sprache. */
export function weekdaysLabelL(days: number[] | string, locale: string | null | undefined, long = false): string {
  const list = (typeof days === "string" ? days.split(",") : days).map(Number).filter((d) => Number.isInteger(d) && d >= 1 && d <= 7);
  const fmt = new Intl.DateTimeFormat(INTL_LOCALE[normalizeLocale(locale)], { weekday: long ? "long" : "short", timeZone: "UTC" });
  // 2023-01-01 war ein Sonntag: ISO 7 → +0, ISO 1 (Montag) → +1.
  return [...new Set(list)].sort((a, b) => a - b).map((d) => fmt.format(new Date(Date.UTC(2023, 0, 1 + (d % 7))))).join(", ");
}

const CONFLICT_KEYS = new Set(["past", "closed", "blocked", "full", "window"]);
export function seriesConflictLabel(reason: string, t: TFunction) {
  return CONFLICT_KEYS.has(reason) ? t(`bookings.series.conflict.${reason}`) : reason;
}

/** «12 Termine buchbar, 2 übersprungen (1× Belegt, 1× Gesperrt)» aus den Konfliktgründen der Vorschau. */
export function seriesSummaryLabel(freeCount: number, conflicts: Array<string | null | undefined>, t: TFunction) {
  const byReason = new Map<string, number>();
  for (const c of conflicts) if (c) byReason.set(c, (byReason.get(c) ?? 0) + 1);
  const head = t(freeCount === 1 ? "bookings.series.bookable.one" : "bookings.series.bookable.other", { n: freeCount });
  if (!byReason.size) return head;
  const skipped = [...byReason.values()].reduce((s, n) => s + n, 0);
  const list = [...byReason].map(([r, n]) => `${n}× ${seriesConflictLabel(r, t)}`).join(", ");
  return t("bookings.series.skippedSummary", { head, n: skipped, list });
}

/** Feste Fehlermeldungen der Serien-Aktionen (Deutsch) → Schlüssel; Unbekanntes bleibt unverändert. */
const SERIES_ERROR_KEY: Record<string, string> = {
  "Bitte gültige Daten wählen.": "bookings.series.err.invalidDate",
  "Das Enddatum liegt vor dem Beginn.": "bookings.series.err.untilBeforeFrom",
  "Eine Serie darf höchstens ein Jahr dauern.": "bookings.series.err.tooLong",
  "Bitte mindestens einen Wochentag wählen.": "bookings.series.pickWeekday",
  "Bitte gültige Zeiten wählen.": "bookings.series.err.invalidTime",
  "Das Ende muss nach dem Beginn liegen.": "bookings.series.err.endBeforeStart",
  "Zu viele Termine (höchstens 200). Bitte den Zeitraum verkürzen.": "bookings.series.err.tooMany",
  "Im gewählten Zeitraum liegt kein passender Wochentag.": "bookings.series.err.empty",
  "Bitte Ressource, Wochentage, Zeitraum und Zeiten angeben.": "bookings.series.err.missing",
  "Ressource nicht verfügbar.": "bookings.series.err.resource",
  "Nicht gefunden": "bookings.series.err.notFound",
  "Die Serie ist bereits storniert.": "bookings.series.err.alreadyCancelled",
  "Der Termin ist bereits beendet.": "bookings.series.err.ended",
  "Vergangene Termine können nicht storniert werden.": "bookings.series.err.past",
};

export function seriesErrorLabel(error: string, t: TFunction) {
  const key = SERIES_ERROR_KEY[error];
  if (key) return t(key);
  const m = /^Höchstens (\d+) Personen? pro Buchung\.$/.exec(error);
  if (m) return t(m[1] === "1" ? "bookings.err.maxPersonsOne" : "bookings.err.maxPersonsMany", { max: m[1]! });
  return error;
}
