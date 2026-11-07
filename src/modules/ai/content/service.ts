import "server-only";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { AiError, AiUnavailable, aiAvailability, aiCacheKey, describeAiFailure, getAiCache, runStructured, setAiCache } from "@/lib/ai";
import { getT, getTenantLocale, normalizeLocale, type Locale } from "@/lib/i18n";
import type { Permission } from "@/lib/permissions";
import type { ActiveTenant, AppContext } from "@/lib/tenant";
import { CONTENT_ENTITIES, fieldKeys, targetLocales, type ContentEntityType } from "./entities";
import {
  clipText, contentHash, fieldStatus, groupRowsByEntity, isContentHash, localeStatus, localesToTranslate, normalizeSourceText, pickDisplay,
  type DisplayChoice, type FieldStatus, type LocaleStatus, type TranslationRowLite,
} from "./logic";
import {
  buildDraftPrompt, buildImprovePrompt, buildReportPrompt, buildTranslationPrompt, draftSchema, improveSchema, readReport, readTranslation,
  reportSchema, translationSchema, type EventFacts, type ReportOutput, type WritingKind, type WritingTone,
} from "./prompts";
import { reportPromptPayload, type ReportAggregates } from "./reports/aggregates";

export type TenantCtx = AppContext & { tenant: ActiveTenant };

/** Wer darf Übersetzungen eines Inhalts erstellen und bearbeiten. */
export const CONTENT_PERMISSION: Record<ContentEntityType, Permission> = {
  event: "events.manage",
  announcement: "announcements.manage",
  rangeRules: "range.manage",
};

const CONTENT_MODULE: Record<ContentEntityType, "events" | "range"> = { event: "events", announcement: "events", rangeRules: "range" };

export function canEditContent(ctx: TenantCtx, type: ContentEntityType): boolean {
  return ctx.hasModule(CONTENT_MODULE[type]) && ctx.can(CONTENT_PERMISSION[type]);
}

/** Aktueller Quelltext eines Inhalts des Vereins (null = nicht gefunden). */
export async function loadContentSource(tenantId: string, type: ContentEntityType, id: string): Promise<Record<string, string> | null> {
  if (!id || id.length > 40) return null;
  if (type === "event") {
    const e = await db.event.findFirst({ where: { id, tenantId }, select: { title: true, description: true } });
    return e ? { title: e.title, description: e.description ?? "" } : null;
  }
  if (type === "announcement") {
    const a = await db.announcement.findFirst({ where: { id, tenantId }, select: { title: true, body: true } });
    return a ? { title: a.title, body: a.body } : null;
  }
  const r = await db.rangeRules.findFirst({ where: { id, tenantId }, select: { title: true, body: true } });
  return r ? { title: r.title, body: r.body } : null;
}

async function loadRows(tenantId: string, type: ContentEntityType, ids: readonly string[], locale?: Locale) {
  if (!ids.length) return [];
  return db.contentTranslation.findMany({
    where: { tenantId, entityType: type, entityId: { in: [...ids] }, ...(locale ? { locale } : {}) },
    select: { entityId: true, field: true, locale: true, value: true, sourceHash: true, status: true, updatedAt: true },
  });
}

// ---------------------------------------------------------------------------
// Anzeige für Mitglieder

/**
 * Fassungen für die Anzeige (Liste oder Einzelansicht). Übersetzung nur, wenn für die Sprache des
 * Mitglieds vollständig und aktuell vorhanden – sonst das Original.
 */
