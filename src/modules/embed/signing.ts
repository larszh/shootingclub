/**
 * Signierte Widget-Parameter (HMAC-SHA256 mit AUTH_SECRET). Ohne DB und ohne "server-only",
 * damit es testbar ist – darf aber nur serverseitig genutzt werden (Geheimnis!).
 *
 * Kalender und Schiesszeiten sind mit dem Embed-Token frei verfügbar. Rangliste und
 * Meisterschaft zeigen Namen; sie erscheinen nur, wenn der Admin den Code in /admin/embed
 * erzeugt hat: Die URL trägt dann ?sig=…, gebunden an Token, Widget und die erlaubten Parameter.
 * Ein neuer Embed-Token macht alle alten Signaturen ungültig.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const SIGNED_WIDGETS = ["ranking", "championship"] as const;
export type SignedWidget = (typeof SIGNED_WIDGETS)[number];

/** Parameter, die pro Widget signiert werden (alle anderen sind rein kosmetisch, z.B. theme). */
export const SIGNED_PARAMS: Record<SignedWidget, readonly string[]> = {
  ranking: ["program", "period"],
  championship: ["id"],
};

const SIG_LEN = 32;

function secretOrNull(secret?: string | null) {
  const s = secret ?? process.env.AUTH_SECRET ?? "";
  return s.length >= 16 ? s : null;
}

/** Kanonische Form: feste Reihenfolge der Schlüssel, leere Werte als «». */
export function canonicalParams(widget: SignedWidget, params: Record<string, string | null | undefined>) {
  return SIGNED_PARAMS[widget].map((k) => `${k}=${encodeURIComponent(params[k] ?? "")}`).join("&");
}

/** Signatur (base64url, 32 Zeichen) oder null, wenn kein AUTH_SECRET gesetzt ist. */
export function signEmbed(token: string, widget: SignedWidget, params: Record<string, string | null | undefined>, secret?: string | null) {
  const key = secretOrNull(secret);
  if (!key) return null;
  return createHmac("sha256", `${key}:embed-widget`).update(`v1\n${token}\n${widget}\n${canonicalParams(widget, params)}`).digest("base64url").slice(0, SIG_LEN);
}

export function verifyEmbed(token: string, widget: SignedWidget, params: Record<string, string | null | undefined>, sig: string | null | undefined, secret?: string | null) {
  if (!sig || sig.length !== SIG_LEN) return false;
  const expected = signEmbed(token, widget, params, secret);
  if (!expected) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}
