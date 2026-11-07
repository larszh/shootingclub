/**
 * Prompts und Antwort-Schemas für «Inhalte mit Claude» (Übersetzen, Schreibhilfe, Jahresbericht).
 * Reine Funktionen (ohne Server-Abhängigkeiten, getestet).
 *
 * Regeln: Der stabile System-Prompt (gecacht) enthält keine Daten. Sprache, Inhaltsart und
 * Vereinsname kommen in systemExtra. Alle Texte aus dem Verein gehen über untrusted() in die
 * Benutzernachricht – es sind Daten, keine Anweisungen.
 */
import * as z from "zod/v4";
import { LANGUAGE_NAMES, UNTRUSTED_NOTICE, answerLanguageLine, untrusted } from "@/lib/ai/prompt";
import type { Locale } from "@/lib/i18n/core";
import { CONTENT_ENTITIES, type ContentEntityType } from "./entities";

export type PromptParts = { system: string; systemExtra: string; user: string };

function languageName(locale: string): string {
  return LANGUAGE_NAMES[locale] ?? LANGUAGE_NAMES.de!;
}

// ---------------------------------------------------------------------------
// Übersetzen

export const TRANSLATION_SYSTEM = [
  "You translate texts of a Swiss shooting club (Schützenverein) for the club app «Standchef».",
  "Translate every field you receive into the target language named below and return all of them.",
  "Rules:",
  "- Keep the meaning, tone and structure. Keep every line break, blank line, list marker (-, *, 1.), heading marker (#, ##) and **bold** marker exactly where it is.",
  "- Do not translate or change: names of people, the club name, place and street names, range names, URLs, e-mail addresses, phone numbers, dates, times, numbers, amounts (CHF), weapon designations (e.g. Stgw 90, Stgw 57, Karabiner 31, Pistole 75) and official programme codes.",
  "- Use the established Swiss terms of the shooting sport: Obligatorisches Programm = tir obligatoire = tiro obbligatorio = obligatory programme; Feldschiessen = tir en campagne = tiro in campagna = field shooting; Jungschützen = jeunes tireurs = giovani tiratori = young shooters; Schützenmeister = chef de tir = capo tiro = range officer; Standordnung = règlement du stand = regolamento del poligono = range rules; Schützenhaus = stand de tir = poligono = shooting range clubhouse.",
  "- Swiss conventions: in German write «ss», never «ß»; use Swiss quotation marks «»; French uses Swiss French (septante, huitante, nonante) with « » and narrow spaces; Italian uses Swiss Italian.",
  "- Do not add explanations, notes, greetings or content that is not in the source. Do not shorten.",
  "- If a field is already in the target language, return it unchanged.",
  "Return only the JSON object required by the schema: one entry per field with the field key and the translated text.",
  UNTRUSTED_NOTICE,
].join("\n");

export const translationSchema = z.object({
  fields: z.array(z.object({ field: z.string(), text: z.string() })),
});
export type TranslationOutput = z.infer<typeof translationSchema>;

const ENTITY_DESCRIPTION: Record<ContentEntityType, string> = {
  event: "a club event (title and description)",
  announcement: "a club announcement / news item (title and text)",
  rangeRules: "the range rules (Standordnung) of the club. The body uses a light markdown: lines starting with # or ## are headings, - or 1. are list items, **text** is bold",
};

export function buildTranslationPrompt(input: {
  entityType: ContentEntityType;
  sourceLocale: Locale;
  targetLocale: Locale;
  clubName: string;
  fields: Record<string, string>;
}): PromptParts {
  const systemExtra = [
    `Content: ${ENTITY_DESCRIPTION[input.entityType]}.`,
    `Source language: ${languageName(input.sourceLocale)}.`,
    `Target language: ${languageName(input.targetLocale)}.`,
    `Club name (never translate): ${input.clubName.replace(/[\r\n]+/g, " ").slice(0, 191)}.`,
  ].join("\n");
  const keys = CONTENT_ENTITIES[input.entityType].fields.map((f) => f.key).filter((k) => (input.fields[k] ?? "").trim());
  const user = [
    `Translate these fields: ${keys.join(", ")}.`,
    ...keys.map((k) => untrusted(`field-${k}`, input.fields[k]!)),
  ].join("\n\n");
  return { system: TRANSLATION_SYSTEM, systemExtra, user };
}

