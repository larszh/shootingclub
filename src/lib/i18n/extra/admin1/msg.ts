/**
 * Übersetzt deutsche Meldungen aus Diensten und zod-Schemas (z.B. «Produkt nicht gefunden.») an der
 * Grenze zur Oberfläche: Server-Aktionen geben `trMsg(t, meldung)` zurück. Gesucht wird der
 * «adm1.»-Schlüssel, dessen deutscher Text der Meldung entspricht – exakt oder als Muster mit
 * Platzhaltern ({n}, {name} …). Unbekannte Meldungen bleiben unverändert.
 */
import type { TFunction } from "@/lib/i18n/core";
import dict from "../admin1";

type Pattern = { key: string; re: RegExp; names: string[]; literal: number };

let exact: Map<string, string> | null = null;
let patterns: Pattern[] = [];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Platzhalter, die immer Zahlen sind, treffen nur Zahlen (auch «1’234», «-3»). Sonst würde z.B.
 * «Rechnung {year}» die Meldung «Rechnung storniert.» treffen.
 */
const NUMERIC = new Set(["n", "count", "rows", "created", "updated", "skipped", "lines", "page", "pages", "max", "limit", "rounds"]);
const placeholderRe = (name: string) => (name === "year" ? "(\\d{4})" : NUMERIC.has(name) ? "([-+−]?\\d[\\d'’.,]*)" : "(.+?)");

function build() {
  exact = new Map();
  patterns = [];
  for (const [key, text] of Object.entries(dict.de)) {
    if (!key.startsWith("adm1.")) continue;
    if (text.includes("{")) {
      const names: string[] = [];
      const src = text.split(/(\{[a-zA-Z0-9_]+\})/).map((part) => {
        const m = /^\{([a-zA-Z0-9_]+)\}$/.exec(part);
        if (m) {
          names.push(m[1]!);
          return placeholderRe(m[1]!);
        }
        return escape(part);
      }).join("");
      const literal = text.replace(/\{[a-zA-Z0-9_]+\}/g, "").trim().length;
      // Zu wenig fester Text (z.B. nur «{name}») würde beliebige Meldungen treffen.
      if (literal >= 8) patterns.push({ key, re: new RegExp(`^${src}$`, "s"), names, literal });
    } else if (!exact.has(text)) {
      exact.set(text, key);
    }
  }
  patterns.sort((a, b) => b.literal - a.literal);
}

/** Schlüssel zu einer deutschen Meldung (mit erkannten Platzhalterwerten) oder null. */
export function msgKey(msg: string): { key: string; vars: Record<string, string> } | null {
  if (!exact) build();
  const k = exact!.get(msg);
  if (k) return { key: k, vars: {} };
  for (const p of patterns) {
    const m = p.re.exec(msg);
    if (m) return { key: p.key, vars: Object.fromEntries(p.names.map((n, i) => [n, m[i + 1] ?? ""])) };
  }
  return null;
}

/** Deutsche Meldung in die Sprache von `t` übersetzen; unbekannte Meldungen unverändert. */
export function trMsg(t: TFunction, msg: string | null | undefined): string {
  if (!msg) return msg ?? "";
  const hit = msgKey(msg);
  return hit ? t(hit.key, hit.vars) : msg;
}

/** Feldfehler (Feld → deutsche Meldung) übersetzen. */
export function trFieldErrors(t: TFunction, errors: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!errors) return errors;
  return Object.fromEntries(Object.entries(errors).map(([f, m]) => [f, trMsg(t, m)]));
}
