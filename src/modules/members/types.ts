/**
 * Mitgliederverwaltung: gemeinsame Typen, Beschriftungen und reine Hilfsfunktionen
 * (ohne Server-Abhängigkeiten, auch in Client-Komponenten nutzbar).
 */

export const MEMBER_STATUSES = ["ACTIVE", "PASSIVE", "HONORARY", "JUNIOR", "SUPPORTER", "LEFT"] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export const STATUS_LABELS: Record<MemberStatus, string> = {
  ACTIVE: "Aktiv",
  PASSIVE: "Passiv",
  HONORARY: "Ehrenmitglied",
  JUNIOR: "Jungschütze",
  SUPPORTER: "Gönner",
  LEFT: "Ausgetreten",
};

export function isMemberStatus(s: unknown): s is MemberStatus {
  return typeof s === "string" && (MEMBER_STATUSES as readonly string[]).includes(s);
}

export function statusLabel(s: string | null | undefined) {
  return s && isMemberStatus(s) ? STATUS_LABELS[s] : s ?? "–";
}

export function statusTone(s: string): "neutral" | "accent" | "ok" | "warn" | "danger" | "outline" {
  switch (s) {
    case "ACTIVE": return "ok";
    case "JUNIOR": return "accent";
    case "HONORARY": return "accent";
    case "LEFT": return "danger";
    case "SUPPORTER": return "outline";
    default: return "neutral";
  }
}

/** Platzhalter-Adressen für Mitglieder ohne E-Mail (können sich nicht anmelden, sind aber verrechenbar). */
export const PLACEHOLDER_EMAIL_DOMAIN = "standchef.invalid";
export function placeholderEmail(id: string) {
  return `noemail+${id}@${PLACEHOLDER_EMAIL_DOMAIN}`;
}
export function isPlaceholderEmail(email: string | null | undefined) {
  return !!email && email.toLowerCase().endsWith(`@${PLACEHOLDER_EMAIL_DOMAIN}`);
}

/** E-Mail für die Anzeige: Platzhalter werden ausgeblendet. */
export function displayEmail(email: string | null | undefined) {
  return email && !isPlaceholderEmail(email) ? email : null;
}

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[a-z]{2,}$/i;
export function isValidEmail(email: string) {
  return email.length <= 191 && EMAIL_RE.test(email);
}

/** «YYYY-MM-DD» → Alter in ganzen Jahren am Stichtag (ebenfalls «YYYY-MM-DD»). */
export function ageOn(birthDate: string, today: string): number | null {
  const b = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  const t = /^(\d{4})-(\d{2})-(\d{2})$/.exec(today);
  if (!b || !t) return null;
  let age = Number(t[1]) - Number(b[1]);
  if (t[2]! < b[2]! || (t[2] === b[2] && t[3]! < b[3]!)) age--;
  return age;
}

export function isMinor(birthDate: string | null | undefined, today: string) {
  if (!birthDate) return false;
  const age = ageOn(birthDate, today);
  return age !== null && age < 18;
}

/** Date (DB, @db.Date = UTC-Mitternacht) → «YYYY-MM-DD». */
export function dateOnly(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

/** «YYYY-MM-DD» → Date für @db.Date-Spalten (UTC-Mitternacht). */
export function toDbDate(s: string | null | undefined): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : d;
}

/** Schweizer Datumsanzeige «31.12.2024» für «YYYY-MM-DD». */
export function formatIsoDate(s: string | null | undefined) {
  if (!s) return "–";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : s;
}

// --- Liste: Filter und Sortierung -------------------------------------------

export const MEMBER_PAGE_SIZE = 50;

export const SORTS = {
  name: "Name A–Z",
  "-name": "Name Z–A",
  number: "Mitgliedernummer",
  joined: "Eintritt (älteste zuerst)",
  "-joined": "Eintritt (neueste zuerst)",
  "-created": "Zuletzt erfasst",
} as const;
export type MemberSort = keyof typeof SORTS;

export const ACCESS_FILTERS = {
  nopw: "Ohne Passwort (alle)",
  invited: "Einladung offen",
  never: "Noch nie eingeladen",
  active: "Mit Zugang",
} as const;
export type AccessFilter = keyof typeof ACCESS_FILTERS;

export type MemberFilters = {
  q: string;
  status: string; // "" = alle ausser Ausgetretene, "all" = alle, sonst Status
  role: string;
  cat: string; // Kategorie-ID oder "none"
  hh: string; // Haushalt-ID, "none" oder "any"
  access: string;
  minor: boolean;
  sort: MemberSort;
  page: number;
};

type SearchParamsLike = Record<string, string | string[] | undefined>;

export function parseMemberFilters(sp: SearchParamsLike): MemberFilters {
  const one = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v)?.trim().slice(0, 100) ?? "";
  };
  const sort = one("sort");
  const page = Number.parseInt(one("page"), 10);
  return {
    q: one("q"),
    status: one("status"),
    role: one("role"),
    cat: one("cat"),
    hh: one("hh"),
    access: one("access") in ACCESS_FILTERS ? one("access") : "",
    minor: one("minor") === "1",
    sort: sort in SORTS ? (sort as MemberSort) : "name",
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 10_000) : 1,
  };
}

/** Filter → Query-String (ohne Standardwerte). */
export function filtersToQuery(f: Partial<MemberFilters>) {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.status) p.set("status", f.status);
  if (f.role) p.set("role", f.role);
  if (f.cat) p.set("cat", f.cat);
  if (f.hh) p.set("hh", f.hh);
  if (f.access) p.set("access", f.access);
  if (f.minor) p.set("minor", "1");
  if (f.sort && f.sort !== "name") p.set("sort", f.sort);
  if (f.page && f.page > 1) p.set("page", String(f.page));
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** «Familie Muster (3 Mitglieder)» – Bezeichnung der Haushaltsrechnung. */
export function householdInvoiceLabel(name: string, count: number) {
  return `${name} (${count} Mitglieder)`.slice(0, 191);
}
export const HOUSEHOLD_INVOICE_RE = /\(\d+ Mitglieder\)$/;