export async function displayContent<F extends string>(
  tenantId: string,
  type: ContentEntityType,
  items: ReadonlyArray<{ id: string; sources: Record<F, string | null> }>,
  viewerLocale: Locale,
  opts?: { original?: boolean },
): Promise<Map<string, DisplayChoice<F>>> {
  const out = new Map<string, DisplayChoice<F>>();
  const sourceLocale = await getTenantLocale(tenantId);
  const rows = viewerLocale === sourceLocale || opts?.original || !items.length ? [] : await loadRows(tenantId, type, items.map((i) => i.id), viewerLocale);
  const byId = groupRowsByEntity(rows);
  for (const item of items) {
    out.set(item.id, pickDisplay({ viewerLocale, sourceLocale, sources: item.sources, rows: byId.get(item.id) ?? [], original: opts?.original }));
  }
  return out;
}

/** Gibt es zur Einzelansicht eine aktuelle Übersetzung (auch wenn gerade das Original gezeigt wird)? */
export async function hasFreshTranslation(tenantId: string, type: ContentEntityType, id: string, sources: Record<string, string | null>, viewerLocale: Locale): Promise<boolean> {
  const m = await displayContent(tenantId, type, [{ id, sources }], viewerLocale);
  return m.get(id)?.translated ?? false;
}

// ---------------------------------------------------------------------------
// Editor

export type EditorField = { key: string; multiline: boolean; max: number; source: string; hash: string };
export type EditorLocale = {
  locale: Locale;
  status: LocaleStatus;
  reviewed: boolean;
  fields: Record<string, { value: string; status: FieldStatus }>;
};
export type EditorState = {
  entityType: ContentEntityType;
  entityId: string;
  sourceLocale: Locale;
  fields: EditorField[];
  locales: EditorLocale[];
  /** KI-Übersetzung möglich; sonst i18n-Schlüssel des Grunds */
  ai: { ok: true } | { ok: false; messageKey: string; reason: string };
};

export async function getEditorState(ctx: TenantCtx, type: ContentEntityType, id: string): Promise<EditorState | null> {
  if (!canEditContent(ctx, type)) return null;
  const [sources, sourceLocale, avail] = await Promise.all([
    loadContentSource(ctx.tenant.id, type, id),
    getTenantLocale(ctx.tenant.id),
    aiAvailability(ctx, "contentTranslation"),
  ]);
  if (!sources) return null;
  const rows = await loadRows(ctx.tenant.id, type, [id]);
  const fields: EditorField[] = CONTENT_ENTITIES[type].fields.map((f) => ({ ...f, source: normalizeSourceText(sources[f.key]), hash: contentHash(sources[f.key]) }));
  const locales: EditorLocale[] = targetLocales(sourceLocale).map((locale) => {
    const mine = rows.filter((r) => r.locale === locale);
    return {
      locale,
      status: localeStatus(mine, sources, locale),
      reviewed: mine.length > 0 && mine.every((r) => r.status === "REVIEWED"),
      fields: Object.fromEntries(fields.map((f) => {
        const row = mine.find((r) => r.field === f.key);
        return [f.key, { value: row?.value ?? "", status: fieldStatus(row, sources[f.key]) }];
      })),
    };
  });
  return {
    entityType: type, entityId: id, sourceLocale, fields, locales,
    ai: avail.ok ? { ok: true } : { ok: false, reason: avail.reason, messageKey: `ai.unavailable.${avail.reason}` },
  };
}

// ---------------------------------------------------------------------------
// Übersetzen (Vorschläge – gespeichert wird erst nach Prüfung durch den Admin)

export type TranslationProposal = { locale: Locale; fields: Record<string, string>; hashes: Record<string, string> };
export type TranslateResult = {
  proposals: TranslationProposal[];
  failed: Array<{ locale: Locale; messageKey: string }>;
  /** Sprachen, die schon aktuell waren und übersprungen wurden */
  skipped: Locale[];
};

/** Grobe Obergrenze der Antwortlänge (Token) aus der Textlänge. */
function maxTokensFor(chars: number): number {
  return Math.max(1000, Math.min(16_000, Math.ceil(chars / 2.5) + 800));
}

