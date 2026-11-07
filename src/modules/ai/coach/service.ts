import "server-only";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { AiError, AiUnavailable, aiAvailability, aiCacheKey, answerLanguageLine, getAiCache, runStructured, setAiCache, type AiUnavailableReason } from "@/lib/ai";
import type { ActiveTenant, AppContext } from "@/lib/tenant";
import { safeJson } from "@/lib/utils";
import { todayZurich, zurichParts } from "@/lib/time";
import { parseStages, programTotals } from "@/modules/scores/types";
import { localizedProgramName } from "@/modules/scores/preset-i18n";
import { buildCoachSummary, summaryFingerprint, COACH_MAX_MATCHES, type CoachMatchInput, type CoachSummary } from "./summary";
import { buildCoachPrompt, coachSchema, normalizeCoachOutput, parseCachedCoach, type CoachResult } from "./prompt";
import { maskSamples, type AssistKind } from "./mask";
import { buildMappingPrompt, mappingSchema, MAPPING_SYSTEM, validateSuggestedMapping, type ValidatedMapping } from "./mapping";

export type TenantCtx = AppContext & { tenant: ActiveTenant };

function actorOf(ctx: TenantCtx) {
  return { id: ctx.user.id, isSuperAdmin: ctx.user.isSuperAdmin, role: ctx.tenant.role };
}

/** Anzeige-Zustand einer KI-Funktion: null = gar nicht anzeigen. */
export type AssistState = { ok: true } | { ok: false; messageKey: string } | null;

/** Gründe, bei denen die Funktion im Verein schlicht nicht vorgesehen ist → nicht anzeigen. */
const HIDDEN: ReadonlySet<AiUnavailableReason> = new Set(["clubOff", "clubsNotAllowed", "featureOff", "noAccess", "platformOff"]);
/** Gründe, die nur der Vorstand beheben kann → nur ihm einen Hinweis zeigen. */
const SETUP: ReadonlySet<AiUnavailableReason> = new Set(["noKey", "noConsent"]);

/** Berechtigung und Vereins-Einstellungen prüfen, bevor Daten geladen werden. Wirft AiUnavailable. */
async function assertAvailable(ctx: TenantCtx, feature: "coach" | "importHelper") {
  if (!ctx.can("ai.use")) throw new AiUnavailable("noAccess");
  const a = await aiAvailability(ctx, feature);
  if (!a.ok) throw new AiUnavailable(a.reason);
}

async function stateFor(ctx: TenantCtx, feature: "coach" | "importHelper"): Promise<AssistState> {
  if (!ctx.can("ai.use")) return null;
  const a = await aiAvailability(ctx, feature);
  if (a.ok) return { ok: true };
  if (HIDDEN.has(a.reason)) return null;
  if (SETUP.has(a.reason) && !ctx.can("ai.manage")) return null;
  return { ok: false, messageKey: `ai.unavailable.${a.reason}` };
}

// ---------------------------------------------------------------------------
// Schützen-Coach

const COACH_TTL_MS = 36 * 60 * 60_000;

/** Eigene Durchgänge im aktiven Verein (nur Daten, die das Mitglied ohnehin sieht). */
export async function loadCoachMatches(ctx: TenantCtx, locale: string): Promise<CoachMatchInput[]> {
  const parts = await db.matchParticipant.findMany({
    where: { userId: ctx.user.id, match: { tenantId: ctx.tenant.id }, results: { some: {} } },
    select: {
      results: { select: { stageIndex: true, shotsJson: true, total: true } },
      match: { select: { date: true, status: true, program: { select: { id: true, name: true, stagesJson: true, scoringMode: true, tenantId: true } } } },
    },
    orderBy: [{ match: { date: "desc" } }, { match: { createdAt: "desc" } }],
    // Unvollständige Durchgänge fallen weg – darum mehr laden als ausgewertet werden
    take: COACH_MAX_MATCHES * 4,
  });
  return parts.map((p) => {
    const prog = p.match.program;
    const stages = parseStages(prog.stagesJson);
    return {
      date: zurichParts(p.match.date).dateStr,
      programId: prog.id,
      programName: prog.tenantId ? prog.name : localizedProgramName(prog.name, locale),
      scoringMode: prog.scoringMode,
      max: programTotals(stages, prog.scoringMode).max,
      stages: stages.map((s) => ({ name: s.name, distanceM: s.distanceM, shots: s.shots, maxPerShot: s.maxPerShot })),
      results: p.results.map((r) => ({ stageIndex: r.stageIndex, shots: safeJson<number[]>(r.shotsJson, []).filter((v) => typeof v === "number" && Number.isFinite(v)), total: r.total })),
      complete: p.match.status === "FINISHED" || (stages.length > 0 && p.results.length >= stages.length),
    };
  });
}