/**
 * Antwort prüfen: jedes angefragte Feld muss mit Text vorhanden sein. null = unbrauchbar.
 */
export function readTranslation(out: TranslationOutput, requested: readonly string[]): Record<string, string> | null {
  const map: Record<string, string> = {};
  for (const f of out.fields) {
    if (requested.includes(f.field) && typeof f.text === "string" && f.text.trim() && !(f.field in map)) map[f.field] = f.text.replace(/\r\n?/g, "\n").trim();
  }
  return requested.every((k) => k in map) ? map : null;
}

// ---------------------------------------------------------------------------
// Schreibhilfe

export const WRITING_TONES = ["factual", "friendly", "short"] as const;
export type WritingTone = (typeof WRITING_TONES)[number];
export function isWritingTone(v: unknown): v is WritingTone {
  return typeof v === "string" && (WRITING_TONES as readonly string[]).includes(v);
}

export const WRITING_KINDS = ["event", "announcement"] as const;
export type WritingKind = (typeof WRITING_KINDS)[number];

const TONE_TEXT: Record<WritingTone, string> = {
  factual: "factual and clear (sachlich)",
  friendly: "friendly and inviting, still matter-of-fact (freundlich)",
  short: "very short: two to four sentences at most (kurz)",
};

export const WRITING_SYSTEM = [
  "You help the board of a Swiss shooting club (Schützenverein) write texts for the club app «Standchef»: event descriptions and announcements to all members.",
  "Rules:",
  "- Use only facts from the notes or the existing text. Never invent dates, times, places, prices, names, deadlines or requirements. If something important is missing (e.g. a time), write the text without it; do not use placeholders.",
  "- Plain text only: no markdown headings, no bold, no tables, no emojis. Short paragraphs separated by a blank line; simple lists with «- » are fine. Keep URLs unchanged.",
  "- Address members in the way usual in Swiss clubs (German: «ihr»/«euch» for the members; French: «vous»; Italian: «voi»; English: «you»).",
  "- In German write Swiss Standard German: «ss» instead of «ß», quotation marks «». No Swiss German dialect.",
  "- Title: short and concrete (at most 80 characters), no date in the title unless the notes demand it, no trailing period.",
  "Return only the JSON object required by the schema.",
  UNTRUSTED_NOTICE,
].join("\n");

export const draftSchema = z.object({ title: z.string(), text: z.string() });
export type DraftOutput = z.infer<typeof draftSchema>;

export const improveSchema = z.object({ title: z.string(), text: z.string(), changes: z.array(z.string()) });
export type ImproveOutput = z.infer<typeof improveSchema>;

export type EventFacts = { kind?: string | null; date?: string | null; time?: string | null; location?: string | null };

export function buildDraftPrompt(input: {
  kind: WritingKind;
  tone: WritingTone;
  locale: Locale;
  clubName: string;
  notes: string;
  title?: string | null;
  facts?: EventFacts | null;
}): PromptParts {
  const systemExtra = [
    `Task: write a ${input.kind === "event" ? "description for a club event" : "announcement to all club members"}.`,
    `Tone: ${TONE_TEXT[input.tone]}.`,
    answerLanguageLine(input.locale),
    `Club name: ${input.clubName.replace(/[\r\n]+/g, " ").slice(0, 191)}.`,
  ].join("\n");
  const facts = input.facts
    ? Object.entries(input.facts)
        .filter(([, v]) => typeof v === "string" && v.trim())
        .map(([k, v]) => `${k}: ${String(v).trim().slice(0, 191)}`)
        .join("\n")
    : "";
  const parts = ["Write a title and the text from these notes."];
  if (input.title?.trim()) parts.push(untrusted("current-title", input.title.trim()));
  if (facts) parts.push(untrusted("form-facts", facts));
  parts.push(untrusted("notes", input.notes.trim()));
  return { system: WRITING_SYSTEM, systemExtra, user: parts.join("\n\n") };
}