export async function translateContent(
  ctx: TenantCtx,
  type: ContentEntityType,
  id: string,
  opts?: { locales?: readonly string[]; force?: boolean },
): Promise<TranslateResult> {
  if (!canEditContent(ctx, type)) throw new AiUnavailable("noAccess");
  const sources = await loadContentSource(ctx.tenant.id, type, id);
  if (!sources) throw new AiError("badRequest");
  const avail = await aiAvailability(ctx, "contentTranslation");
  if (!avail.ok) throw new AiUnavailable(avail.reason);

  const sourceLocale = await getTenantLocale(ctx.tenant.id);
  const all = targetLocales(sourceLocale);
  const wanted = opts?.locales?.length ? all.filter((l) => opts.locales!.includes(l)) : all;
  const rows: TranslationRowLite[] = await loadRows(ctx.tenant.id, type, [id]);
  const todo = localesToTranslate(rows, sources, wanted, opts?.force ?? !!opts?.locales?.length);
  const skipped = wanted.filter((l) => !todo.includes(l));
  const requested = fieldKeys(type).filter((k) => normalizeSourceText(sources[k]));
  if (!requested.length) return { proposals: [], failed: [], skipped };

  const fields = Object.fromEntries(requested.map((k) => [k, normalizeSourceText(sources[k])]));
  const hashes = Object.fromEntries(requested.map((k) => [k, contentHash(sources[k])]));
  const chars = Object.values(fields).reduce((a, s) => a + s.length, 0);
  const defs = CONTENT_ENTITIES[type].fields;

  const settled = await Promise.allSettled(
    todo.map(async (locale) => {
      const p = buildTranslationPrompt({ entityType: type, sourceLocale, targetLocale: locale, clubName: ctx.tenant.name, fields });
      const res = await runStructured({
        scope: "tenant", tenantId: ctx.tenant.id, feature: "contentTranslation",
        actor: { id: ctx.user.id, isSuperAdmin: ctx.user.isSuperAdmin, role: ctx.tenant.role },
        system: p.system, systemExtra: p.systemExtra, messages: [{ role: "user", content: p.user }],
        schema: translationSchema, maxTokens: maxTokensFor(chars),
      });
      const out = readTranslation(res.data, requested);
      if (!out) throw new AiError("invalidOutput");
      for (const d of defs) if (out[d.key] !== undefined) out[d.key] = clipText(out[d.key]!, d.max);
      return { locale, fields: out, hashes } satisfies TranslationProposal;
    }),
  );

  const proposals: TranslationProposal[] = [];
  const failed: TranslateResult["failed"] = [];
  settled.forEach((s, i) => {
    if (s.status === "fulfilled") proposals.push(s.value);
    else failed.push({ locale: todo[i]!, messageKey: describeAiFailure(s.reason).messageKey });
  });
  if (proposals.length) {
    await audit({ tenantId: ctx.tenant.id, actorId: ctx.user.id, action: "ai.content.translate", entity: type, entityId: id, detail: proposals.map((p) => p.locale).join(",") });
  }
  return { proposals, failed, skipped };
}

// ---------------------------------------------------------------------------
// Speichern / Entfernen

export type SaveTranslationError = "notFound" | "changed" | "empty" | "invalid";

/**
 * Übersetzung einer Sprache speichern. hashes = Prüfsummen des Quelltexts, auf dem die Übersetzung
 * beruht; weicht der Quelltext inzwischen ab, wird nicht gespeichert («changed»).
 * reviewed: von Hand bearbeitet/geprüft (REVIEWED), sonst unverändert übernommen (AUTO).
 */
