import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type * as z from "zod/v4";
import { getAiClient, type AiScopeRef } from "./client";
import type { AiActor } from "./availability";
import { AiError, AiUnavailable, toAiError } from "./errors";
import { createRateLimiter, type RateLimiter } from "./rate-limit";
import { logAiUsage, usageFrom, ZERO_USAGE, type AiTokenUsage } from "./usage";
import { AI_STREAM_ERROR_MARK, DEFAULT_EFFORT, type AiEffort, type AiFeature, type AiModel } from "./types";

/** Beta für serverseitigen Rückfall bei Ablehnung (fallbacks: "default"). */
export const AI_BETAS = ["server-side-fallback-2026-07-01"] as const;
/** Beta-Header, den das SDK für strukturierte Ausgaben setzt (wie messages.parse). */
const STRUCTURED_OUTPUTS_BETA = "structured-outputs-2025-12-15";

export type AiMessage = { role: "user" | "assistant"; content: string };

export type AiRunOptions = AiScopeRef & {
  feature: AiFeature;
  /** Für Verbrauch und Rate-Limit (Standard: actor.id) */
  userId?: string | null;
  /** Wenn gesetzt, werden Rolle/memberAccess geprüft. Ohne actor prüft der Aufrufer selbst. */
  actor?: AiActor | null;
  /** Stabiler System-Prompt (wird gecacht – keine Zeitstempel, keine Benutzerdaten). */
  system: string;
  /** Volatiler Zusatz nach dem gecachten Teil (z.B. Sprache, Datum, Vereinsname). */
  systemExtra?: string;
  /** Verlauf; die letzte Nachricht muss vom Benutzer sein (kein Prefill). */
  messages: AiMessage[];
  effort?: AiEffort;
  maxTokens?: number;
  signal?: AbortSignal;
  /** false: lokales Rate-Limit überspringen (z.B. Hintergrundjob). Standard true. */
  rateLimit?: boolean;
};

export type AiTextResult = {
  text: string;
  /** Modell, das tatsächlich geantwortet hat (kann ein Rückfallmodell sein) */
  model: string;
  usage: AiTokenUsage;
  stopReason: string | null;
  /** Antwort wegen max_tokens abgeschnitten */
  truncated: boolean;
};

export type AiStructuredResult<T> = { data: T; model: string; usage: AiTokenUsage };

// ---------------------------------------------------------------------------
// Rate-Limit pro Benutzer (gleitendes Fenster, im Speicher)

/** Verein: 20 Anfragen pro Benutzer in 2 Minuten; Plattform: 60 pro Minute. */
function defaultLimiters(): { tenant: RateLimiter; platform: RateLimiter } {
  return {
    tenant: createRateLimiter({ limit: 20, windowMs: 2 * 60_000 }),
    platform: createRateLimiter({ limit: 60, windowMs: 60_000 }),
  };
}

const limiters = defaultLimiters();

/** Nur für Tests: Rate-Limiter ersetzen (null = Standard, leer). */
export function setAiRateLimiters(next: Partial<typeof limiters> | null): void {
  if (!next) {
    Object.assign(limiters, defaultLimiters());
    return;
  }
  if (next.tenant) limiters.tenant = next.tenant;
  if (next.platform) limiters.platform = next.platform;
}

const MAX_TOKENS_SYNC = 16_000;
const MAX_TOKENS_STREAM = 32_000;

type Prepared = {
  client: Anthropic;
  model: AiModel;
  userId: string | null;
  params: {
    model: string;
    max_tokens: number;
    system: Array<{ type: "text"; text: string; cache_control?: { type: "ephemeral" } }>;
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    output_config: { effort: AiEffort };
    betas: string[];
    fallbacks: "default";
  };
};

