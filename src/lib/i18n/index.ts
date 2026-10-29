import "server-only";
import { cookies, headers } from "next/headers";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { DEFAULT_LOCALE, isLocale, normalizeLocale, type Locale } from "./core";

export * from "./core";

/** Wählt aus einem Accept-Language-Header die beste unterstützte Sprache (q-Werte beachtet). */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null;
  const entries = header
    .split(",")
    .map((part, idx) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      const weight = q ? Number(q.slice(2)) : 1;
      return { base: (tag ?? "").trim().toLowerCase().slice(0, 2), weight: Number.isFinite(weight) ? weight : 0, idx };
    })
    .filter((e) => e.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.idx - b.idx);
  for (const e of entries) if (isLocale(e.base)) return e.base;
  return null;
}

/**
 * Sprache für den aktuellen Request:
 * Benutzersprache → Standardsprache des aktiven Vereins → Accept-Language → Deutsch.
 */
export async function getRequestLocale(): Promise<Locale> {
  try {
    const user = await getCurrentUser();
    if (user && isLocale(user.locale)) return user.locale;
    const jar = await cookies();
    const tenantId = jar.get("standchef_tenant")?.value;
    if (tenantId) {
      const t = await db.tenant.findUnique({ where: { id: tenantId }, select: { defaultLocale: true } });
      if (t && isLocale(t.defaultLocale)) return t.defaultLocale;
    }
    const h = await headers();
    return localeFromAcceptLanguage(h.get("accept-language")) ?? DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

/** Sprache eines Vereins für Rechnungen, Mails und Druck. */
export async function getTenantLocale(tenantId: string | null | undefined): Promise<Locale> {
  if (!tenantId) return DEFAULT_LOCALE;
  const t = await db.tenant.findUnique({ where: { id: tenantId }, select: { defaultLocale: true } });
  return normalizeLocale(t?.defaultLocale);
}

/** Sprache eines Benutzers (für Mails/Push an ihn). */
export async function getUserLocale(userId: string): Promise<Locale> {
  const u = await db.user.findUnique({ where: { id: userId }, select: { locale: true } });
  return normalizeLocale(u?.locale);
}