export async function saveTranslation(
  ctx: TenantCtx,
  type: ContentEntityType,
  id: string,
  input: { locale: string; values: Record<string, string>; hashes: Record<string, string>; reviewed: boolean },
): Promise<{ ok: true } | { ok: false; error: SaveTranslationError }> {
  if (!canEditContent(ctx, type)) return { ok: false, error: "notFound" };
  const sourceLocale = await getTenantLocale(ctx.tenant.id);
  const locale = normalizeLocale(input.locale);
  if (locale !== input.locale || !targetLocales(sourceLocale).includes(locale)) return { ok: false, error: "invalid" };
  const sources = await loadContentSource(ctx.tenant.id, type, id);
  if (!sources) return { ok: false, error: "notFound" };

  const defs = CONTENT_ENTITIES[type].fields.filter((f) => normalizeSourceText(sources[f.key]));
  const data: Array<{ field: string; value: string; hash: string }> = [];
  for (const d of defs) {
    const value = normalizeSourceText(input.values[d.key]);
    if (!value) return { ok: false, error: "empty" };
    const h = input.hashes[d.key];
    if (!isContentHash(h)) return { ok: false, error: "invalid" };
    if (h !== contentHash(sources[d.key])) return { ok: false, error: "changed" };
    data.push({ field: d.key, value: clipText(value, d.max), hash: h });
  }
  if (!data.length) return { ok: false, error: "empty" };
  const status = input.reviewed ? "REVIEWED" : "AUTO";
  await db.$transaction([
    // Felder, deren Quelle inzwischen leer ist, entfernen
    db.contentTranslation.deleteMany({ where: { tenantId: ctx.tenant.id, entityType: type, entityId: id, locale, field: { notIn: data.map((d) => d.field) } } }),
    ...data.map((d) =>
      db.contentTranslation.upsert({
        where: { entityType_entityId_field_locale: { entityType: type, entityId: id, field: d.field, locale } },
        create: { tenantId: ctx.tenant.id, entityType: type, entityId: id, field: d.field, locale, value: d.value, sourceHash: d.hash, status, updatedById: ctx.user.id },
        update: { value: d.value, sourceHash: d.hash, status, updatedById: ctx.user.id },
      }),
    ),
  ]);
  await audit({ tenantId: ctx.tenant.id, actorId: ctx.user.id, action: "ai.content.translation.save", entity: type, entityId: id, detail: `${locale} ${status}` });
  return { ok: true };
}

export async function removeTranslation(ctx: TenantCtx, type: ContentEntityType, id: string, locale: string): Promise<boolean> {
  if (!canEditContent(ctx, type)) return false;
  const res = await db.contentTranslation.deleteMany({ where: { tenantId: ctx.tenant.id, entityType: type, entityId: id, locale: normalizeLocale(locale) } });
  if (res.count) await audit({ tenantId: ctx.tenant.id, actorId: ctx.user.id, action: "ai.content.translation.delete", entity: type, entityId: id, detail: normalizeLocale(locale) });
  return res.count > 0;
}

/** Übersetzungen eines gelöschten Inhalts entfernen (nie blockierend). */
export async function purgeContentTranslations(tenantId: string, type: ContentEntityType, ids: readonly string[]): Promise<void> {
  if (!ids.length) return;
  try {
    await db.contentTranslation.deleteMany({ where: { tenantId, entityType: type, entityId: { in: [...ids] } } });
  } catch (err) {
    console.error("[ai-content] purge failed", err instanceof Error ? err.message : "unknown");
  }
}

// ---------------------------------------------------------------------------
// Schreibhilfe

export const WRITING_PERMISSION: Record<WritingKind, Permission> = { event: "events.manage", announcement: "announcements.manage" };

function actorOf(ctx: TenantCtx) {
  return { id: ctx.user.id, isSuperAdmin: ctx.user.isSuperAdmin, role: ctx.tenant.role };
}

export async function writingAvailability(ctx: TenantCtx, kind: WritingKind): Promise<{ ok: true } | { ok: false; messageKey: string; reason: string } | null> {
  if (!ctx.can(WRITING_PERMISSION[kind]) || !ctx.hasModule("events") || !ctx.hasModule("ai")) return null;
  const a = await aiAvailability(ctx, "writing");
  if (a.ok) return { ok: true };
  // Funktion im Verein nicht vorgesehen → gar nicht anzeigen
  if (a.reason === "clubOff" || a.reason === "clubsNotAllowed" || a.reason === "featureOff" || a.reason === "noAccess") return null;
  return { ok: false, reason: a.reason, messageKey: `ai.unavailable.${a.reason}` };
}

