export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function formatDate(d: Date | string, opts?: Intl.DateTimeFormatOptions) {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("de-CH", opts ?? { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

export function formatDateTime(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatScore(n: number, decimal = false) {
  return decimal ? n.toFixed(1) : String(Math.round(n));
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** Beitrittscodes: 8 Zeichen (32^8 ≈ 1.1e12) gegen Durchprobieren. */
export function randomCode(len = 8) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

export function safeJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/** Stunde (0–23) in Schweizer Zeit. Ohne Argument: jetzt. */
export function zurichHour(at: Date = new Date()) {
  const h = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Zurich", hourCycle: "h23", hour: "2-digit" }).format(at);
  return Number(h) % 24;
}

/** Tageszeitabhängiger Gruss in Schweizer Zeit («Guten Morgen», «Hallo», «Guten Abend»). */
export function dayGreeting(at: Date = new Date()) {
  const hour = zurichHour(at);
  if (hour >= 5 && hour < 11) return "Guten Morgen";
  if (hour < 18) return "Hallo";
  return "Guten Abend";
}

/** Einzahl/Mehrzahl: plural(1, "Rechnung", "Rechnungen") → "1 Rechnung" */
export function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Prüft ein Rücksprungziel (z.B. ?next= nach der Anmeldung): nur relative Pfade
 * auf derselben Origin, keine Protokoll-relativen URLs ("//…", "/\…") und nicht
 * zurück auf /login bzw. /register. Gibt null zurück, wenn ungültig.
 */
export function safeNextPath(raw: unknown): string | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v !== "string" || v.length > 512) return null;
  if (!v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\")) return null;
  // Steuerzeichen und Backslashes werden von Browsern teils zu "/" normalisiert.
  if (/[\u0000-\u001f\u007f\\]/.test(v)) return null;
  if (/^\/(login|register)(?:[/?#]|$)/.test(v)) return null;
  return v;
}
