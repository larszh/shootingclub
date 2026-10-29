/**
 * Mitglieder-Import: reine Funktionen zum Lesen von CSV-Dateien (UTF-8, UTF-16 oder Windows-1252,
 * Trennzeichen ; , oder Tab), Spaltenzuordnung mit Vorlagen (ClubDesk, WebLing, Excel) und
 * Prüfung jeder Zeile. Keine Datenbank, kein Server-Code – darum mit Vitest getestet.
 */
import { isMemberStatus, isValidEmail, type MemberStatus } from "./types";

export const IMPORT_MAX_BYTES = 2 * 1024 * 1024;
export const IMPORT_MAX_ROWS = 5000;

// --- Dekodieren ---------------------------------------------------------------

export type CsvEncoding = "utf-8" | "utf-16le" | "utf-16be" | "windows-1252";

/** Erkennt die Kodierung: BOM, sonst gültiges UTF-8, sonst Windows-1252 (Excel unter Windows). */
export function decodeBytes(bytes: Uint8Array): { text: string; encoding: CsvEncoding } {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { text: new TextDecoder("utf-8").decode(bytes.subarray(3)), encoding: "utf-8" };
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return { text: new TextDecoder("utf-16le").decode(bytes.subarray(2)), encoding: "utf-16le" };
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return { text: new TextDecoder("utf-16be").decode(bytes.subarray(2)), encoding: "utf-16be" };
  }
  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes), encoding: "utf-8" };
  } catch {
    return { text: decodeWindows1252(bytes), encoding: "windows-1252" };
  }
}

// 0x80–0x9F in Windows-1252 (Rest entspricht Latin-1)
const CP1252_HIGH = [
  0x20ac, 0xfffd, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0xfffd, 0x017d, 0xfffd,
  0xfffd, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0xfffd, 0x017e, 0x0178,
];

/** Eigene Umsetzung, damit es auch ohne ICU-Daten (Node small-icu) zuverlässig funktioniert. */
export function decodeWindows1252(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]!;
    out += String.fromCharCode(b >= 0x80 && b <= 0x9f ? CP1252_HIGH[b - 0x80]! : b);
  }
  return out;
}

// --- CSV ------------------------------------------------------------------------

export type Delimiter = ";" | "," | "\t";

/** Trennzeichen aus der ersten nicht-leeren Zeile (Zeichen in Anführungszeichen zählen nicht). */
export function detectDelimiter(text: string): Delimiter {
  const counts: Record<Delimiter, number> = { ";": 0, ",": 0, "\t": 0 };
  let inQuotes = false;
  let seenContent = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (c === '"') inQuotes = !inQuotes;
    else if (!inQuotes && (c === "\n" || c === "\r")) {
      if (seenContent) break;
    } else if (!inQuotes && (c === ";" || c === "," || c === "\t")) {
      counts[c]++;
      seenContent = true;
    } else if (c.trim()) seenContent = true;
  }
  if (counts["\t"] > counts[";"] && counts["\t"] > counts[","]) return "\t";
  if (counts[","] > counts[";"]) return ",";
  return ";";
}

/** RFC-4180-Parser: Felder in "…" mit "" als Escape, Zeilenumbrüche in Feldern, CRLF/LF/CR. */
export function parseCsv(text: string, delimiter: Delimiter): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const pushRow = () => {
    row.push(field);
    field = "";
    if (row.some((f) => f.trim() !== "")) rows.push(row);
    row = [];
  };
  while (i < text.length) {
    const c = text[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"' && field.trim() === "") {
      inQuotes = true;
      field = "";
      i++;
      continue;
    }
    if (c === delimiter) {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (c === "\r" || c === "\n") {
      pushRow();
      if (c === "\r" && text[i + 1] === "\n") i++;
      i++;
      continue;
    }
    field += c;
    i++;
  }
  if (field !== "" || row.length) pushRow();
  return rows;
}

export type ParsedTable = { headers: string[]; rows: string[][]; encoding: CsvEncoding; delimiter: Delimiter };

