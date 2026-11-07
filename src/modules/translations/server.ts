import "server-only";
import * as z from "zod/v4";
import { db } from "@/lib/db";
import { ensureOverridesLoaded, reloadOverrides } from "@/lib/i18n/overrides";
import { baseText, getOverrides, isLocale, type Dict, type Locale, type OverrideMap } from "@/lib/i18n/core";
import { AiError, runStructured, untrusted, type AiActor } from "@/lib/ai";
import { dictionaryContext, referenceText } from "./context";
import { filterSuggestions, type AiSuggestion, type PlannedChange } from "./logic";
import { TRANSLATION_SYSTEM, targetLanguageLine, translationUserMessage, type TranslationItem } from "./prompt";

export const OVERRIDE_SCOPE = "global";

/** Übersteuerungen direkt aus der Datenbank (massgeblich beim Prüfen/Speichern). */
export async function loadOverrideMapFromDb(): Promise<OverrideMap> {
  const rows = await db.translationOverride.findMany({ where: { scope: OVERRIDE_SCOPE }, select: { locale: true, key: true, value: true } });
  const map: Partial<Record<Locale, Dict>> = {};
  for (const r of rows) {
    if (!isLocale(r.locale) || !r.value) continue;
    (map[r.locale] ??= {})[r.key] = r.value;
  }
  return map;
}

/** Prüfkontext mit den aktuellen Übersteuerungen aus der Datenbank. */
export async function serverDictionaryContext() {
  return dictionaryContext(await loadOverrideMapFromDb());
}

/**
 * Schreibt geplante Änderungen (set = upsert, reset = löschen) in einer Transaktion und lädt
 * danach die Registry neu, damit die Texte sofort in der ganzen App gelten.
 */
export async function applyChanges(locale: Locale, changes: readonly PlannedChange[], userId: string): Promise<{ set: number; reset: number }> {
  const sets = changes.filter((c) => c.op === "set");
  const resets = changes.filter((c) => c.op === "reset").map((c) => c.key);
  const ops = [];
  if (resets.length) ops.push(db.translationOverride.deleteMany({ where: { scope: OVERRIDE_SCOPE, locale, key: { in: resets } } }));
  for (const c of sets) {
    ops.push(
      db.translationOverride.upsert({
        where: { scope_locale_key: { scope: OVERRIDE_SCOPE, locale, key: c.key } },
        create: { scope: OVERRIDE_SCOPE, locale, key: c.key, value: c.after, updatedById: userId },
        update: { value: c.after, updatedById: userId },
      }),
    );
  }
  // In Paketen, damit sehr grosse Importe keine überlange Transaktion erzeugen.
  for (let i = 0; i < ops.length; i += 500) await db.$transaction(ops.slice(i, i + 500));
  await reloadOverrides();
  return { set: sets.length, reset: resets.length };
}

/** Entfernt Übersteuerungen von Schlüsseln, die es in keinem Wörterbuch mehr gibt. */
export async function removeOrphans(keys: ReadonlySet<string>): Promise<number> {
  const rows = await db.translationOverride.findMany({ where: { scope: OVERRIDE_SCOPE }, select: { id: true, key: true, locale: true } });
  const ids = rows.filter((r) => !keys.has(r.key) || !isLocale(r.locale)).map((r) => r.id);
  for (let i = 0; i < ids.length; i += 500) await db.translationOverride.deleteMany({ where: { id: { in: ids.slice(i, i + 500) } } });
  if (ids.length) await reloadOverrides();
  return ids.length;
}

// ---------------------------------------------------------------------------
// Claude

export const SuggestionSchema = z.object({
  items: z.array(z.object({ key: z.string(), text: z.string() })),
});

/** Wirksamer Text (Übersteuerung → mitgeliefert) aus der Registry. */
function effective(locale: Locale, key: string): string | undefined {
  return getOverrides()[locale]?.[key] ?? baseText(locale, key);
}

/**
 * Übersetzt ein Paket Schlüssel (höchstens AI_CHUNK_SIZE) mit dem Plattform-Schlüssel.
 * Wirft AiUnavailable/AiError. Liefert nur Vorschläge mit korrekten Platzhaltern.
 */
type ChunkOpts = { locale: Exclude<Locale, "de">; keys: readonly string[]; actor: AiActor & { id: string }; signal?: AbortSignal };
type ChunkResult = { accepted: AiSuggestion[]; rejected: { key: string; reason: string }[]; missing: string[]; model: string | null };

/**
 * Wie translateChunkOnce, teilt aber ein Paket bei unbrauchbarer/abgeschnittener Antwort
 * (AiError "invalidOutput") einmal in zwei Hälften und versucht es erneut.
 */
export async function translateChunk(opts: ChunkOpts, splitsLeft = 1): Promise<ChunkResult> {
  try {
    return await translateChunkOnce(opts);
  } catch (err) {
    if (!(err instanceof AiError) || err.code !== "invalidOutput" || splitsLeft <= 0 || opts.keys.length < 2) throw err;
    const mid = Math.ceil(opts.keys.length / 2);
    const a = await translateChunk({ ...opts, keys: opts.keys.slice(0, mid) }, splitsLeft - 1);
    const b = await translateChunk({ ...opts, keys: opts.keys.slice(mid) }, splitsLeft - 1);
    return { accepted: [...a.accepted, ...b.accepted], rejected: [...a.rejected, ...b.rejected], missing: [...a.missing, ...b.missing], model: b.model ?? a.model };
  }
}

async function translateChunkOnce(opts: ChunkOpts): Promise<ChunkResult> {
  await ensureOverridesLoaded();
  const items: TranslationItem[] = [];
  for (const key of opts.keys) {
    const source = effective("de", key);
    if (!source) continue;
    const own = getOverrides()[opts.locale]?.[key] ?? baseText(opts.locale, key);
    const current = own && own !== source ? own : undefined;
    const en = opts.locale !== "en" ? effective("en", key) : undefined;
    items.push({ key, source, current, english: en && en !== source ? en : undefined });
  }
  if (!items.length) return { accepted: [], rejected: [], missing: [...opts.keys], model: null };
  const res = await runStructured({
    scope: "platform",
    feature: "translations",
    actor: opts.actor,
    userId: opts.actor.id,
    system: TRANSLATION_SYSTEM,
    systemExtra: targetLanguageLine(opts.locale),
    messages: [{ role: "user", content: translationUserMessage(items, untrusted) }],
    schema: SuggestionSchema,
    maxTokens: 16_000,
    signal: opts.signal,
  });
  const requested = items.map((i) => i.key);
  const out = filterSuggestions(requested, res.data.items, (k) => referenceText(opts.locale, k));
  const skipped = opts.keys.filter((k) => !requested.includes(k));
  return { ...out, missing: [...out.missing, ...skipped], model: res.model };
}
