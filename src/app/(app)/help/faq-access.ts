import type { Locale } from "@/lib/i18n/locales";
import type { Permission } from "@/lib/permissions";
import { toEntry, type FaqEntry, type FaqSource } from "./faq-types";
import { MEMBER_FAQ } from "./faq-member";
import { ADMIN_FAQ } from "./faq-admin";

/** Alle Fragen in Anzeige-Reihenfolge (die Ansicht gruppiert nach Zielgruppe). */
export const FAQ_SOURCES: FaqSource[] = [...MEMBER_FAQ, ...ADMIN_FAQ];

/**
 * Anleitungen für Funktionen, die schon unterhalb der Admin-Rolle erlaubt sind (z.B. Trainer/Schützenmeister).
 * Wer die Berechtigung hat, sieht die Anleitung auch ohne «tenant.manage».
 */
export const ENTRY_PERMISSION: Partial<Record<string, Permission>> = {
  "amtlich-bestaetigen": "results.verify",
  standbuch: "range.duty",
  vereinswaffen: "weapons.loan",
  "kurse-admin": "courses.manage",
  "live-rangliste": "match.viewAll",
  "resultat-import": "match.viewAll",
  "schuetzenstube-theke": "kiosk.sell",
  "schuetzenstube-admin": "kiosk.manage",
  buchhaltung: "accounting.export",
  serienbuchung: "bookings.series",
  "feldschiessen-auszeichnungen": "results.verify",
};

/** Wer fragt: Admin-Ansicht (tenant.manage bzw. Super-Admin ohne Verein) und Einzelrechte. */
export type FaqAccess = { isAdmin: boolean; can: (perm: Permission) => boolean };

/** Darf diese Person den Eintrag sehen? (Gleicher Filter für /help und den Hilfe-Assistenten.) */
export function faqVisible(e: Pick<FaqSource, "id" | "audience">, access: FaqAccess): boolean {
  if (e.audience === "member" || access.isAdmin) return true;
  const perm = ENTRY_PERMISSION[e.id];
  return !!perm && access.can(perm);
}

/** Sichtbare Einträge in der Sprache der Person. */
export function visibleFaq(access: FaqAccess, locale: Locale, sources: FaqSource[] = FAQ_SOURCES): FaqEntry[] {
  return sources.filter((e) => faqVisible(e, access)).map((e) => toEntry(e, locale));
}