/** Datei → Kopfzeile + Datenzeilen. Wirft einen Error mit deutscher Meldung bei unbrauchbaren Dateien. */
export function readCsvBytes(bytes: Uint8Array): ParsedTable {
  if (bytes.length === 0) throw new Error("Die Datei ist leer.");
  if (bytes.length > IMPORT_MAX_BYTES) throw new Error("Die Datei ist grösser als 2 MB. Bitte in mehrere Dateien aufteilen.");
  const { text, encoding } = decodeBytes(bytes);
  if (text.includes("\u0000")) throw new Error("Das sieht nicht nach einer CSV-Datei aus. Bitte in Excel «Speichern unter → CSV (Trennzeichen-getrennt)» wählen.");
  const delimiter = detectDelimiter(text);
  const all = parseCsv(text, delimiter);
  if (all.length < 2) throw new Error("Die Datei enthält keine Datenzeilen (erste Zeile = Spaltennamen).");
  if (all.length - 1 > IMPORT_MAX_ROWS) throw new Error(`Zu viele Zeilen (${all.length - 1}). Höchstens ${IMPORT_MAX_ROWS} pro Import.`);
  const width = Math.min(200, all.reduce((w, r) => Math.max(w, r.length), 0));
  const headers = Array.from({ length: width }, (_, i) => (all[0]![i] ?? "").trim() || `Spalte ${i + 1}`);
  const rows = all.slice(1).map((r) => Array.from({ length: width }, (_, i) => (r[i] ?? "").trim()));
  if (rows.length > IMPORT_MAX_ROWS) throw new Error(`Zu viele Zeilen (${rows.length}). Höchstens ${IMPORT_MAX_ROWS} pro Import.`);
  return { headers, rows, encoding, delimiter };
}

// --- Spaltenzuordnung --------------------------------------------------------------

export const IMPORT_FIELDS = [
  "ignore", "firstName", "lastName", "name", "email", "phone", "mobile", "street", "zip", "city", "zipCity",
  "birthDate", "joinedAt", "leftAt", "memberNumber", "licenseNumber", "status", "category", "note",
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];

export const FIELD_LABELS: Record<ImportField, string> = {
  ignore: "– nicht übernehmen –",
  firstName: "Vorname",
  lastName: "Nachname",
  name: "Name (Vor- und Nachname)",
  email: "E-Mail",
  phone: "Telefon",
  mobile: "Mobile / Natel",
  street: "Strasse und Nr.",
  zip: "PLZ",
  city: "Ort",
  zipCity: "PLZ und Ort (zusammen)",
  birthDate: "Geburtsdatum",
  joinedAt: "Eintritt",
  leftAt: "Austritt",
  memberNumber: "Mitgliedernummer",
  licenseNumber: "Lizenznummer",
  status: "Status / Mitgliedschaft",
  category: "Beitragskategorie",
  note: "Bemerkung (nur Vorstand)",
};

export function isImportField(v: unknown): v is ImportField {
  return typeof v === "string" && (IMPORT_FIELDS as readonly string[]).includes(v);
}

/** Spaltennamen vergleichbar machen: klein, ohne Akzente, nur Buchstaben und Ziffern. */
export function normalizeHeader(h: string) {
  return h.toLowerCase().replace(/ß/g, "ss").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
}

type Aliases = Partial<Record<ImportField, string[]>>;

const COMMON: Aliases = {
  firstName: ["vorname", "firstname", "prenom", "rufname"],
  lastName: ["nachname", "familienname", "lastname", "nom", "cognome"],
  name: ["name", "vollername", "namevorname", "vornamename", "mitglied", "fullname"],
  email: ["email", "mail", "emailadresse", "emailprivat", "email1", "emailadresseprivat", "epost"],
  phone: ["telefon", "telefonprivat", "tel", "telprivat", "phone", "telefonnummer", "festnetz", "telefon1"],
  mobile: ["mobile", "natel", "handy", "mobil", "mobiltelefon", "telefonmobil", "natelnummer", "mobilenummer", "mobiletelefon"],
  street: ["strasse", "adresse", "strassenr", "strasseundnr", "strassenummer", "strassehausnummer", "adresszeile1", "str", "address", "rue"],
  zip: ["plz", "postleitzahl", "zip", "npa"],
  city: ["ort", "wohnort", "stadt", "city", "localite"],
  zipCity: ["plzort", "plzundort", "plzwohnort"],
  birthDate: ["geburtsdatum", "geburtstag", "gebdatum", "geboren", "birthdate", "datenaissance", "jahrgangdatum"],
  joinedAt: ["eintritt", "eintrittsdatum", "mitgliedseit", "eintrittam", "beitritt", "beitrittsdatum"],
  leftAt: ["austritt", "austrittsdatum", "austrittam"],
  memberNumber: ["mitgliedernummer", "mitgliednr", "mitgliedernr", "mitgliednummer", "nr", "nummer", "mitgliedsnummer", "mitgliedsnr"],
  licenseNumber: ["lizenz", "lizenznummer", "lizenznr", "sslizenz", "sportlizenz", "lizenznummerssv", "lizenzssv", "sslizenznummer"],
  status: ["status", "mitgliedschaft", "mitgliederstatus", "mitgliedschaftsart", "mitgliedsstatus", "mitgliedertyp", "art"],
  category: ["kategorie", "beitragskategorie", "beitragsart", "beitragsgruppe"],
  note: ["bemerkung", "bemerkungen", "notiz", "notizen", "kommentar", "hinweis"],
};

