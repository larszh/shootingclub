"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { describeAiFailure } from "@/lib/ai";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { getRequestLocale, getT, type TFunction } from "@/lib/i18n";
import { requireTenant } from "@/lib/tenant";
import { isContentEntityType, type ContentEntityType } from "./entities";
import { isWritingTone, WRITING_KINDS } from "./prompts";
import {
  canEditContent, draftText, generateReport, improveText, removeTranslation, saveReportDraft, saveTranslation, translateContent,
  type ReportDraft, type TranslateResult,
} from "./service";
import { loadReportAggregates } from "./reports/queries";
import { REPORT_MIN_YEAR } from "./reports/aggregates";

async function setup() {
  const [ctx, locale] = await Promise.all([requireTenant(), getRequestLocale()]);
  return { ctx, t: getT(locale) };
}

/** KI-Fehler → Meldung in der Sprache des Benutzers (nie rohe Anbieterdaten). */
function aiFail(t: TFunction, err: unknown): ActionResult<never> {
  const f = describeAiFailure(err);
  if (f.kind === "error" && f.code === "unknown") console.error("[ai-content]", err instanceof Error ? err.name : "unknown");
  const msg = t(f.messageKey);
  return fail(f.kind === "error" && f.retryAfterSec ? `${msg} ${t("aicontent.retryIn", { s: f.retryAfterSec })}` : msg);
}

function revalidateContent(type: ContentEntityType, id: string) {
  if (type === "rangeRules") {
    revalidatePath("/range/rules");
    revalidatePath("/admin/range/rules");
    return;
  }
  revalidatePath("/events");
  if (type === "event") {
    revalidatePath(`/events/${id}`);
    revalidatePath(`/admin/events/${id}/edit`);
  } else {
    revalidatePath(`/admin/events/announcements/${id}`);
  }
}

const idSchema = z.string().min(1).max(40);

// ---------------------------------------------------------------------------
// Übersetzungen

export async function translateContentAction(input: { entityType: string; entityId: string; locales?: string[] }): Promise<ActionResult<TranslateResult>> {
  const { ctx, t } = await setup();
  if (!isContentEntityType(input.entityType) || !idSchema.safeParse(input.entityId).success) return fail(t("aicontent.err.invalid"));
  if (!canEditContent(ctx, input.entityType)) return fail(t("aicontent.err.noPermission"));
  const locales = Array.isArray(input.locales) ? input.locales.filter((l) => typeof l === "string").slice(0, 4) : undefined;
  try {
    const res = await translateContent(ctx, input.entityType, input.entityId, { locales });
    if (!res.proposals.length && res.failed.length) return fail(t(res.failed[0]!.messageKey));
    return ok(res, res.proposals.length ? t("aicontent.tr.proposalsReady") : t("aicontent.tr.allFresh"));
  } catch (err) {
    return aiFail(t, err);
  }
}

const saveSchema = z.object({
  entityType: z.string(),
  entityId: idSchema,
  locale: z.string().min(2).max(5),
  values: z.record(z.string().max(40), z.string().max(60_000)),
  hashes: z.record(z.string().max(40), z.string().max(64)),
  reviewed: z.boolean(),
});

export async function saveTranslationAction(input: z.input<typeof saveSchema>): Promise<ActionResult> {
  const { ctx, t } = await setup();
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success || !isContentEntityType(parsed.data.entityType)) return fail(t("aicontent.err.invalid"));
  const d = parsed.data;
  const type = d.entityType as ContentEntityType;
  const res = await saveTranslation(ctx, type, d.entityId, { locale: d.locale, values: d.values, hashes: d.hashes, reviewed: d.reviewed });
  if (!res.ok) return fail(t(`aicontent.err.${res.error}`));
  revalidateContent(type, d.entityId);
  return ok(undefined, t("aicontent.tr.saved"));
}

export async function removeTranslationAction(input: { entityType: string; entityId: string; locale: string }): Promise<ActionResult> {
  const { ctx, t } = await setup();
  if (!isContentEntityType(input.entityType) || !idSchema.safeParse(input.entityId).success || typeof input.locale !== "string") return fail(t("aicontent.err.invalid"));
  const done = await removeTranslation(ctx, input.entityType, input.entityId, input.locale);
  if (!done) return fail(t("aicontent.err.notFound"));
  revalidateContent(input.entityType, input.entityId);
  return ok(undefined, t("aicontent.tr.removed"));
}

// ---------------------------------------------------------------------------
// Schreibhilfe

const draftInput = z.object({
  kind: z.enum(WRITING_KINDS),
  tone: z.string(),
  notes: z.string().trim().min(3).max(4000),
  title: z.string().max(191).optional(),
  facts: z.object({
    kind: z.string().max(40).optional(),
    date: z.string().max(40).optional(),
    time: z.string().max(40).optional(),
    location: z.string().max(191).optional(),
  }).optional(),
});

export async function draftTextAction(input: z.input<typeof draftInput>): Promise<ActionResult<{ title: string; text: string }>> {
  const { ctx, t } = await setup();
  const parsed = draftInput.safeParse(input);
  if (!parsed.success) return fail(t("aicontent.write.notesMissing"));
  const d = parsed.data;
  if (!isWritingTone(d.tone)) return fail(t("aicontent.err.invalid"));
  try {
    const res = await draftText(ctx, { kind: d.kind, tone: d.tone, notes: d.notes, title: d.title, facts: d.facts });
    return ok(res);
  } catch (err) {
    return aiFail(t, err);
  }
}

const improveInput = z.object({
  kind: z.enum(WRITING_KINDS),
  title: z.string().max(191),
  text: z.string().trim().min(3).max(5000),
});

export async function improveTextAction(input: z.input<typeof improveInput>): Promise<ActionResult<{ title: string; text: string; changes: string[] }>> {
  const { ctx, t } = await setup();
  const parsed = improveInput.safeParse(input);
  if (!parsed.success) return fail(t("aicontent.write.textMissing"));
  try {
    return ok(await improveText(ctx, parsed.data));
  } catch (err) {
    return aiFail(t, err);
  }
}

// ---------------------------------------------------------------------------
// Jahresbericht

function validYear(y: unknown): y is number {
  return typeof y === "number" && Number.isInteger(y) && y >= REPORT_MIN_YEAR && y <= new Date().getUTCFullYear() + 1;
}

export async function generateReportAction(year: number): Promise<ActionResult<ReportDraft>> {
  const { ctx, t } = await setup();
  if (!ctx.can("tenant.manage")) return fail(t("aicontent.err.noPermission"));
  if (!validYear(year)) return fail(t("aicontent.err.invalid"));
  try {
    const aggregates = await loadReportAggregates(ctx, year);
    const draft = await generateReport(ctx, aggregates);
    revalidatePath("/admin/reports");
    return ok(draft, t("aicontent.report.ready"));
  } catch (err) {
    return aiFail(t, err);
  }
}

const reportInput = z.object({
  title: z.string().max(191),
  sections: z.array(z.object({ heading: z.string().max(191), body: z.string().max(20_000) })).max(30),
});

export async function saveReportDraftAction(year: number, input: z.input<typeof reportInput>): Promise<ActionResult<ReportDraft>> {
  const { ctx, t } = await setup();
  if (!ctx.can("tenant.manage")) return fail(t("aicontent.err.noPermission"));
  const parsed = reportInput.safeParse(input);
  if (!validYear(year) || !parsed.success) return fail(t("aicontent.err.invalid"));
  const draft = await saveReportDraft(ctx, year, parsed.data);
  if (!draft) return fail(t("aicontent.err.noPermission"));
  return ok(draft, t("aicontent.report.saved"));
}