export function buildImprovePrompt(input: { kind: WritingKind; locale: Locale; clubName: string; title: string; text: string }): PromptParts {
  const systemExtra = [
    `Task: improve an existing ${input.kind === "event" ? "event description" : "announcement"}: fix spelling, grammar and punctuation, make it clearer and easier to read. Keep the meaning, all facts and roughly the length. Keep the language of the original text.`,
    "If the text is German, apply Swiss orthography («ss», «»).",
    `List the most important changes in "changes" (at most 5 short items, in ${languageName(input.locale)}). Empty list if nothing needed changing.`,
    `Club name: ${input.clubName.replace(/[\r\n]+/g, " ").slice(0, 191)}.`,
  ].join("\n");
  const user = ["Improve this title and text.", untrusted("title", input.title.trim()), untrusted("text", input.text.trim())].join("\n\n");
  return { system: WRITING_SYSTEM, systemExtra, user };
}

// ---------------------------------------------------------------------------
// Jahresbericht

export const REPORT_SYSTEM = [
  "You draft the annual report (Jahresbericht for the general assembly, GV) of a Swiss shooting club for its board.",
  "You receive ONLY aggregated figures computed by the club app. Rules:",
  "- Use only the figures provided. Never invent, estimate or round numbers differently, never add events, results or people that are not in the data. Percentages only if given.",
  "- Do not mention any person by name. Winners and honours are added by the app separately; you may refer to them generally (e.g. «die Rangierten werden an der GV geehrt»).",
  "- Omit topics without data (sections that are null or missing). Do not write that data is missing.",
  "- Structure: a short introduction, then one section per topic (members, events, range bookings, federal programmes, annual championship, finances), and a short closing with thanks to members and helpers. Headings short.",
  "- Plain text paragraphs, no markdown, no tables. Money as «CHF 1’234.00». Write as the board («der Vorstand»), warm but matter-of-fact.",
  "- Finances: the app only knows revenue from fees, bookings, ammunition and the kiosk (no expenses). Present them as such, not as the annual accounts.",
  "Return only the JSON object required by the schema.",
  UNTRUSTED_NOTICE,
].join("\n");

export const reportSchema = z.object({
  title: z.string(),
  sections: z.array(z.object({ heading: z.string(), body: z.string() })),
});
export type ReportOutput = z.infer<typeof reportSchema>;

export function buildReportPrompt(input: { locale: Locale; clubName: string; year: number; payload: unknown }): PromptParts {
  const systemExtra = [
    `Year of the report: ${input.year}.`,
    answerLanguageLine(input.locale),
    `Club name: ${input.clubName.replace(/[\r\n]+/g, " ").slice(0, 191)}.`,
  ].join("\n");
  const user = [
    `Draft the annual report ${input.year} from these aggregated figures (JSON).`,
    untrusted("aggregates", JSON.stringify(input.payload, null, 2)),
  ].join("\n\n");
  return { system: REPORT_SYSTEM, systemExtra, user };
}

/** Bericht säubern: leere Abschnitte weg, Längen begrenzen. null = unbrauchbar. */
export function readReport(out: ReportOutput): ReportOutput | null {
  const sections = out.sections
    .map((s) => ({ heading: s.heading.trim().slice(0, 191), body: s.body.replace(/\r\n?/g, "\n").trim().slice(0, 20_000) }))
    .filter((s) => s.heading || s.body)
    .slice(0, 20);
  if (!sections.length) return null;
  return { title: out.title.trim().slice(0, 191), sections };
}
