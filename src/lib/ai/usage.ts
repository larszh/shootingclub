import "server-only";
import { db } from "@/lib/db";
import { startOfMonthZurich } from "./month";
import type { AiErrorCode } from "./types";
import { budgetTokens } from "@/modules/ai/usage/logic";

export type AiTokenUsage = { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number };

export const ZERO_USAGE: AiTokenUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };

/** usage-Objekt einer Claude-Antwort → unsere Zählung (fehlende Felder = 0). */
export function usageFrom(u: { input_tokens?: number | null; output_tokens?: number | null; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null } | null | undefined): AiTokenUsage {
  return {
    inputTokens: u?.input_tokens ?? 0,
    outputTokens: u?.output_tokens ?? 0,
    cacheReadTokens: u?.cache_read_input_tokens ?? 0,
    cacheWriteTokens: u?.cache_creation_input_tokens ?? 0,
  };
}

/**
 * Rohe Summe aller Token-Arten (nur Anzeige). Gegen das Monatslimit zählen gewichtete
 * Budget-Tokens (`budgetTokens`, siehe monthTokensUsed).
 */
export function totalTokens(u: AiTokenUsage): number {
  return u.inputTokens + u.outputTokens + u.cacheReadTokens + u.cacheWriteTokens;
}

/** Verbrauchte Budget-Tokens im laufenden Monat (Schweizer Zeit) für Plattform bzw. Verein. */
export async function monthTokensUsed(ref: { scope: "platform" } | { scope: "tenant"; tenantId: string }, now: Date = new Date()): Promise<number> {
  const since = startOfMonthZurich(now);
  const where = ref.scope === "platform"
    ? { scope: "PLATFORM", createdAt: { gte: since } }
    : { scope: "TENANT", tenantId: ref.tenantId, createdAt: { gte: since } };
  // Gewichtet nach Preis (Ausgabe, Cache-Lesen, Cache-Schreiben), damit ein CHF-Budget beim
  // geschätzten Verbrauch sperrt und nicht schon bei einem Bruchteil davon.
  const rows = await db.aiUsage.groupBy({
    by: ["model"],
    where,
    _sum: { inputTokens: true, outputTokens: true, cacheReadTokens: true, cacheWriteTokens: true },
  });
  let total = 0;
  for (const r of rows) {
    total += budgetTokens({
      inputTokens: r._sum.inputTokens ?? 0,
      outputTokens: r._sum.outputTokens ?? 0,
      cacheReadTokens: r._sum.cacheReadTokens ?? 0,
      cacheWriteTokens: r._sum.cacheWriteTokens ?? 0,
    }, r.model);
  }
  return total;
}

export type LogUsageInput = {
  scope: "platform" | "tenant";
  tenantId?: string | null;
  userId?: string | null;
  feature: string;
  model: string;
  usage: AiTokenUsage;
  ok: boolean;
  errorCode?: AiErrorCode | null;
};

/** Schreibt einen Verbrauchseintrag. Wirft nie (Protokollierung darf die Antwort nicht verhindern). */
export async function logAiUsage(input: LogUsageInput): Promise<void> {
  try {
    await db.aiUsage.create({
      data: {
        scope: input.scope === "platform" ? "PLATFORM" : "TENANT",
        tenantId: input.scope === "tenant" ? (input.tenantId ?? null) : null,
        userId: input.userId ?? null,
        feature: input.feature.slice(0, 191),
        model: input.model.slice(0, 191),
        inputTokens: input.usage.inputTokens,
        outputTokens: input.usage.outputTokens,
        cacheReadTokens: input.usage.cacheReadTokens,
        cacheWriteTokens: input.usage.cacheWriteTokens,
        ok: input.ok,
        errorCode: input.errorCode ?? null,
      },
    });
  } catch (err) {
    console.error("[ai] Verbrauch nicht gespeichert:", err instanceof Error ? err.message : err);
  }
}

export type AiUsageSummary = { requests: number; failed: number; tokens: number; byFeature: Record<string, { requests: number; tokens: number }> };

/** Übersicht für Einstellungsseiten: Monatsverbrauch nach Funktion. */
export async function usageSummary(ref: { scope: "platform" } | { scope: "tenant"; tenantId: string }, now: Date = new Date()): Promise<AiUsageSummary> {
  const since = startOfMonthZurich(now);
  const where = ref.scope === "platform"
    ? { scope: "PLATFORM", createdAt: { gte: since } }
    : { scope: "TENANT", tenantId: ref.tenantId, createdAt: { gte: since } };
  const rows = await db.aiUsage.groupBy({
    by: ["feature", "ok"],
    where,
    _count: { _all: true },
    _sum: { inputTokens: true, outputTokens: true, cacheReadTokens: true, cacheWriteTokens: true },
  });
  const out: AiUsageSummary = { requests: 0, failed: 0, tokens: 0, byFeature: {} };
  for (const r of rows) {
    const n = r._count._all;
    const tok = (r._sum.inputTokens ?? 0) + (r._sum.outputTokens ?? 0) + (r._sum.cacheReadTokens ?? 0) + (r._sum.cacheWriteTokens ?? 0);
    out.requests += n;
    if (!r.ok) out.failed += n;
    out.tokens += tok;
    const f = (out.byFeature[r.feature] ??= { requests: 0, tokens: 0 });
    f.requests += n;
    f.tokens += tok;
  }
  return out;
}
