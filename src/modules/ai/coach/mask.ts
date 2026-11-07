/**
 * Import-Helfer: Beispielzeilen vor dem Senden an Claude maskieren (rein, getestet).
 * Gesendet werden nur Spaltennamen und höchstens drei maskierte Beispielzeilen:
 * Namen → Platzhalter, keine E-Mail-Adressen, Telefonnummern, AHV-Nummern oder IBAN.
 * Beim Mitglieder-Import werden zusätzlich Daten, Zahlen und Freitexte auf ihre Form reduziert.
 */

export type AssistKind = "scores" | "members";

export const ASSIST_SAMPLE_ROWS = 3;
export const ASSIST_MAX_COLUMNS = 120;
const MAX_HEADER = 60;
const MAX_VALUE = 40;

function norm(s: string) {
  return s.toLowerCase().replace(/ß/g, "ss").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
}

const FIRST_NAME = ["vorname", "firstname", "prenom", "givenname", "rufname", "nome"];
const LAST_NAME = ["nachname", "familienname", "lastname", "surname", "familyname", "nom", "cognome"];
const FULL_NAME = ["name", "fullname", "vollername", "namevorname", "vornamename", "schuetze", "schutze", "schuetzenname", "teilnehmer", "shooter", "athlete", "athlet", "mitglied", "person", "tireur"];
const CLUB = ["verein", "club", "gesellschaft", "societe", "team", "sektion", "societa"];
const NAME_PARTS = ["name", "vorname", "nachname", "schuetze", "schutze", "shooter", "athlet", "teilnehmer", "prenom", "cognome"];

export type ColumnKind = "firstName" | "lastName" | "name" | "club" | "other";

/** Art einer Spalte anhand des Spaltennamens (für die Maskierung). */
export function columnKind(header: string): ColumnKind {
  const h = norm(header);
  if (!h) return "other";
  if (FIRST_NAME.includes(h)) return "firstName";
  if (LAST_NAME.includes(h)) return "lastName";
  if (FULL_NAME.includes(h)) return "name";
  if (CLUB.includes(h)) return "club";
  // «Name Schütze», «Teilnehmername», «Vorname 1» …, aber nicht «Vereinsname» oder «Disziplinname»
  if (NAME_PARTS.some((p) => h.includes(p)) && !/(verein|club|disziplin|programm|stich|datei|file|wettkampf|event)/.test(h)) {
    if (h.includes("vorname") || h.includes("prenom") || h.includes("firstname")) return "firstName";
    if (h.includes("nachname") || h.includes("lastname") || h.includes("cognome")) return "lastName";
    return "name";
  }
  return "other";
}

const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const AHV = /\b756[.\s]?\d{4}[.\s]?\d{4}[.\s]?\d{2}\b/;
const IBAN = /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}(?:\s?[A-Z0-9]{1,4})?\b/i;
const DATE = /^(\d{1,2})([./-])(\d{1,2})\2(\d{2}|\d{4})(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?$|^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T]\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?Z?)?$/;
const NUMBER = /^[-+]?\d+(?:[.,]\d+)?\*?$/;
/** Person: 2–4 Wörter, jedes beginnt mit einem Grossbuchstaben, nur Buchstaben, Bindestrich, Apostroph */
const PERSON = /^\p{Lu}[\p{L}'’-]*(?:,?\s+(?:(?:von|van|de|di|da|del|della|du|le|la)\s+)?\p{Lu}[\p{L}'’.-]*){1,3}$/u;
/** Kategorien, die beim Mitglieder-Import erkennbar bleiben dürfen (Status, Ja/Nein, Anrede) */
const MEMBER_KEEP = /^(aktiv\w*|passiv\w*|ehren\w*|frei\w*|junior\w*|jungsch\w*|nachwuchs|jugend|veteran\w*|gonner\w*|gönner\w*|supporter|sponsor|vorstand|mitglied|ausgetreten|austritt|inaktiv|active|passive|honorary|left|actif|passif|attivo|passivo|ja|nein|yes|no|oui|non|si|sì|x|m|w|f|herr|frau|mann|männlich|weiblich|male|female)$/iu;

