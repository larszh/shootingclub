/**
 * Sprachhilfen für die Mitgliederansichten «Geld & Kommunikation» (Zahlungen, Rechnungen,
 * Anlässe, Chat, Konsumationen). Ohne Server-Abhängigkeiten, auch in Client-Komponenten nutzbar.
 *
 * - `tPlural`: Einzahl/Mehrzahl über die Schlüssel `<basis>.one` und `<basis>.other` (Platzhalter {n}).
 * - `localizeMessage`: übersetzt einen bekannten deutschen Text (z.B. Fehlermeldung aus einem
 *   Dienst oder einer API-Route, die selbst noch Deutsch liefert) anhand des money-Wörterbuchs.
 *   Unbekannte Texte bleiben unverändert.
 * - `localizePaymentItem`: Anzeige eines Zahlungspostens aus der Übersicht in der gewünschten Sprache.
 */
import { getT, normalizeLocale, type Locale, type TFunction } from "@/lib/i18n/core";
import money from "@/lib/i18n/extra/money";

export function tPlural(t: TFunction, base: string, n: number, vars?: Record<string, string | number>): string {
  return t(`${base}.${n === 1 ? "one" : "other"}`, { n, ...vars });
}

/* ------------------------------------------------------------ bekannte Meldungen */

type Pattern = { key: string; re: RegExp; names: string[] };

let exact: Map<string, string> | null = null;
let patterns: Pattern[] | null = null;

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function build() {
  exact = new Map();
  patterns = [];
  for (const [key, de] of Object.entries(money.de)) {
    if (!key.startsWith("money.")) continue;
    const names: string[] = [];
    const parts = de.split(/\{(\w+)\}/g);
    if (parts.length === 1) {
      if (!exact.has(de)) exact.set(de, key);
      continue;
    }
    let src = "";
    parts.forEach((p, i) => {
      if (i % 2 === 1) {
        names.push(p);
        src += "(.+?)";
      } else src += escapeRe(p);
    });
    patterns.push({ key, re: new RegExp(`^${src}$`), names });
  }
}

/** Übersetzt einen bekannten deutschen Text in `locale`; unbekannte Texte kommen unverändert zurück. */
export function localizeMessage(msg: string, locale: string | null | undefined): string;
export function localizeMessage(msg: string | null | undefined, locale: string | null | undefined): string | null | undefined;
export function localizeMessage(msg: string | null | undefined, locale: string | null | undefined) {
  if (!msg) return msg;
  const l = normalizeLocale(locale);
  if (l === "de") return msg;
  if (!exact || !patterns) build();
  const t = getT(l);
  const key = exact!.get(msg);
  if (key) return t(key);
  for (const p of patterns!) {
    const m = p.re.exec(msg);
    if (!m) continue;
    const vars: Record<string, string> = {};
    p.names.forEach((n, i) => (vars[n] = m[i + 1]!));
    return t(p.key, vars);
  }
  return msg;
}

/* ------------------------------------------------------------ Zahlungsposten */

export type LocalizablePaymentItem = {
  source: "FEE" | "BOOKING" | "ONLINE" | "AMMO";
  sourceLabel?: string;
  title: string;
  detail: string | null;
  number: string;
};

/**
 * Titel, Detail, Nummer und Bereich eines Postens in der Sprache des Mitglieds.
 * Die Übersicht liefert deutsche Standardtexte («Reservation …», «Termin …», «Munition»,
 * «Mitgliederbeitrag 2026»); Vereinsdaten (Titel des Jahreslaufs, Anlagenamen) bleiben, wie sie sind.
 */
export function localizePaymentItem<T extends LocalizablePaymentItem>(item: T, locale: Locale | string | null | undefined): T & { sourceText: string } {
  const l = normalizeLocale(locale);
  const t = getT(l);
  const sourceText = item.sourceLabel === "Vereinsrechnung"
    ? t("money.source.clubInvoice")
    : item.sourceLabel === "Mitgliederbeitrag"
      ? t("money.source.memberFee")
      : item.sourceLabel ?? t(`money.source.${item.source}`);
  if (l === "de") return { ...item, sourceText };
  let title = item.title;
  let detail = item.detail;
  let number = item.number;
  const annual = /^Mitgliederbeitrag (\d{4})$/.exec(title);
  if (item.source === "FEE" && annual) title = t("money.fee.annualTitle", { year: annual[1]! });
  const booking = /^Reservation (.+)$/.exec(title);
  if ((item.source === "BOOKING" || item.source === "ONLINE") && booking) title = t("money.item.booking", { name: booking[1]! });
  if (item.source === "AMMO" && title === "Munition") title = t("money.source.AMMO");
  if (detail) {
    const appt = /^Termin (\S+)(.*)$/.exec(detail);
    if (appt) detail = `${t("money.item.appointment", { date: appt[1]! })}${appt[2] ?? ""}`;
  }
  if (item.source === "ONLINE" && number === "Online") number = t("money.item.onlineNumber");
  return { ...item, title, detail, number, sourceText };
}

/** Zahlarten-Liste des Anbieters («TWINT, PostFinance, Karte») mit übersetztem «Karte». */
export function localizeMethods(methods: string, locale: string | null | undefined): string {
  const l = normalizeLocale(locale);
  if (l === "de") return methods;
  return methods.replace(/\bKarte\b/g, getT(l)("money.payments.card"));
}
