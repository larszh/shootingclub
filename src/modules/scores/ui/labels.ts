/**
 * Übersetzte Bezeichnungen für Schiess-Ansichten (Namensraum «shooting.»).
 * Rückfall: deutsche Bezeichnung aus den Typen (z.B. unbekannte Codes aus älteren Daten).
 * Client-sicher: nimmt eine bereits erzeugte Übersetzungsfunktion entgegen.
 */
import { INTL_LOCALE, type Locale, type TFunction } from "@/lib/i18n/core";
import { disciplineLabel, officialKindLabel, positionLabel, scoringModeLabel } from "@/modules/scores/types";
import { qualificationLabel } from "@/modules/qualifications/types";
import { categoryLabel, subjectLabel } from "@/modules/targets/types";

/** Übersetzung mit Rückfall, falls der Schlüssel fehlt. */
export function tOr(t: TFunction, key: string, fallback: string, vars?: Record<string, string | number>): string {
  const v = t(key, vars);
  return v === key ? fallback : v;
}

export function disciplineText(t: TFunction, key: string): string {
  return tOr(t, `shooting.discipline.${key}`, disciplineLabel(key));
}

export function officialKindText(t: TFunction, key: string | null | undefined): string {
  if (!key) return "";
  return tOr(t, `shooting.officialKind.${key}`, officialKindLabel(key));
}

export function scoringModeText(t: TFunction, key: string, short = false): string {
  return tOr(t, `shooting.scoringMode.${key}${short ? ".short" : ""}`, scoringModeLabel(key, short));
}

export function positionText(t: TFunction, key: string | undefined): string {
  return tOr(t, `shooting.position.${key || "ANY"}`, positionLabel(key));
}

/** Einzahl/Mehrzahl: Schlüssel «<key>.one» / «<key>.other», Platzhalter {n}. */
export function tCount(t: TFunction, key: string, n: number, vars?: Record<string, string | number>): string {
  return t(`${key}.${n === 1 ? "one" : "other"}`, { n, ...vars });
}

const DE_MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

/**
 * Zeitraum-Bezeichnung einer Rangliste (z.B. «Oktober 2026», «Jahr 2026», «Alle Zeiten») in der
 * gewünschten Sprache. `label` ist die deutsche Bezeichnung aus periodRange().
 */
export function periodLabelText(t: TFunction, locale: Locale, period: string, label: string): string {
  if (period === "all") return tOr(t, "shooting.period.allTime", label);
  const year = label.match(/\d{4}/)?.[0];
  if (!year) return label;
  if (period === "year") return tOr(t, "shooting.period.yearN", label, { year });
  const month = DE_MONTHS.findIndex((m) => label.startsWith(m));
  if (month === -1) return label;
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(Number(year), month, 15)));
}

/** Umschalter Monat / Jahr / Alle. */
export function periodTabText(t: TFunction, key: string, fallback: string): string {
  return tOr(t, `shooting.period.tab.${key}`, fallback);
}

/** Zeitraumfilter der Durchgangsliste (Schlüssel "" = alle Zeiten). */
export function matchPeriodText(t: TFunction, key: string, fallback: string): string {
  return tOr(t, `shooting.period.match.${key || "all"}`, fallback);
}

/** Bezeichnung der Höchstwerte (Zehner / Höchstwerte / × beste Zone). */
export function topShotsText(t: TFunction, label: string): string {
  const key = label === "Zehner" ? "tens" : label === "Höchstwerte" ? "max" : label === "× beste Zone" ? "bestZone" : null;
  return key ? tOr(t, `shooting.topShots.${key}`, label) : label;
}

/** Bezeichnung einer Qualifikationsart (Rückfall: deutsche Bezeichnung bzw. Code). */
export function qualificationText(t: TFunction, kind: string | null | undefined): string {
  if (!kind) return "";
  return tOr(t, `shooting.qual.${kind}`, qualificationLabel(kind));
}