function isPhone(v: string) {
  const digits = v.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 15) return false;
  if (!/^\+?[\d\s/().-]+$/.test(v)) return false;
  return /^(\+|00|0)/.test(v.trim()) || /\s/.test(v.trim());
}

/** Datum → Form (z.B. «31.12.1980» → «DD.MM.YYYY»). */
function dateShape(v: string) {
  const m = DATE.exec(v);
  if (!m) return null;
  if (m[1]) return `${"D".repeat(m[1].length)}${m[2]}${"M".repeat(m[3]!.length)}${m[2]}${"Y".repeat(m[4]!.length)}${v.includes(":") ? " hh:mm" : ""}`;
  return `YYYY-MM-DD${/[ T]\d/.test(v) ? " hh:mm" : ""}`;
}

/** Bereits maskierter Wert (Platzhalter) – bleibt unverändert, damit doppeltes Maskieren nichts verliert. */
const PLACEHOLDER = /^\[(?:(?:first name|last name|name) \d{1,3}|email|phone|id number|iban|club|zip city|address|text|date [DMYhm./: -]{6,24})\]$/;

/** E-Mail, AHV-Nummer, IBAN oder Telefonnummer innerhalb eines längeren Textes ersetzen. */
const EMAIL_IN = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
const AHV_IN = /\b756[.\s]?\d{4}[.\s]?\d{4}[.\s]?\d{2}\b/g;
const IBAN_IN = /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}(?:\s?[A-Z0-9]{1,4})?\b/gi;
const PHONE_IN = /(?:\+|\b00|\b0)\d{1,3}[\s/.-]?\d{2,3}(?:[\s/.-]?\d{2,4}){2,3}\b/g;

function scrubEmbedded(v: string): string {
  return v
    .replace(EMAIL_IN, "[email]")
    .replace(AHV_IN, "[id number]")
    .replace(IBAN_IN, (m) => (/\d{4}/.test(m) ? "[iban]" : m))
    .replace(PHONE_IN, (m) => (isPhone(m) ? "[phone]" : m));
}

/**
 * Wörter, die im Resultat-Import als Freitext stehen bleiben dürfen (Disziplinen, Stellungen,
 * Kategorien). Andere Freitexte ohne Ziffern (z.B. «MÜLLER», «rossi mario», Bemerkungen) werden «[text]».
 */
const SCORE_WORDS = new Set([
  "gewehr", "pistole", "luftgewehr", "luftpistole", "karabiner", "kar", "stgw", "sturmgewehr", "ordonnanz", "ordonnanzwaffe",
  "freigewehr", "standardgewehr", "sportgewehr", "sportpistole", "zentralfeuer", "schnellfeuer", "armbrust", "kleinkaliber", "kk", "lg", "lp", "gp", "fw", "stgw57", "stgw90",
  "feldschiessen", "obligatorisch", "obligatorische", "bundesprogramm", "uebung", "ubung", "training", "wettkampf", "match", "final", "probe", "probeschuss", "probeschusse",
  "stich", "serie", "schuss", "einzel", "gruppe", "nachdoppel", "kranz", "kranzresultat", "auszeichnung",
  "liegend", "kniend", "stehend", "aufgelegt", "frei", "prone", "kneeling", "standing", "couche", "genou", "debout", "terra", "ginocchio", "piedi",
  "elite", "junior", "junioren", "jugend", "jungschutze", "jungschuetze", "jungschutzen", "veteran", "veteranen", "senior", "senioren", "seniorveteran", "damen", "herren", "u21", "u17", "u15",
  "fusil", "pistolet", "carabine", "fucile", "pistola", "rifle", "pistol", "air", "aria",
  "ja", "nein", "yes", "no", "oui", "non", "si", "ok", "total", "summe", "ring", "ringe", "punkte", "zehntel", "ganz", "ganze",
]);

function keepScoreText(v: string): boolean {
  if (/\d/.test(v)) return true; // «LG 40 Schuss», «G300», «10.4*»
  const words = wordsOf(v);
  if (!words.length) return true; // nur Satzzeichen
  if (words.length === 1 && words[0]!.length <= 3) return true; // «X», «E», «LG»
  return words.every((w) => SCORE_WORDS.has(w));
}