async function prepare(opts: AiRunOptions, defaultMax: number, cap: number): Promise<Prepared> {
  const last = opts.messages.at(-1);
  if (!last || last.role !== "user" || !last.content.trim()) throw new AiError("badRequest");
  if (!opts.system.trim()) throw new AiError("badRequest");
  const userId = opts.userId ?? opts.actor?.id ?? null;
  if (opts.rateLimit !== false && userId) {
    const limiter = opts.scope === "platform" ? limiters.platform : limiters.tenant;
    const key = `${opts.scope}:${opts.scope === "tenant" ? opts.tenantId : "-"}:${userId}`;
    const hit = limiter.hit(key);
    if (!hit.ok) throw new AiError("rateLimited", { retryAfterSec: Math.ceil(hit.retryAfterMs / 1000) });
  }
  const ref: AiScopeRef = opts.scope === "platform" ? { scope: "platform" } : { scope: "tenant", tenantId: opts.tenantId };
  const res = await getAiClient(ref, { feature: opts.feature, actor: opts.actor });
  if (!res.ok) throw new AiUnavailable(res.reason);
  const system: Prepared["params"]["system"] = [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }];
  if (opts.systemExtra?.trim()) system.push({ type: "text", text: opts.systemExtra });
  const maxTokens = Math.max(256, Math.min(cap, Math.round(opts.maxTokens ?? defaultMax)));
  return {
    client: res.client,
    model: res.model,
    userId,
    params: {
      model: res.model,
      max_tokens: maxTokens,
      system,
      messages: opts.messages.map((m) => ({ role: m.role, content: m.content })),
      output_config: { effort: opts.effort ?? DEFAULT_EFFORT[opts.feature] },
      betas: [...AI_BETAS],
      fallbacks: "default",
    },
  };
}

function logBase(opts: AiRunOptions, userId: string | null) {
  return { scope: opts.scope, tenantId: opts.scope === "tenant" ? opts.tenantId : null, userId, feature: opts.feature };
}

function textOf(content: ReadonlyArray<{ type: string }>): string {
  return content
    .filter((b): b is { type: "text"; text: string } => b.type === "text" && typeof (b as { text?: unknown }).text === "string")
    .map((b) => b.text)
    .join("");
}

async function failAndLog(opts: AiRunOptions, p: Prepared, err: unknown, usage: AiTokenUsage = ZERO_USAGE): Promise<never> {
  const e = toAiError(err);
  if (e.code !== "aborted") console.error(`[ai] ${opts.feature}: ${e.code}`);
  await logAiUsage({ ...logBase(opts, p.userId), model: p.model, usage, ok: false, errorCode: e.code });
  throw e;
}

/**
 * Textantwort (nicht gestreamt). Wirft AiUnavailable (vor dem Aufruf) oder AiError.
 * Standard max_tokens 8000 (Obergrenze 16000; Denken zählt mit).
 */
export async function runText(opts: AiRunOptions): Promise<AiTextResult> {
  const p = await prepare(opts, 8000, MAX_TOKENS_SYNC);
  let msg;
  try {
    msg = await p.client.beta.messages.create({ ...p.params, stream: false }, { signal: opts.signal });
  } catch (err) {
    return failAndLog(opts, p, err);
  }
  const usage = usageFrom(msg.usage);
  if (msg.stop_reason === "refusal") return failAndLog(opts, p, new AiError("refused"), usage);
  await logAiUsage({ ...logBase(opts, p.userId), model: msg.model || p.model, usage, ok: true });
  return { text: textOf(msg.content), model: msg.model || p.model, usage, stopReason: msg.stop_reason ?? null, truncated: msg.stop_reason === "max_tokens" };
}

/**
 * Strukturierte Antwort nach zod-Schema (output_config.format). Wirft AiError("invalidOutput"),
 * wenn die Antwort nicht dem Schema entspricht oder abgeschnitten ist.
 */