export async function draftText(ctx: TenantCtx, input: { kind: WritingKind; tone: WritingTone; notes: string; title?: string | null; facts?: EventFacts | null }) {
  if (!ctx.hasModule("events") || !ctx.can(WRITING_PERMISSION[input.kind])) throw new AiUnavailable("noAccess");
  const locale = await getTenantLocale(ctx.tenant.id);
  const p = buildDraftPrompt({ ...input, locale, clubName: ctx.tenant.name });
  const res = await runStructured({
    scope: "tenant", tenantId: ctx.tenant.id, feature: "writing", actor: actorOf(ctx),
    system: p.system, systemExtra: p.systemExtra, messages: [{ role: "user", content: p.user }], schema: draftSchema, maxTokens: 4000,
  });
  const title = res.data.title.replace(/[\r\n]+/g, " ").trim();
  const text = res.data.text.replace(/\r\n?/g, "\n").trim();
  if (!title && !text) throw new AiError("invalidOutput");
  return { title: clipText(title, input.kind === "event" ? 120 : 140), text: clipText(text, 5000) };
}

export async function improveText(ctx: TenantCtx, input: { kind: WritingKind; title: string; text: string }) {
  if (!ctx.hasModule("events") || !ctx.can(WRITING_PERMISSION[input.kind])) throw new AiUnavailable("noAccess");
  const locale = await getTenantLocale(ctx.tenant.id);
  const p = buildImprovePrompt({ ...input, locale, clubName: ctx.tenant.name });
  const res = await runStructured({
    scope: "tenant", tenantId: ctx.tenant.id, feature: "writing", actor: actorOf(ctx),
    system: p.system, systemExtra: p.systemExtra, messages: [{ role: "user", content: p.user }], schema: improveSchema, maxTokens: 6000,
  });
  const title = res.data.title.replace(/[\r\n]+/g, " ").trim() || input.title.trim();
  const text = res.data.text.replace(/\r\n?/g, "\n").trim();
  if (!text && input.text.trim()) throw new AiError("invalidOutput");
  return {
    title: clipText(title, input.kind === "event" ? 120 : 140),
    text: clipText(text, 5000),
    changes: res.data.changes.map((c) => c.trim()).filter(Boolean).slice(0, 5).map((c) => clipText(c, 191)),
  };
}

// ---------------------------------------------------------------------------
// Jahresbericht (Entwurf im KI-Zwischenspeicher, 60 Tage)

const REPORT_TTL_MS = 60 * 86_400_000;

export type ReportDraft = {
  year: number;
  title: string;
  sections: Array<{ heading: string; body: string }>;
  /** Prüfsumme der Kennzahlen, aus denen der Entwurf entstand */
  payloadHash: string;
  generatedAt: string;
  savedAt: string | null;
  model: string | null;
};

function reportKey(tenantId: string, year: number) {
  return aiCacheKey("report", tenantId, year);
}

export function payloadHashOf(a: ReportAggregates): string {
  return contentHash(JSON.stringify(reportPromptPayload(a)));
}

function parseDraft(raw: string | null, year: number): ReportDraft | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<ReportDraft>;
    if (v.year !== year || typeof v.title !== "string" || !Array.isArray(v.sections)) return null;
    const sections = v.sections
      .filter((s): s is { heading: string; body: string } => !!s && typeof s.heading === "string" && typeof s.body === "string")
      .slice(0, 30);
    return {
      year, title: v.title, sections,
      payloadHash: typeof v.payloadHash === "string" ? v.payloadHash : "",
      generatedAt: typeof v.generatedAt === "string" ? v.generatedAt : new Date().toISOString(),
      savedAt: typeof v.savedAt === "string" ? v.savedAt : null,
      model: typeof v.model === "string" ? v.model : null,
    };
  } catch {
    return null;
  }
}