function wordsOf(v: string): string[] {
  return v
    .toLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** Ein Wert maskiert. `row` (ab 1) für nummerierte Namens-Platzhalter. */
export function maskValue(raw: string, column: ColumnKind, kind: AssistKind, row: number): string {
  const v = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!v) return "";
  if (PLACEHOLDER.test(v)) return v;
  if (column === "firstName") return `[first name ${row}]`;
  if (column === "lastName") return `[last name ${row}]`;
  if (column === "name") return `[name ${row}]`;
  if (EMAIL.test(v)) return "[email]";
  if (AHV.test(v)) return "[id number]";
  if (IBAN.test(v) && /\d{4}/.test(v)) return "[iban]";
  const shape = dateShape(v);
  if (shape) return kind === "members" ? `[date ${shape}]` : v.slice(0, MAX_VALUE);
  if (isPhone(v)) return "[phone]";
  if (column === "club") return "[club]";
  if (NUMBER.test(v)) return kind === "members" ? v.replace(/\d/g, "9") : v.slice(0, MAX_VALUE);
  if (kind === "members") {
    if (MEMBER_KEEP.test(v)) return v;
    if (/^\d{4,5}\s+\p{L}/u.test(v)) return "[zip city]";
    if (/\p{L}/u.test(v) && /\d/.test(v)) return "[address]";
    return "[text]";
  }
  // Resultate: Personennamen und Freitexte ersetzen, nur Werte wie Disziplin, «X», «10.4*» bleiben
  if (PERSON.test(v)) return `[name ${row}]`;
  const scrubbed = scrubEmbedded(v);
  if (!keepScoreText(scrubbed.replace(/\[(?:email|id number|iban|phone)\]/g, " "))) return "[text]";
  return scrubbed.slice(0, MAX_VALUE);
}

/**
 * Bekannte Wörter in Spaltennamen (Mitglieder- und Resultat-Import, DE/FR/IT/EN). Kommt in der
 * ersten Zeile keines davon vor, ist es vermutlich eine Datei ohne Kopfzeile (erste Zeile = Daten).
 */
const HEADER_WORDS = new Set([
  // Mitglieder
  "name", "vorname", "nachname", "familienname", "rufname", "anrede", "titel", "geschlecht", "strasse", "str", "adresse", "address", "adresszeile1", "hausnummer", "nr", "no",
  "plz", "postleitzahl", "ort", "wohnort", "stadt", "zip", "city", "plzort", "land", "kanton", "telefon", "tel", "phone", "telefonnummer", "festnetz", "mobile", "mobil", "natel", "handy", "mobiltelefon",
  "mail", "email", "emailadresse", "epost", "geburtsdatum", "geburtstag", "gebdatum", "geboren", "jahrgang", "birthdate", "birthday", "eintritt", "eintrittsdatum", "austritt", "austrittsdatum",
  "beitritt", "mitglied", "mitgliedseit", "mitgliedernummer", "mitgliedernr", "mitgliednr", "nummer", "number", "id", "lizenz", "lizenznummer", "lizenznr", "license", "licence",
  "status", "mitgliedschaft", "kategorie", "beitragskategorie", "beitrag", "category", "bemerkung", "bemerkungen", "notiz", "notizen", "kommentar", "note", "notes", "privat", "geschaeft",
  "prenom", "nom", "rue", "npa", "localite", "naissance", "datenaissance", "telephone", "natel", "categorie", "remarque", "membre",
  "nome", "cognome", "via", "indirizzo", "cap", "localita", "nascita", "telefono", "categoria", "osservazioni", "socio",
  "firstname", "lastname", "surname", "fullname", "street", "joined", "left", "member", "comment",
  // Resultate
  "schuetze", "schutze", "schuetzenname", "teilnehmer", "teilnehmername", "shooter", "athlete", "athlet", "tireur", "tiratore", "verein", "club", "gesellschaft", "sektion", "societe", "societa", "team",
  "datum", "date", "data", "zeit", "uhrzeit", "time", "heure", "ora", "programm", "program", "programme", "programma", "disziplin", "discipline", "disciplina", "stich", "waffe", "arme", "arma", "weapon",
  "distanz", "distance", "distanza", "scheibe", "target", "cible", "bersaglio", "rang", "rank", "klasse", "class", "classe",
  "total", "summe", "sum", "resultat", "resultate", "result", "results", "resultats", "risultato", "punkte", "points", "punti", "score", "ringe", "ring", "wert", "value",
  "serie", "series", "schuss", "shot", "shots", "coup", "colpo", "tiri", "innenzehner", "mouche", "zehner", "tiefschuss", "decimal", "zehntel",
  "spalte", "column", "colonne", "colonna",
]);

