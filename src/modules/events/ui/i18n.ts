/**
 * Anlässe in der Sprache des Mitglieds: Arten, Datumsangaben und Hinweise.
 * Gleiche Logik wie in ../types.ts (dort de-CH), hier mit Sprache als Parameter.
 * Ohne Server-Abhängigkeiten, auch in Client-Komponenten nutzbar.
 */
import { getT, INTL_LOCALE, normalizeLocale, type Locale } from "@/lib/i18n/core";
import { zurichParts, APP_TZ } from "@/lib/time";
import { isEventKind, type RsvpStatus } from "../types";

function fmt(locale: Locale | string | null | undefined, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(INTL_LOCALE[normalizeLocale(locale)], { timeZone: APP_TZ, ...opts });
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Bezeichnung einer Art (Einzahl) bzw. Mehrzahl für die Filter. */
export function kindLabel(kind: string, locale: Locale | string | null | undefined, plural = false): string {
  const k = isEventKind(kind) ? kind : "OTHER";
  return getT(locale)(`money.events.kind.${k}${plural ? ".plural" : ""}`);
}

export function monthLabelL(d: Date, locale: Locale | string | null | undefined) {
  return cap(fmt(locale, { month: "long", year: "numeric" }).format(d));
}

/** Kalenderblatt: Tag, Monat kurz, Wochentag. */
export function dateBadgeL(d: Date, locale: Locale | string | null | undefined) {
  const { dateStr } = zurichParts(d);
  return {
    day: String(Number(dateStr.slice(8, 10))),
    month: fmt(locale, { month: "short" }).format(d).replace(".", ""),
    weekday: fmt(locale, { weekday: "short" }).format(d).replace(".", ""),
  };
}

export function longDateL(d: Date, locale: Locale | string | null | undefined) {
  const s = fmt(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(d);
  return normalizeLocale(locale) === "de" ? s : cap(s);
}

function timeOf(d: Date, locale: Locale | string | null | undefined) {
  return fmt(locale, { hour: "2-digit", minute: "2-digit" }).format(d);
}

function shortDate(d: Date, locale: Locale | string | null | undefined) {
  return fmt(locale, { weekday: "short", day: "2-digit", month: "2-digit" }).format(d);
}

/** Lesbare Zeitangabe, z.B. «18:30–20:30 Uhr», «ab 19:30 Uhr», «Ganztägig». */
export function whenLabelL(e: { startsAt: Date; endsAt: Date | null; allDay: boolean }, locale: Locale | string | null | undefined) {
  const t = getT(locale);
  if (e.allDay) {
    if (e.endsAt && zurichParts(e.endsAt).dateStr !== zurichParts(e.startsAt).dateStr) {
      return `${shortDate(e.startsAt, locale)} – ${shortDate(e.endsAt, locale)}`;
    }
    return t("money.events.allDay");
  }
  if (!e.endsAt) return t("money.events.from", { time: timeOf(e.startsAt, locale) });
  if (zurichParts(e.endsAt).dateStr !== zurichParts(e.startsAt).dateStr) {
    return `${timeOf(e.startsAt, locale)} – ${shortDate(e.endsAt, locale)} ${timeOf(e.endsAt, locale)}`;
  }
  return t("money.events.range", { from: timeOf(e.startsAt, locale), to: timeOf(e.endsAt, locale) });
}

export function deadlineLabelL(d: Date, locale: Locale | string | null | undefined) {
  return getT(locale)("money.events.deadline", { date: shortDate(d, locale), time: timeOf(d, locale) });
}

export function rsvpLabel(status: RsvpStatus, locale: Locale | string | null | undefined) {
  return getT(locale)(`money.events.rsvp.${status}`);
}

export function rsvpMyLabel(status: RsvpStatus, locale: Locale | string | null | undefined) {
  return getT(locale)(`money.events.rsvpMy.${status}`);
}
