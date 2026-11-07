"use server";

import { z } from "zod";
import { describeAiFailure } from "@/lib/ai";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { getRequestLocale, getT, type TFunction } from "@/lib/i18n";
import { requireTenant } from "@/lib/tenant";
import { ASSIST_MAX_COLUMNS, ASSIST_SAMPLE_ROWS, type AssistKind } from "./mask";
import type { CoachResult } from "./prompt";
import type { ValidatedMapping } from "./mapping";
import { CoachNoData, getImportAssistState, runCoach, suggestImportMapping, type AssistState, type TenantCtx } from "./service";

async function setup() {
  const [ctx, locale] = await Promise.all([requireTenant(), getRequestLocale()]);
  return { ctx, locale, t: getT(locale) };
}

/**
 * KI-Fehler → Meldung in der Sprache des Benutzers (nie rohe Anbieterdaten). Wer die
 * KI-Einstellungen nicht verwalten kann (Mitglieder), bekommt bei einem ungültigen Schlüssel den
 * Hinweis, den Vorstand zu informieren, statt des technischen Textes.
 */
function aiFail(t: TFunction, err: unknown, ctx: TenantCtx): ActionResult<never> {
  const f = describeAiFailure(err);
  if (f.kind === "error" && f.code === "unknown") console.error("[ai-coach]", err instanceof Error ? err.name : "unknown");
  const msg = t(f.kind === "error" && f.code === "invalidKey" && !ctx.can("ai.manage") ? "aihelp.error.invalidKey" : f.messageKey);
  return fail(f.kind === "error" && f.retryAfterSec ? `${msg} ${t("aicoach.retryIn", { s: f.retryAfterSec })}` : msg);
}

/** Auswertung der eigenen Resultate (Schützen-Coach). */
export async function runCoachAction(): Promise<ActionResult<CoachResult>> {
  const { ctx, locale, t } = await setup();
  if (!ctx.hasModule("scores")) return fail(t("aicoach.err.noPermission"));
  try {
    return ok(await runCoach(ctx, locale));
  } catch (err) {
    if (err instanceof CoachNoData) return fail(t("aicoach.coach.noData"));
    return aiFail(t, err, ctx);
  }
}

/** Darf der Benutzer diesen Import überhaupt durchführen? (gleiche Regeln wie der Import selbst) */
function canImport(ctx: TenantCtx, kind: AssistKind): boolean {
  if (kind === "members") return ctx.can("members.manage");
  return ctx.hasModule("scores") && (ctx.can("match.viewAll") || ctx.can("tenant.programs.manage"));
}

const kindSchema = z.enum(["scores", "members"]);

/** Zustand des Import-Helfers (für Assistenten, die ihn selbst einblenden). null = nicht anzeigen. */
export async function importAssistStateAction(kind: string): Promise<ActionResult<AssistState>> {
  const { ctx, t } = await setup();
  const k = kindSchema.safeParse(kind);
  if (!k.success) return fail(t("aicoach.err.invalid"));
  if (!canImport(ctx, k.data)) return ok(null);
  return ok(await getImportAssistState(ctx));
}

const mappingInput = z.object({
  kind: kindSchema,
  headers: z.array(z.string().max(200)).min(1).max(ASSIST_MAX_COLUMNS),
  rows: z.array(z.array(z.string().max(500)).max(ASSIST_MAX_COLUMNS)).max(ASSIST_SAMPLE_ROWS),
});

/**
 * Spaltenzuordnung mit Claude vorschlagen. Der Browser schickt nur Spaltennamen und drei
 * Beispielzeilen; maskiert wird hier auf dem Server, bevor etwas an Claude geht.
 */
export async function suggestImportMappingAction(input: z.input<typeof mappingInput>): Promise<ActionResult<ValidatedMapping>> {
  const { ctx, locale, t } = await setup();
  const parsed = mappingInput.safeParse(input);
  if (!parsed.success) return fail(t("aicoach.err.invalid"));
  if (!canImport(ctx, parsed.data.kind)) return fail(t("aicoach.err.noPermission"));
  try {
    const res = await suggestImportMapping(ctx, { ...parsed.data, locale });
    if (!res.mapping.some((f) => f !== "ignore")) return fail(t("aicoach.map.nothing"));
    return ok(res);
  } catch (err) {
    return aiFail(t, err, ctx);
  }
}
