import "server-only";
import { db } from "@/lib/db";
import { getOverrides, isLocale, setOverrides, type Dict, type Locale, type OverrideMap } from "./core";

/**
 * Übersteuerungen aus der Tabelle TranslationOverride (scope "global") in die Registry von
 * core.ts laden. Beim Start (instrumentation.ts) und nach jedem Speichern (reloadOverrides).
 * Das Root-Layout ruft ensureOverridesLoaded() und gibt die Tabelle an <I18nOverrides> weiter,
 * damit Server und Browser identisch rendern.
 */

const FLAG = "__standchefI18nOverridesLoaded";

function loaded(): boolean {
  return (globalThis as unknown as Record<string, boolean | undefined>)[FLAG] === true;
}

function markLoaded() {
  (globalThis as unknown as Record<string, boolean | undefined>)[FLAG] = true;
}

/** Liest alle globalen Übersteuerungen und setzt sie in die Registry. Bei DB-Fehler bleibt die alte Tabelle. */
export async function loadOverrides(): Promise<OverrideMap> {
  try {
    const rows = await db.translationOverride.findMany({ where: { scope: "global" }, select: { locale: true, key: true, value: true } });
    const map: Partial<Record<Locale, Dict>> = {};
    for (const r of rows) {
      if (!isLocale(r.locale) || !r.value) continue;
      (map[r.locale] ??= {})[r.key] = r.value;
    }
    setOverrides(map);
    markLoaded();
  } catch (err) {
    console.error("[i18n] Übersteuerungen nicht geladen:", err instanceof Error ? err.message : err);
  }
  return getOverrides();
}

/** Nach dem Speichern/Löschen von Übersteuerungen aufrufen. */
export async function reloadOverrides(): Promise<OverrideMap> {
  return loadOverrides();
}

/** Lädt einmalig (falls die Instrumentation es nicht getan hat) und liefert die aktuelle Tabelle. */
export async function ensureOverridesLoaded(): Promise<OverrideMap> {
  if (loaded()) return getOverrides();
  return loadOverrides();
}
