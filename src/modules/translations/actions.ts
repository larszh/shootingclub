"use server";

import { z } from "zod";
import { requireSuperAdmin } from "@/lib/tenant";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { audit } from "@/lib/audit";
import { getRequestLocale, getT, isLocale, type Locale } from "@/lib/i18n";
import { describeAiFailure } from "@/lib/ai";
import { dictionaryKeySet } from "./context";
import { AI_CHUNK_SIZE, MAX_ENTRIES_PER_SAVE, MAX_KEY_LENGTH, MAX_VALUE_LENGTH, validateEntries } from "./logic";
import { applyChanges, removeOrphans, serverDictionaryContext, translateChunk } from "./server";
import { entryErrorMessage, translationsT } from "./texts";

const localeSchema = z.string().refine((v): v is Locale => isLocale(v));
const keySchema = z.string().min(1).max(MAX_KEY_LENGTH);
const valueSchema = z.string().max(MAX_VALUE_LENGTH + 200);

async function texts() {
  const locale = await getRequestLocale();
  return { locale, t: translationsT(locale) };
}

/** Eine Zelle speichern. Leer oder gleich wie der Standard → Übersteuerung entfernen. */
export async function saveTranslationAction(input: { locale: string; key: string; value: string }): Promise<ActionResult<{ op: "set" | "reset" | "none" }>> {
  const user = await requireSuperAdmin();
  const { t } = await texts();
  const parsed = z.object({ locale: localeSchema, key: keySchema, value: valueSchema }).safeParse(input);
  if (!parsed.success) return fail(t("err.invalidInput"));
  const { locale, key, value } = parsed.data as { locale: Locale; key: string; value: string };
  const ctx = await serverDictionaryContext();
  const res = validateEntries(ctx, locale, [{ key, value }]);
  if (res.errors.length) return fail(entryErrorMessage(t, res.errors[0]!));
  const change = res.changes[0];
  if (!change) return ok({ op: "none" }, t("msg.unchanged"));
  await applyChanges(locale, [change], user.id);
  await audit({
    actorId: user.id, actorName: user.name,
    action: change.op === "set" ? "translations.override.save" : "translations.override.reset",
    entity: "TranslationOverride", entityId: `${locale}:${key}`.slice(0, 191), detail: `${locale} ${key}`,
  });
  return ok({ op: change.op }, change.op === "set" ? t("msg.saved") : t("msg.reset"));
}

/**
 * Mehrere Einträge einer Sprache speichern (übernommene Claude-Vorschläge oder Import).
 * Beim Import werden leere Werte übersprungen; ungültige Einträge verhindern das Speichern nicht,
 * werden aber gemeldet.
 */
export async function saveTranslationsAction(input: {
  locale: string;
  entries: Array<{ key: string; value: unknown }>;
  source: "ai" | "import";
}): Promise<ActionResult<{ set: number; reset: number; invalid: number }>> {
  const user = await requireSuperAdmin();
  const { t } = await texts();
  const parsed = z
    .object({
      locale: localeSchema,
      source: z.enum(["ai", "import"]),
      entries: z.array(z.object({ key: z.string().max(400), value: z.unknown() })).max(MAX_ENTRIES_PER_SAVE),
    })
    .safeParse(input);
  if (!parsed.success) return fail(t("err.invalidInput"));
  const locale = parsed.data.locale as Locale;
  const ctx = await serverDictionaryContext();
  const res = validateEntries(ctx, locale, parsed.data.entries, { skipEmpty: parsed.data.source === "import" });
  if (!res.changes.length) {
    return res.errors.length ? fail(t("msg.nothingValid", { n: res.errors.length })) : ok({ set: 0, reset: 0, invalid: 0 }, t("msg.unchanged"));
  }
  const done = await applyChanges(locale, res.changes, user.id);
  await audit({
    actorId: user.id, actorName: user.name,
    action: parsed.data.source === "ai" ? "translations.ai.apply" : "translations.import",
    entity: "TranslationOverride", entityId: locale,
    detail: `${locale}: ${done.set} gespeichert, ${done.reset} zurückgesetzt, ${res.errors.length} ungültig`,
  });
  return ok(
    { ...done, invalid: res.errors.length },
    t("msg.bulkSaved", { set: done.set, reset: done.reset }) + (res.errors.length ? " " + t("msg.bulkInvalid", { n: res.errors.length }) : ""),
  );
}

export type TranslateChunkData = {
  suggestions: Array<{ key: string; text: string }>;
  rejected: number;
  missing: string[];
  model: string | null;
};

/** Ein Paket (höchstens AI_CHUNK_SIZE Schlüssel) mit Claude übersetzen – nur Vorschläge, nichts gespeichert. */
export async function translateChunkAction(input: { locale: string; keys: string[] }): Promise<ActionResult<TranslateChunkData>> {
  const user = await requireSuperAdmin();
  const { locale: uiLocale, t } = await texts();
  const parsed = z.object({ locale: localeSchema, keys: z.array(keySchema).min(1).max(AI_CHUNK_SIZE) }).safeParse(input);
  if (!parsed.success) return fail(t("err.invalidInput"));
  const locale = parsed.data.locale as Locale;
  if (locale === "de") return fail(t("err.targetGerman"));
  const known = dictionaryKeySet();
  const keys = [...new Set(parsed.data.keys)].filter((k) => known.has(k));
  if (!keys.length) return fail(t("err.unknownKey"));
  try {
    const res = await translateChunk({ locale, keys, actor: { id: user.id, isSuperAdmin: user.isSuperAdmin, role: null } });
    await audit({
      actorId: user.id, actorName: user.name, action: "translations.ai.suggest", entity: "TranslationOverride", entityId: locale,
      detail: `${locale}: ${keys.length} Schlüssel, ${res.accepted.length} Vorschläge${res.model ? ` (${res.model})` : ""}`,
    });
    return ok({ suggestions: res.accepted, rejected: res.rejected.length, missing: res.missing, model: res.model });
  } catch (err) {
    const f = describeAiFailure(err);
    const general = getT(uiLocale)(f.messageKey);
    if (general !== f.messageKey) return fail(general);
    return fail(f.kind === "unavailable" ? t("ai.unavailable") : f.kind === "error" && f.code === "rateLimited" ? t("ai.rateLimited") : t("ai.failed"));
  }
}

/** Übersteuerungen von Schlüsseln entfernen, die es nicht mehr gibt. */
export async function removeOrphansAction(): Promise<ActionResult<{ removed: number }>> {
  const user = await requireSuperAdmin();
  const { t } = await texts();
  const removed = await removeOrphans(dictionaryKeySet());
  if (removed) await audit({ actorId: user.id, actorName: user.name, action: "translations.orphans.remove", entity: "TranslationOverride", detail: `${removed} entfernt` });
  return ok({ removed }, t("msg.orphansRemoved", { n: removed }));
}

