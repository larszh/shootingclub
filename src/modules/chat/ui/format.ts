/**
 * Datums- und Zeitformate für den Chat (Schweizer Zeit, de-CH).
 * Alles deterministisch aus ISO-Zeitpunkten; «jetzt» kommt aus useNow().
 */
import { useSyncExternalStore } from "react";

const TZ = "Europe/Zurich";
const keyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const timeFmt = new Intl.DateTimeFormat("de-CH", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const longDayFmt = new Intl.DateTimeFormat("de-CH", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" });
const longDayNoYearFmt = new Intl.DateTimeFormat("de-CH", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
const weekdayFmt = new Intl.DateTimeFormat("de-CH", { timeZone: TZ, weekday: "short" });
const shortDateFmt = new Intl.DateTimeFormat("de-CH", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "2-digit" });

/** "YYYY-MM-DD" in Schweizer Zeit */
export function dayKey(iso: string | number | Date) {
  return keyFmt.format(new Date(iso));
}

export function timeLabel(iso: string) {
  return timeFmt.format(new Date(iso));
}

function shiftKey(key: string, days: number) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
}

/** Trenner zwischen Tagen: «Heute», «Gestern», «Montag, 26. Oktober» (Jahr nur, wenn nicht aktuell). */
export function dayLabel(iso: string, now: number) {
  const key = dayKey(iso);
  if (now) {
    const today = dayKey(now);
    if (key === today) return "Heute";
    if (key === shiftKey(today, -1)) return "Gestern";
    if (key.slice(0, 4) === today.slice(0, 4)) return longDayNoYearFmt.format(new Date(iso));
  }
  return longDayFmt.format(new Date(iso));
}

/** Kurze Zeitangabe in der Liste: Uhrzeit (heute), «Gestern», Wochentag (diese Woche), sonst Datum. */
export function listTimeLabel(iso: string | null, now: number) {
  if (!iso) return "";
  const key = dayKey(iso);
  if (now) {
    const today = dayKey(now);
    if (key === today) return timeLabel(iso);
    if (key === shiftKey(today, -1)) return "Gestern";
    if (key > shiftKey(today, -7)) return weekdayFmt.format(new Date(iso));
  }
  return shortDateFmt.format(new Date(iso));
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