export async function getReportDraft(tenantId: string, year: number): Promise<ReportDraft | null> {
  return parseDraft(await getAiCache("reports", reportKey(tenantId, year)), year);
}

/** Abschnitt «Ehrungen» aus den veröffentlichten Meisterschaften – von der App erstellt, nie von Claude. */
export function honoursSection(a: ReportAggregates, locale: Locale): { heading: string; body: string } | null {
  if (!a.championships?.length) return null;
  const t = getT(locale);
  const blocks = a.championships
    .filter((c) => c.podium.length)
    .map((c) => [c.name, ...c.podium.map((p) => `${p.rank}. ${p.name} (${p.total})`)].join("\n"));
  if (!blocks.length) return null;
  return { heading: t("aicontent.report.honoursHeading"), body: blocks.join("\n\n") };
}

export async function generateReport(ctx: TenantCtx, aggregates: ReportAggregates): Promise<ReportDraft> {
  if (!ctx.can("tenant.manage")) throw new AiUnavailable("noAccess");
  const locale = await getTenantLocale(ctx.tenant.id);
  const payload = reportPromptPayload(aggregates);
  const p = buildReportPrompt({ locale, clubName: ctx.tenant.name, year: aggregates.year, payload });
  const res = await runStructured({
    scope: "tenant", tenantId: ctx.tenant.id, feature: "reports", actor: actorOf(ctx),
    system: p.system, systemExtra: p.systemExtra, messages: [{ role: "user", content: p.user }], schema: reportSchema, maxTokens: 12_000,
  });
  const report: ReportOutput | null = readReport(res.data);
  if (!report) throw new AiError("invalidOutput");
  const honours = honoursSection(aggregates, locale);
  const draft: ReportDraft = {
    year: aggregates.year,
    title: report.title || getT(locale)("aicontent.report.defaultTitle", { year: aggregates.year }),
    sections: honours ? [...report.sections, honours] : report.sections,
    payloadHash: payloadHashOf(aggregates),
    generatedAt: new Date().toISOString(),
    savedAt: null,
    model: res.model,
  };
  await setAiCache({ feature: "reports", cacheKey: reportKey(ctx.tenant.id, aggregates.year), value: JSON.stringify(draft), ttlMs: REPORT_TTL_MS, tenantId: ctx.tenant.id, userId: ctx.user.id });
  await audit({ tenantId: ctx.tenant.id, actorId: ctx.user.id, action: "ai.report.generate", entity: "report", entityId: String(aggregates.year) });
  return draft;
}

export async function saveReportDraft(ctx: TenantCtx, year: number, input: { title: string; sections: Array<{ heading: string; body: string }> }): Promise<ReportDraft | null> {
  if (!ctx.can("tenant.manage")) return null;
  const prev = await getReportDraft(ctx.tenant.id, year);
  const draft: ReportDraft = {
    year,
    title: clipText(input.title.trim(), 191),
    sections: input.sections.slice(0, 30).map((s) => ({ heading: clipText(s.heading.trim(), 191), body: clipText(s.body.replace(/\r\n?/g, "\n").trim(), 20_000) })),
    payloadHash: prev?.payloadHash ?? "",
    generatedAt: prev?.generatedAt ?? new Date().toISOString(),
    savedAt: new Date().toISOString(),
    model: prev?.model ?? null,
  };
  await setAiCache({ feature: "reports", cacheKey: reportKey(ctx.tenant.id, year), value: JSON.stringify(draft), ttlMs: REPORT_TTL_MS, tenantId: ctx.tenant.id, userId: ctx.user.id });
  return draft;
}