export type ImportPresetId = "clubdesk" | "webling" | "excel";

export const IMPORT_PRESETS: Record<ImportPresetId, { label: string; hint: string; aliases: Aliases }> = {
  clubdesk: {
    label: "ClubDesk",
    hint: "Export aus ClubDesk (Kontakte → Exportieren → CSV).",
    aliases: {
      street: ["adresse", "strasse"],
      phone: ["telefonprivat", "telefon"],
      mobile: ["mobile", "telefonmobile"],
      joinedAt: ["eintritt", "eintrittsdatum"],
      leftAt: ["austritt"],
      memberNumber: ["mitgliedernr", "mitgliedernummer", "nr"],
      status: ["status", "mitgliedschaft"],
      category: ["gruppe", "beitragskategorie", "kategorie"],
    },
  },
  webling: {
    label: "WebLing",
    hint: "Export aus WebLing (Mitglieder → Export → CSV).",
    aliases: {
      lastName: ["name", "nachname"],
      birthDate: ["geburtstag", "geburtsdatum"],
      memberNumber: ["mitgliedernummer", "mitgliedernr"],
      status: ["mitgliederkategorie", "mitgliedschaft", "status"],
      category: ["beitragskategorie", "beitragsart"],
      mobile: ["mobile", "natel", "mobiltelefon"],
    },
  },
  excel: {
    label: "Excel (Standard)",
    hint: "Eigene Liste mit Spalten wie Vorname, Nachname, E-Mail, Telefon, Strasse, PLZ, Ort.",
    aliases: {},
  },
};

/** Vorschlag pro Spalte. Jedes Zielfeld wird höchstens einmal vergeben. */
export function suggestMapping(headers: string[], preset: ImportPresetId): ImportField[] {
  const norm = headers.map(normalizeHeader);
  const used = new Set<ImportField>();
  const result: ImportField[] = headers.map(() => "ignore");
  const lookups: Aliases[] = [IMPORT_PRESETS[preset].aliases, COMMON];
  const hasFirstName = norm.some((h) => (IMPORT_PRESETS[preset].aliases.firstName ?? COMMON.firstName!).includes(h));

  for (const aliases of lookups) {
    norm.forEach((h, i) => {
      if (result[i] !== "ignore") return;
      for (const field of IMPORT_FIELDS) {
        if (field === "ignore" || used.has(field)) continue;
        if (!(aliases[field] ?? []).includes(h)) continue;
        let target: ImportField = field;
        // «Name» neben «Vorname» ist der Nachname.
        if (field === "name" && hasFirstName) {
          if (used.has("lastName")) continue;
          target = "lastName";
        }
        result[i] = target;
        used.add(target);
        break;
      }
    });
  }
  return result;
}

/** Vorlage anhand der Spaltennamen erraten (meiste vorlagenspezifische Treffer, sonst Excel). */
export function detectPreset(headers: string[]): ImportPresetId {
  const norm = new Set(headers.map(normalizeHeader));
  if (norm.has("mitgliederkategorie") || (norm.has("name") && norm.has("vorname") && norm.has("geburtstag"))) return "webling";
  if (norm.has("telefonprivat") || norm.has("telefongeschaft") || (norm.has("adresse") && norm.has("eintritt"))) return "clubdesk";
  return "excel";
}

// --- Werte normalisieren --------------------------------------------------------------

/**
 * Datum aus «31.12.1980», «31.12.80», «1980-12-31», «31/12/1980» oder Excel-Seriennummer → «YYYY-MM-DD».
 * Zweistellige Jahre: bis zum Pivot-Jahr (zweistellig) 20xx, sonst 19xx.
 */
