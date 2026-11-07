/**
 * Datums- und Zeitformate für den Chat (Schweizer Zeit, Sprache des Mitglieds).
 * Alles deterministisch aus ISO-Zeitpunkten; «jetzt» kommt aus useNow().
 */
import { useSyncExternalStore } from "react";
import { getT, INTL_LOCALE, normalizeLocale, type Locale } from "@/lib/i18n/core";

const TZ = "Europe/Zurich";
const keyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

type Fmts = { time: Intl.DateTimeFormat; longDay: Intl.DateTimeFormat; longDayNoYear: Intl.DateTimeFormat; weekday: Intl.DateTimeFormat; shortDate: Intl.DateTimeFormat };
const fmtCache = new Map<Locale, Fmts>();

function fmts(locale: string | null | undefined): Fmts {
  const l = normalizeLocale(locale);
  let f = fmtCache.get(l);
  if (!f) {
    const tag = INTL_LOCALE[l];
    f = {
      time: new Intl.DateTimeFormat(tag, { timeZone: TZ, hour: "2-digit", minute: "2-digit" }),
      longDay: new Intl.DateTimeFormat(tag, { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" }),
      longDayNoYear: new Intl.DateTimeFormat(tag, { timeZone: TZ, weekday: "long", day: "numeric", month: "long" }),
      weekday: new Intl.DateTimeFormat(tag, { timeZone: TZ, weekday: "short" }),
      shortDate: new Intl.DateTimeFormat(tag, { timeZone: TZ, day: "2-digit", month: "2-digit", year: "2-digit" }),
    };
    fmtCache.set(l, f);
  }
  return f;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "YYYY-MM-DD" in Schweizer Zeit */
export function dayKey(iso: string | number | Date) {
  return keyFmt.format(new Date(iso));
}

export function timeLabel(iso: string, locale: Locale = "de") {
  return fmts(locale).time.format(new Date(iso));
}

function shiftKey(key: string, days: number) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
}

/** Trenner zwischen Tagen: «Heute», «Gestern», «Montag, 26. Oktober» (Jahr nur, wenn nicht aktuell). */
export function dayLabel(iso: string, now: number, locale: Locale = "de") {
  const key = dayKey(iso);
  const f = fmts(locale);
  if (now) {
    const today = dayKey(now);
    const t = getT(locale);
    if (key === today) return t("money.chat.today");
    if (key === shiftKey(today, -1)) return t("money.chat.yesterday");
    if (key.slice(0, 4) === today.slice(0, 4)) return cap(f.longDayNoYear.format(new Date(iso)));
  }
  return cap(f.longDay.format(new Date(iso)));
}

/** Kurze Zeitangabe in der Liste: Uhrzeit (heute), «Gestern», Wochentag (diese Woche), sonst Datum. */
export function listTimeLabel(iso: string | null, now: number, locale: Locale = "de") {
  if (!iso) return "";
  const key = dayKey(iso);
  const f = fmts(locale);
  if (now) {
    const today = dayKey(now);
    if (key === today) return timeLabel(iso, locale);
    if (key === shiftKey(today, -1)) return getT(locale)("money.chat.yesterday");
    if (key > shiftKey(today, -7)) return cap(f.weekday.format(new Date(iso)));
  }
  return f.shortDate.format(new Date(iso));
}

/* -------------------------------------------------------------- Uhr */

let now = 0;
let timer: ReturnType<typeof setInterval> | undefined;
const clockListeners = new Set<() => void>();

function subscribeClock(l: () => void) {
  clockListeners.add(l);
  if (!timer) {
    timer = setInterval(() => {
      now = Date.now();
      for (const x of clockListeners) x();
    }, 30_000);
  }
  return () => {
    clockListeners.delete(l);
    if (!clockListeners.size && timer) {
      clearInterval(timer);
      timer = undefined;
      now = 0;
    }
  };
}

function getNow() {
  if (!now) now = Date.now();
  return now;
}

const getServerNow = () => 0;

/** Aktuelle Zeit (ms), alle 30 s aufgefrischt. Auf dem Server 0 (= unbekannt). */
export function useNow() {
  return useSyncExternalStore(subscribeClock, getNow, getServerNow);
}

/** Ersatztitel aus den Abfragen («Gruppe», «Ehemaliges Mitglied») übersetzen; echte Titel bleiben. */
export function chatTitle(title: string, locale: Locale = "de") {
  if (title === "Gruppe") return getT(locale)("money.chat.fallback.group");
  if (title === "Ehemaliges Mitglied") return getT(locale)("money.chat.fallback.formerMember");
  return title;
}
