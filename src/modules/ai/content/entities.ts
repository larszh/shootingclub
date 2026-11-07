/**
 * Übersetzbare Inhalte (ContentTranslation.entityType) und ihre Felder. Ohne Server-Abhängigkeiten.
 */
import { LOCALES, type Locale } from "@/lib/i18n/core";

export const CONTENT_ENTITY_TYPES = ["event", "announcement", "rangeRules"] as const;
export type ContentEntityType = (typeof CONTENT_ENTITY_TYPES)[number];

export type ContentFieldDef = {
  key: string;
  /** mehrzeilig (Textarea im Editor) */
  multiline: boolean;
  /** maximale Länge der gespeicherten Übersetzung */
  max: number;
};

export type ContentEntityDef = {
  fields: readonly ContentFieldDef[];
  /** Format des Texts für den Prompt */
  format: "plain" | "rules";
};

export const CONTENT_ENTITIES: Record<ContentEntityType, ContentEntityDef> = {
  event: {
    fields: [{ key: "title", multiline: false, max: 191 }, { key: "description", multiline: true, max: 10_000 }],
    format: "plain",
  },
  announcement: {
    fields: [{ key: "title", multiline: false, max: 191 }, { key: "body", multiline: true, max: 10_000 }],
    format: "plain",
  },
  rangeRules: {
    fields: [{ key: "title", multiline: false, max: 191 }, { key: "body", multiline: true, max: 60_000 }],
    format: "rules",
  },
};

export function isContentEntityType(v: unknown): v is ContentEntityType {
  return typeof v === "string" && (CONTENT_ENTITY_TYPES as readonly string[]).includes(v);
}

export function fieldKeys(type: ContentEntityType): string[] {
  return CONTENT_ENTITIES[type].fields.map((f) => f.key);
}

/** Zielsprachen: alle App-Sprachen ausser der Quellsprache (Vereinssprache). */
export function targetLocales(source: Locale): Locale[] {
  return LOCALES.filter((l) => l !== source);
}

/** Kurzbezeichnung der Zielsprachen für den Knopf, z.B. «FR/IT/EN». */
export function targetsLabel(source: Locale): string {
  return targetLocales(source).map((l) => l.toUpperCase()).join("/");
}
