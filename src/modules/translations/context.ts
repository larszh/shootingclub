/**
 * Verbindet die reine Logik mit den mitgelieferten Wörterbüchern aus core.ts.
 * Client-sicher (core.ts hat keine Server-Abhängigkeiten).
 */
import { allDictionaryKeys, baseText, DEFAULT_LOCALE, type Locale, type OverrideMap } from "@/lib/i18n/core";
import type { DictionaryContext } from "./logic";

let keySet: Set<string> | null = null;

/** Alle Schlüssel aus Basis- und Zusatz-Wörterbüchern (einmal berechnet). */
export function dictionaryKeySet(): Set<string> {
  keySet ??= new Set(allDictionaryKeys());
  return keySet;
}

/** Referenz für Platzhalter: mitgelieferter deutscher Text, sonst der Text der Sprache. */
export function referenceText(locale: Locale, key: string): string | undefined {
  return baseText(DEFAULT_LOCALE, key) ?? baseText(locale, key);
}

export function dictionaryContext(overrides: OverrideMap): DictionaryContext {
  const keys = dictionaryKeySet();
  return {
    hasKey: (k) => keys.has(k),
    reference: referenceText,
    base: baseText,
    override: (l, k) => overrides[l]?.[k],
  };
}