export async function runStructured<S extends z.ZodType>(opts: AiRunOptions & { schema: S }): Promise<AiStructuredResult<z.infer<S>>> {
  const p = await prepare(opts, 8000, MAX_TOKENS_SYNC);
  const format = betaZodOutputFormat(opts.schema);
  let msg;
  try {
    // create statt parse: zuerst stop_reason (Ablehnung, abgeschnitten) prüfen, dann selbst parsen.
    msg = await p.client.beta.messages.create(
      {
        ...p.params,
        betas: [...p.params.betas, STRUCTURED_OUTPUTS_BETA],
        output_config: { ...p.params.output_config, format: { type: "json_schema", schema: format.schema } },
        stream: false,
      },
      { signal: opts.signal },
    );
  } catch (err) {
    return failAndLog(opts, p, err);
  }
  const usage = usageFrom(msg.usage);
  if (msg.stop_reason === "refusal") return failAndLog(opts, p, new AiError("refused"), usage);
  if (msg.stop_reason === "max_tokens") return failAndLog(opts, p, new AiError("invalidOutput"), usage);
  let data: z.infer<S>;
  try {
    const parsed = opts.schema.safeParse(JSON.parse(textOf(msg.content)));
    if (!parsed.success) return failAndLog(opts, p, new AiError("invalidOutput"), usage);
    data = parsed.data as z.infer<S>;
  } catch {
    return failAndLog(opts, p, new AiError("invalidOutput"), usage);
  }
  await logAiUsage({ ...logBase(opts, p.userId), model: msg.model || p.model, usage, ok: true });
  return { data, model: msg.model || p.model, usage };
}

export type AiStreamOptions = AiRunOptions & {
  /** Nach erfolgreichem Ende (nicht bei Ablehnung/Fehler), z.B. um den Verlauf zu speichern. */
  onFinish?: (result: AiTextResult) => void | Promise<void>;
};

/**
 * Gestreamte Textantwort für Route-Handler. Prüfungen (Verfügbarkeit, Limite, Rate-Limit)
 * laufen vor dem Stream und werfen AiUnavailable/AiError – also vor dem Response antworten.
 * Der Stream liefert UTF-8-Text; Fehler/Ablehnung während des Streams als Steuerzeile
 * AI_STREAM_ERROR_MARK + code am Ende (Client: splitAiStream / readAiStream).
 * Standard max_tokens 16000 (Obergrenze 32000).
 */
export async function streamText(opts: AiStreamOptions): Promise<ReadableStream<Uint8Array>> {
  const p = await prepare(opts, 16_000, MAX_TOKENS_STREAM);
  const enc = new TextEncoder();
  const stream = p.client.beta.messages.stream({ ...p.params }, { signal: opts.signal });
  let closed = false;
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const push = (s: string) => {
        if (!closed) controller.enqueue(enc.encode(s));
      };
      let text = "";
      try {
        for await (const ev of stream) {
          if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
            text += ev.delta.text;
            push(ev.delta.text);
          }
        }
        const final = await stream.finalMessage();
        const usage = usageFrom(final.usage);
        const model = final.model || p.model;
        if (final.stop_reason === "refusal") {
          await logAiUsage({ ...logBase(opts, p.userId), model, usage, ok: false, errorCode: "refused" });
          push(AI_STREAM_ERROR_MARK + "refused");
        } else {
          await logAiUsage({ ...logBase(opts, p.userId), model, usage, ok: true });
          if (opts.onFinish) {
            try {
              await opts.onFinish({ text, model, usage, stopReason: final.stop_reason ?? null, truncated: final.stop_reason === "max_tokens" });
            } catch (err) {
              console.error(`[ai] ${opts.feature}: onFinish fehlgeschlagen:`, err instanceof Error ? err.message : err);
            }
          }
        }
      } catch (err) {
        const e = toAiError(err);
        if (e.code !== "aborted") console.error(`[ai] ${opts.feature}: ${e.code}`);
        await logAiUsage({ ...logBase(opts, p.userId), model: p.model, usage: ZERO_USAGE, ok: false, errorCode: e.code });
        push(AI_STREAM_ERROR_MARK + e.code);
      } finally {
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {
            // bereits geschlossen
          }
        }
      }
    },
    cancel() {
      closed = true;
      stream.abort();
    },
  });
}

/** Response für einen Route-Handler (kein Puffern durch nginx, kein Caching). */
export function aiStreamResponse(stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
}