function coachKey(ctx: TenantCtx, day: string, locale: string) {
  return aiCacheKey("coach", ctx.tenant.id, ctx.user.id, day, locale);
}

export type CoachCard = {
  state: Exclude<AssistState, null>;
  /** Auswertung von heute (falls vorhanden) */
  cached: CoachResult | null;
  /** Seit der gespeicherten Auswertung sind neue Resultate dazugekommen */
  stale: boolean;
  matchCount: number;
};

/** Daten für die Karte auf /scores/stats. null = nicht anzeigen. */
export async function getCoachCard(ctx: TenantCtx, locale: string): Promise<CoachCard | null> {
  const state = await stateFor(ctx, "coach");
  if (!state) return null;
  const summary = buildCoachSummary(await loadCoachMatches(ctx, locale));
  const cached = state.ok ? parseCachedCoach(await getAiCache("coach", coachKey(ctx, todayZurich(), locale))) : null;
  return {
    state,
    cached: cached?.result ?? null,
    stale: !!cached && cached.fingerprint !== summaryFingerprint(summary),
    matchCount: summary.matchCount,
  };
}

export class CoachNoData extends Error {
  constructor() {
    super("coach: no data");
    this.name = "CoachNoData";
  }
}

/**
 * Auswertung erstellen. Pro Mitglied und Tag wird das Ergebnis gespeichert; ein neuer Aufruf
 * erfolgt nur, wenn seither neue Resultate dazugekommen sind. Wirft AiUnavailable/AiError/CoachNoData.
 */
export async function runCoach(ctx: TenantCtx, locale: string): Promise<CoachResult> {
  await assertAvailable(ctx, "coach");
  const summary: CoachSummary = buildCoachSummary(await loadCoachMatches(ctx, locale));
  if (summary.matchCount === 0) throw new CoachNoData();
  const day = todayZurich();
  const key = coachKey(ctx, day, locale);
  const fingerprint = summaryFingerprint(summary);
  const cached = parseCachedCoach(await getAiCache("coach", key));
  if (cached && cached.fingerprint === fingerprint) return cached.result;

  const p = buildCoachPrompt(summary, { locale, today: day });
  const res = await runStructured({
    scope: "tenant", tenantId: ctx.tenant.id, feature: "coach", actor: actorOf(ctx),
    system: p.system, systemExtra: p.systemExtra, messages: [{ role: "user", content: p.user }],
    schema: coachSchema, maxTokens: 4000,
  });
  const result = normalizeCoachOutput(res.data, { day, matchCount: summary.matchCount });
  if (!result) throw new AiError("invalidOutput");
  await setAiCache({ feature: "coach", cacheKey: key, value: JSON.stringify({ fingerprint, result }), ttlMs: COACH_TTL_MS, tenantId: ctx.tenant.id, userId: ctx.user.id });
  return result;
}

// ---------------------------------------------------------------------------
// Import-Helfer (Spaltenzuordnung)

export async function getImportAssistState(ctx: TenantCtx): Promise<AssistState> {
  return stateFor(ctx, "importHelper");
}

/**
 * Spaltenzuordnung vorschlagen. Die Berechtigung für den jeweiligen Import prüft der Aufrufer.
 * Gesendet werden nur Spaltennamen und höchstens drei maskierte Beispielzeilen (maskSamples).
 */
export async function suggestImportMapping(ctx: TenantCtx, input: { kind: AssistKind; headers: string[]; rows: string[][]; locale: string }): Promise<ValidatedMapping> {
  if (!input.headers.length) throw new AiError("badRequest");
  await assertAvailable(ctx, "importHelper");
  const masked = maskSamples(input.headers, input.rows, input.kind);
  const res = await runStructured({
    scope: "tenant", tenantId: ctx.tenant.id, feature: "importHelper", actor: actorOf(ctx),
    system: MAPPING_SYSTEM,
    systemExtra: `${answerLanguageLine(input.locale)} This applies to the field "note".`,
    messages: [{ role: "user", content: buildMappingPrompt(input.kind, masked) }],
    schema: mappingSchema(input.kind), maxTokens: 6000,
  });
  const out = validateSuggestedMapping(input.kind, res.data, masked.headers.length);
  await audit({
    tenantId: ctx.tenant.id, actorId: ctx.user.id, action: "ai.import.mapping", entity: input.kind === "scores" ? "ScoreImport" : "MemberImport",
    detail: `${masked.headers.length} columns, ${out.mapping.filter((f) => f !== "ignore").length} assigned`,
  });
  return out;
}