export function parseSwissDate(raw: string, pivotYY = 30): string | null {
  const s = raw.trim();
  if (!s) return null;
  let y: number, m: number, d: number;
  let match = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/.exec(s);
  if (match) {
    d = Number(match[1]);
    m = Number(match[2]);
    y = Number(match[3]);
    if (match[3]!.length === 2) y += y <= pivotYY ? 2000 : 1900;
  } else if ((match = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/.exec(s))) {
    y = Number(match[1]);
    m = Number(match[2]);
    d = Number(match[3]);
  } else if (/^\d{4,5}(\.0+)?$/.test(s)) {
    // Excel-Seriennummer (Tage seit 30.12.1899)
    const serial = Number.parseFloat(s);
    if (serial < 1000 || serial > 80000) return null;
    const dt = new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86_400_000);
    return dt.toISOString().slice(0, 10);
  } else return null;
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

/** Status aus Freitext («Aktivmitglied», «Passiv», «Ehrenmitglied», «ausgetreten» …). */
export function parseStatus(raw: string): MemberStatus | null | "unknown" {
  const s = normalizeHeader(raw);
  if (!s) return null;
  if (isMemberStatus(raw.trim().toUpperCase())) return raw.trim().toUpperCase() as MemberStatus;
  if (/(ausgetreten|austritt|ehemalig|inaktiv|left|gekundigt|verstorben)/.test(s)) return "LEFT";
  if (/(ehren|freimitglied|veteran)/.test(s)) return "HONORARY";
  if (/(jung|junior|nachwuchs|jugend|js$)/.test(s)) return "JUNIOR";
  if (/(gonner|supporter|forder|sponsor)/.test(s)) return "SUPPORTER";
  if (/passiv/.test(s)) return "PASSIVE";
  if (/(aktiv|active|mitglied|ordentlich|vollmitglied|lizenz)/.test(s)) return "ACTIVE";
  return "unknown";
}

