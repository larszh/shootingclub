/**
 * Prompt für «Mit Claude übersetzen» (reine Funktionen, testbar).
 * Der System-Prompt ist stabil (wird gecacht); Zielsprache kommt in systemExtra,
 * die Texte als abgegrenzte Daten in die Benutzernachricht.
 */
import { UNTRUSTED_NOTICE } from "@/lib/ai/prompt";
import type { Locale } from "@/lib/i18n/locales";

export const TARGET_LANGUAGE: Record<Exclude<Locale, "de">, string> = {
  fr: "Swiss French (fr-CH). Use the informal «tu» for app texts addressed to the user, the formal «vous» only in formal documents (invoices, reminders). " +
    "Use French typography with a non-breaking space (U+00A0) before : ; ! ? and inside « ».",
  it: "Swiss Italian (it-CH). Use the informal «tu» for app texts addressed to the user. Use «» quotes.",
  en: "Neutral, British-leaning English as used in Switzerland (e.g. «licence», «programme», CHF amounts, dates dd.mm.yyyy are formatted by the app). Use “ ” or plain quotes, not «».",
};

export const TRANSLATION_SYSTEM = [
  "You translate user-interface strings of «Standchef», a mobile web app for Swiss shooting clubs (Schützenvereine): members, shooting range (Schiessstand) bookings, scores, federal programmes (Obligatorisches Programm, Feldschiessen), ammunition sales, invoices, shifts, courses.",
  "The source language is Swiss Standard German. Translate each string into the target language given below.",
  "",
  "Rules:",
  "- Keep every placeholder in curly braces exactly as written, e.g. {name}, {count}, {date}. Never translate, rename, add or remove placeholders.",
  "- Keep line breaks, Markdown markers, leading/trailing punctuation, symbols, numbers and units. Do not add explanations.",
  "- Keep product and proper names unchanged (Standchef, TWINT). For the Swiss QR bill use the usual local term (QR-Rechnung → facture QR / fattura QR / QR bill).",
  "- Use established Swiss shooting terminology of the target language (e.g. Schützenverein → société de tir / società di tiro / shooting club; Obligatorisches Programm → programme obligatoire / programma obbligatorio / obligatory programme; Feldschiessen → tir en campagne / tiro in campagna / field shooting).",
  "- Keep UI strings short; buttons and labels should be about as long as the German text.",
  "- The key name hints at where the string appears (e.g. «.title», «.button», «.hint»). If an existing translation is given, improve it only if it is wrong or unidiomatic; otherwise return it unchanged.",
  "- Return exactly one item per requested key, with the key copied verbatim.",
  "",
  UNTRUSTED_NOTICE,
].join("\n");

export function targetLanguageLine(locale: Exclude<Locale, "de">): string {
  return `Target language: ${TARGET_LANGUAGE[locale]}`;
}

export type TranslationItem = { key: string; source: string; current?: string; english?: string };

/** Benutzernachricht: Auftrag + abgegrenzte JSON-Daten. */
export function translationUserMessage(items: readonly TranslationItem[], wrap: (label: string, text: string) => string): string {
  const payload = items.map((it) => {
    const o: Record<string, string> = { key: it.key, de: it.source };
    if (it.current) o.current = it.current;
    if (it.english) o.en_reference = it.english;
    return o;
  });
  return [
    `Translate the ${items.length} strings below. Each item has the key, the German source text («de»), optionally the current translation («current») and an English reference («en_reference»).`,
    wrap("strings", JSON.stringify(payload, null, 1)),
  ].join("\n\n");
}