function looksLikeLabel(h: string): boolean {
  if (columnKind(h) !== "other") return true;
  if (/^\[[a-z .]+\]$/i.test(h)) return true; // eigener Platzhalter (doppeltes Maskieren)
  const words = wordsOf(h);
  return words.length > 0 && (HEADER_WORDS.has(words.join("")) || words.some((w) => HEADER_WORDS.has(w)));
}

/** Sieht ein Wert der ersten Zeile nach Daten aus (Datum, Zahl, Kontakt, Person, PLZ Ort)? */
function looksLikeData(h: string, kind: AssistKind): boolean {
  const v = h.replace(/\s+/g, " ").trim();
  if (!v) return false;
  if (EMAIL.test(v) || AHV.test(v) || (IBAN.test(v) && /\d{4}/.test(v)) || dateShape(v) || isPhone(v) || NUMBER.test(v)) return true;
  if (/^\d{4,5}\s+\p{L}/u.test(v) || PERSON.test(v)) return true;
  return kind === "members";
}

/** Erste Zeile einer Datei ohne Kopfzeile: keine bekannten Spaltennamen, dafür Werte wie Namen oder Daten. */
export function headerRowIsData(headers: readonly string[], kind: AssistKind): boolean {
  const cells = headers.map((h) => String(h ?? "").trim()).filter(Boolean);
  if (!cells.length) return false;
  if (cells.some(looksLikeLabel)) return false;
  return cells.some((h) => looksLikeData(h, kind));
}

/** Spaltenname kürzen; E-Mail, Telefon, AHV-Nummer, IBAN und Datum im Spaltennamen ersetzen. */
export function maskHeader(h: string): string {
  const v = (h ?? "").replace(/\s+/g, " ").trim();
  if (EMAIL.test(v)) return "[email]";
  if (AHV.test(v)) return "[id number]";
  if (IBAN.test(v) && /\d{4}/.test(v)) return "[iban]";
  const shape = dateShape(v);
  if (shape) return `[date ${shape}]`;
  if (isPhone(v)) return "[phone]";
  return scrubEmbedded(v).slice(0, MAX_HEADER);
}

/**
 * Spaltennamen und die ersten (nicht leeren) Zeilen maskieren. Ergebnis: höchstens
 * ASSIST_SAMPLE_ROWS Zeilen mit genau headers.length Werten.
 */
export function maskSamples(headers: string[], rows: string[][], kind: AssistKind): { headers: string[]; rows: string[][] } {
  const cols = headers.slice(0, ASSIST_MAX_COLUMNS);
  const nonEmpty = rows.filter((r) => Array.isArray(r) && r.some((c) => String(c ?? "").trim()));
  if (headerRowIsData(cols, kind)) {
    // Datei ohne Kopfzeile: die «Spaltennamen» sind die erste Datenzeile – wie Daten maskieren
    const sample = [cols.map((c) => String(c ?? "")), ...nonEmpty].slice(0, ASSIST_SAMPLE_ROWS);
    return {
      headers: cols.map((_, i) => `Spalte ${i + 1}`),
      rows: sample.map((r, ri) => cols.map((_, ci) => maskValue(String(r[ci] ?? ""), "other", kind, ri + 1))),
    };
  }
  const kinds = cols.map(columnKind);
  const sample = nonEmpty.slice(0, ASSIST_SAMPLE_ROWS);
  return {
    headers: cols.map(maskHeader),
    rows: sample.map((r, ri) => cols.map((_, ci) => maskValue(String(r[ci] ?? ""), kinds[ci]!, kind, ri + 1))),
  };
}