/** Uhrzeitspanne «18:00–20:00» in Europe/Zurich, im Format der Sprache. */
export function timeRangeText(locale: Locale, start: Date, end: Date): string {
  const f = new Intl.DateTimeFormat(INTL_LOCALE[locale], { timeZone: "Europe/Zurich", hour: "2-digit", minute: "2-digit" });
  return `${f.format(start)}–${f.format(end)}`;
}

/** Zielscheiben: Sujet- und Kategoriebezeichnungen (Rückfall: deutsche Bezeichnung). */
export function targetSubjectText(t: TFunction, key: string): string {
  return tOr(t, `shooting.targets.subject.${key}`, subjectLabel(key));
}

export function targetCategoryText(t: TFunction, key: string): string {
  return tOr(t, `shooting.targets.cat.${key}`, categoryLabel(key));
}

/** Bekannte deutsche Meldungen aus Punkteerfassung und Offline-Sync (sync.ts, actions.ts) → Schlüssel. */
const SCORE_ERRORS: Record<string, string> = {
  "Nicht gefunden": "notFound",
  "Keine Berechtigung": "forbidden",
  "Ungültige Eingabe": "invalid",
  "Ungültige Teilnehmerliste": "invalidParticipants",
  "Mindestens ein Teilnehmer": "minParticipant",
  "Programm wählen": "chooseProgram",
  "Modul nicht aktiv": "moduleOff",
  "Punkteerfassung ist in diesem Verein nicht aktiv": "scoresOff",
  "Kein Zugriff auf diesen Verein": "noTenantAccess",
  "Verein nicht gefunden": "tenantNotFound",
  "Konflikt mit einem anderen Durchgang": "matchConflict",
  "Programm nicht verfügbar": "programUnavailable",
  "Durchgang nicht gefunden": "matchNotFound",
  "Durchgang wird noch übertragen": "matchPending",
  "Durchgang fehlt": "matchMissing",
  "Diese Serie wurde nur mit Total importiert und kann nicht bearbeitet werden.": "totalsOnly",
  "Durchgang ist abgeschlossen.": "finished",
  "Teilnehmer nicht gefunden": "participantNotFound",
  "Amtlich bestätigtes Resultat: Änderungen nur durch den Schützenmeister (zuerst «Bestätigung aufheben»).": "officialLocked",
  "Amtliches Programm: Schüsse anderer Teilnehmer erfasst nur, wer den Durchgang erstellt hat, oder der Schützenmeister.": "officialOthers",
  "Serie nicht gefunden": "stageNotFound",
  "Ungültiger Zonenwert für diese Serie.": "badZone",
  "Der Durchgang enthält amtlich bestätigte Resultate: Status ändern nur durch den Schützenmeister.": "statusOfficialLocked",
  "Dieser Durchgang enthält Serien, die nur mit Total importiert wurden, und kann nicht wieder geöffnet werden.": "reopenTotalsOnly",
  "Status wurde gleichzeitig geändert": "statusConflict",
  "Gehört zu einem anderen Konto": "otherAccount",
  "Serverfehler, wird erneut versucht": "server",
  "Client-ID fehlt": "clientIdMissing",
  "Der Durchgang enthält amtlich bestätigte Resultate. Bitte zuerst die Bestätigungen aufheben (Schützenmeister).": "deleteOfficial",
};

const BAD_ENTRY_RE = /^Ungültiger Eintrag bei Nr\. (\d+) \(Zonenwert oder zu viele Schüsse\) – bitte diesen Eintrag entfernen\.$/;

/**
 * Server-Meldung der Punkteerfassung in der Sprache der Ansicht. Die Meldungen entstehen
 * sprachneutral im gemeinsamen Kern (auch Offline-Sync) auf Deutsch; unbekannte Texte bleiben unverändert.
 */
export function scoreErrorText(t: TFunction, msg: string | null | undefined): string {
  if (!msg) return "";
  const key = SCORE_ERRORS[msg];
  if (key) return tOr(t, `shooting.err.${key}`, msg);
  const m = BAD_ENTRY_RE.exec(msg);
  if (m) return tOr(t, "shooting.err.badEntryAt", msg, { n: m[1] });
  return msg;
}