function clean(s: string | undefined) {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

// --- Zeilen übernehmen und prüfen -------------------------------------------------------

export type ImportRecord = {
  name: string;
  email: string | null;
  phone: string | null;
  street: string | null;
  zip: string | null;
  city: string | null;
  birthDate: string | null;
  joinedAt: string | null;
  leftAt: string | null;
  memberNumber: string | null;
  licenseNumber: string | null;
  status: MemberStatus | null;
  category: string | null;
  note: string | null;
};

export type MappedRow = {
  /** Zeilennummer in der Datei (Kopfzeile = 1) */
  line: number;
  record: ImportRecord;
  errors: string[];
  warnings: string[];
};

const LIMITS: Partial<Record<keyof ImportRecord, number>> = {
  name: 191, phone: 40, street: 191, zip: 12, city: 120, memberNumber: 40, licenseNumber: 40, category: 191, note: 2000,
};

/**
 * Wendet die Zuordnung auf alle Zeilen an und prüft sie.
 * `today` («YYYY-MM-DD») für Plausibilitätsprüfungen (Geburtsdatum nicht in der Zukunft).
 */
export function mapRows(rows: string[][], mapping: ImportField[], today: string): MappedRow[] {
  const col = (field: ImportField) => mapping.indexOf(field);
  const idx = Object.fromEntries(IMPORT_FIELDS.map((f) => [f, col(f)])) as Record<ImportField, number>;
  const seenEmails = new Map<string, number>();

  return rows.map((r, i) => {
    const line = i + 2;
    const errors: string[] = [];
    const warnings: string[] = [];
    const get = (f: ImportField) => (idx[f] >= 0 ? clean(r[idx[f]]) : "");

    // Name
    const first = get("firstName");
    const last = get("lastName");
    let name = [first, last].filter(Boolean).join(" ");
    if (!name) name = get("name");
    if (!name) errors.push("Name fehlt");

    // E-Mail
    let email: string | null = get("email").toLowerCase().replace(/^mailto:/, "") || null;
    if (email && email.includes(";")) email = email.split(";")[0]!.trim() || null;
    if (email && !isValidEmail(email)) {
      warnings.push(`E-Mail «${email.slice(0, 60)}» ungültig – ohne E-Mail übernommen`);
      email = null;
    }
    if (email) {
      const prev = seenEmails.get(email);
      if (prev) errors.push(`E-Mail doppelt in der Datei (auch Zeile ${prev})`);
      else seenEmails.set(email, line);
    }

    // Telefon: Telefon, sonst Mobile
    const phone = get("phone") || get("mobile") || null;

    // Adresse
    let zip = get("zip") || null;
    let city = get("city") || null;
    const zipCity = get("zipCity");
    if (zipCity && (!zip || !city)) {
      const m = /^(?:CH-)?(\d{4,5})\s+(.+)$/i.exec(zipCity);
      if (m) {
        zip ??= m[1]!;
        city ??= m[2]!;
      } else city ??= zipCity;
    }

    // Daten
    const date = (f: ImportField, label: string) => {
      const raw = get(f);
      if (!raw) return null;
      const v = parseSwissDate(raw);
      if (!v) warnings.push(`${label} «${raw.slice(0, 30)}» nicht erkannt – leer gelassen`);
      return v;
    };
    let birthDate = date("birthDate", "Geburtsdatum");
    if (birthDate && (birthDate > today || birthDate < "1900-01-01")) {
      warnings.push(`Geburtsdatum ${birthDate} unplausibel – leer gelassen`);
      birthDate = null;
    }
    const joinedAt = date("joinedAt", "Eintritt");
    const leftAt = date("leftAt", "Austritt");

    // Status
    let status: MemberStatus | null = null;
    const rawStatus = get("status");
    if (rawStatus) {
      const s = parseStatus(rawStatus);
      if (s === "unknown") {
        warnings.push(`Status «${rawStatus.slice(0, 40)}» unbekannt – als «Aktiv» übernommen`);
        status = "ACTIVE";
      } else status = s;
    }
    if (leftAt && leftAt <= today && !status) status = "LEFT";

    const record: ImportRecord = {
      name,
      email,
      phone,
      street: get("street") || null,
      zip,
      city,
      birthDate,
      joinedAt,
      leftAt,
      memberNumber: get("memberNumber") || null,
      licenseNumber: get("licenseNumber") || null,
      status,
      category: get("category") || null,
      note: idx.note >= 0 ? (r[idx.note] ?? "").trim() || null : null,
    };
    for (const [k, max] of Object.entries(LIMITS) as Array<[keyof ImportRecord, number]>) {
      const v = record[k];
      if (typeof v === "string" && v.length > max) {
        warnings.push(`${k === "name" ? "Name" : k} gekürzt (max. ${max} Zeichen)`);
        (record as Record<string, unknown>)[k] = v.slice(0, max);
      }
    }
    return { line, record, errors, warnings };
  });
}

/** Für die Dublettensuche: Name ohne Akzente, Gross/Klein und Mehrfach-Leerzeichen, Wortreihenfolge egal. */
export function nameKey(name: string) {
  return normalizeHeaderWords(name).sort().join(" ");
}
function normalizeHeaderWords(s: string) {
  return s.toLowerCase().replace(/ß/g, "ss").normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter(Boolean);
}

export type ImportDecision = "create" | "update" | "skip";

export type ExistingMember = { membershipId: string; userId: string; name: string; email: string; birthDate: string | null };

export type DuplicateMatch = { membershipId: string; userId: string; name: string; reason: "email" | "nameBirth" };

/** Dublette im Verein: gleiche E-Mail oder gleicher Name + Geburtsdatum. */
export function findDuplicate(record: ImportRecord, byEmail: Map<string, ExistingMember>, byNameBirth: Map<string, ExistingMember>): DuplicateMatch | null {
  if (record.email) {
    const m = byEmail.get(record.email);
    if (m) return { membershipId: m.membershipId, userId: m.userId, name: m.name, reason: "email" };
  }
  if (record.birthDate && record.name) {
    const m = byNameBirth.get(`${nameKey(record.name)}|${record.birthDate}`);
    if (m) return { membershipId: m.membershipId, userId: m.userId, name: m.name, reason: "nameBirth" };
  }
  return null;
}

export function indexExisting(members: ExistingMember[]) {
  const byEmail = new Map<string, ExistingMember>();
  const byNameBirth = new Map<string, ExistingMember>();
  for (const m of members) {
    byEmail.set(m.email.toLowerCase(), m);
    if (m.birthDate) byNameBirth.set(`${nameKey(m.name)}|${m.birthDate}`, m);
  }
  return { byEmail, byNameBirth };
}

export function defaultDecision(row: MappedRow, dup: DuplicateMatch | null): ImportDecision {
  if (row.errors.length) return "skip";
  return dup ? "update" : "create";
}
