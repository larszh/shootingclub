import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import * as z from "zod/v4";

// --- DB-Mock (keine echte Datenbank, keine echten Claude-Aufrufe) -----------------
const state = vi.hoisted(() => ({
  platform: null as Record<string, unknown> | null,
  tenant: null as Record<string, unknown> | null,
  moduleEnabled: true,
  used: 0,
  usage: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/db", () => ({
  db: {
    platformAiSettings: {
      findUnique: vi.fn(async () => state.platform),
      upsert: vi.fn(async ({ create, update }: { create: Record<string, unknown>; update: Record<string, unknown> }) => {
        state.platform = { ...(state.platform ?? create), ...update };
        return state.platform;
      }),
    },
    tenantAiSettings: {
      findUnique: vi.fn(async () => state.tenant),
      upsert: vi.fn(async ({ create, update }: { create: Record<string, unknown>; update: Record<string, unknown> }) => {
        state.tenant = { ...(state.tenant ?? create), ...update };
        return state.tenant;
      }),
    },
    tenantModule: { findUnique: vi.fn(async () => ({ enabled: state.moduleEnabled })) },
    aiUsage: {
      // monthTokensUsed gewichtet pro Modell (Budget-Tokens); Ausgabe zählt mehr als Eingabe.
      groupBy: vi.fn(async () => [{ model: "claude-opus-5-5", _sum: { inputTokens: 0, outputTokens: state.used, cacheReadTokens: 0, cacheWriteTokens: 0 } }]),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        state.usage.push(data);
        return data;
      }),
    },
  },
}));

import { encryptJson } from "@/lib/crypto";
import { setAiClientFactory, getAiClient } from "./client";
import { runStructured, runText, setAiRateLimiters, streamText } from "./run";
import { saveKey, testKey } from "./keys";
import { AiError, AiUnavailable, toAiError } from "./errors";
import { createRateLimiter } from "./rate-limit";
import { splitAiStream } from "./types";

const KEY = "sk-ant-api03-" + "t".repeat(32) + "WXYZ";

function message(over: Record<string, unknown> = {}) {
  return {
    id: "msg_1", type: "message", role: "assistant", model: "claude-opus-5-5",
    content: [{ type: "text", text: "Grüezi" }],
    stop_reason: "end_turn",
    usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 100, cache_creation_input_tokens: 0 },
    ...over,
  };
}

const create = vi.fn();
const stream = vi.fn();
const list = vi.fn();
const keysSeen: string[] = [];

function tenantRow(over: Record<string, unknown> = {}) {
  return {
    tenantId: "t1", enabled: true, apiKeyEnc: encryptJson({ apiKey: KEY }), keyHint: "WXYZ", model: "claude-sonnet-5-5",
    features: "help,writing", memberAccess: "ALL", monthlyTokenLimit: null, consentAt: new Date(), consentById: "u0", updatedAt: new Date(),
    ...over,
  };
}

const base = {
  scope: "tenant" as const, tenantId: "t1", feature: "help" as const,
  actor: { id: "u1", isSuperAdmin: false, role: "MEMBER" },
  system: "Du bist die Hilfe von Standchef.",
  messages: [{ role: "user" as const, content: "Wie reserviere ich eine Bahn?" }],
};

beforeEach(() => {
  state.platform = { enabled: false, allowClubs: true, apiKeyEnc: null, keyHint: null, model: "claude-opus-5-5", features: "translations,support", monthlyTokenLimit: null, updatedAt: new Date() };
  state.tenant = tenantRow();
  state.moduleEnabled = true;
  state.used = 0;
  state.usage = [];
  create.mockReset();
  stream.mockReset();
  list.mockReset();
  keysSeen.length = 0;
  setAiRateLimiters(null);
  setAiClientFactory((apiKey) => {
    keysSeen.push(apiKey);
    return { beta: { messages: { create, stream } }, models: { list } } as unknown as Anthropic;
  });
});

afterEach(() => setAiClientFactory(null));

describe("runText", () => {
  it("ruft Claude mit Fallback, Effort und gecachtem System-Prompt auf und protokolliert", async () => {
    create.mockResolvedValue(message());
    const res = await runText({ ...base, systemExtra: "Sprache: de" });
    expect(res.text).toBe("Grüezi");
    expect(res.usage).toEqual({ inputTokens: 10, outputTokens: 5, cacheReadTokens: 100, cacheWriteTokens: 0 });
    expect(keysSeen).toEqual([KEY]);
    const params = create.mock.calls[0]![0];
    expect(params.model).toBe("claude-sonnet-5-5");
    expect(params.fallbacks).toBe("default");
    expect(params.betas).toContain("server-side-fallback-2026-07-01");
    expect(params.output_config).toEqual({ effort: "low" });
    expect(params.system[0].cache_control).toEqual({ type: "ephemeral" });
    expect(params.system[1]).toEqual({ type: "text", text: "Sprache: de" });
    expect(params).not.toHaveProperty("temperature");
    expect(params).not.toHaveProperty("thinking");
    expect(state.usage).toHaveLength(1);
    expect(state.usage[0]).toMatchObject({ scope: "TENANT", tenantId: "t1", userId: "u1", feature: "help", ok: true, inputTokens: 10 });
  });

  it("Ablehnung → AiError refused, Verbrauch mit ok=false", async () => {
    create.mockResolvedValue(message({ stop_reason: "refusal", content: [] }));
    await expect(runText(base)).rejects.toMatchObject({ code: "refused" });
    expect(state.usage[0]).toMatchObject({ ok: false, errorCode: "refused", outputTokens: 5 });
  });

  it("typisierte SDK-Fehler → AiError-Codes, ohne Rohtext", async () => {
    create.mockRejectedValue(new Anthropic.AuthenticationError(401, { error: { message: "secret detail" } }, "bad key", new Headers()));
    const err = await runText(base).catch((e) => e);
    expect(err).toBeInstanceOf(AiError);
    expect(err.code).toBe("invalidKey");
    expect(String(err.message)).not.toContain("secret detail");
    expect(state.usage[0]).toMatchObject({ ok: false, errorCode: "invalidKey" });
  });

  it("nicht verfügbar → AiUnavailable ohne Aufruf", async () => {
    state.tenant = tenantRow({ consentAt: null });
    await expect(runText(base)).rejects.toMatchObject({ reason: "noConsent" });
    state.tenant = tenantRow({ monthlyTokenLimit: 100 });
    state.used = 100;
    const err = await runText(base).catch((e) => e);
    expect(err).toBeInstanceOf(AiUnavailable);
    expect(err.reason).toBe("limitReached");
    state.used = 0;
    state.moduleEnabled = false;
    await expect(runText(base)).rejects.toMatchObject({ reason: "clubOff" });
    expect(create).not.toHaveBeenCalled();
    expect(state.usage).toHaveLength(0);
  });

  it("Rolle wird geprüft (writing ab Trainer)", async () => {
    await expect(runText({ ...base, feature: "writing" })).rejects.toMatchObject({ reason: "noAccess" });
  });

  it("kein Prefill: letzte Nachricht muss vom Benutzer sein", async () => {
    await expect(runText({ ...base, messages: [...base.messages, { role: "assistant", content: "Also" }] })).rejects.toMatchObject({ code: "badRequest" });
  });

  it("lokales Rate-Limit pro Benutzer", async () => {
    create.mockResolvedValue(message());
    setAiRateLimiters({ tenant: createRateLimiter({ limit: 1, windowMs: 60_000 }) });
    await runText(base);
    await expect(runText(base)).rejects.toMatchObject({ code: "rateLimited" });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("Plattform: Super-Admin, Plattform-Schlüssel", async () => {
    state.platform = { ...state.platform!, enabled: true, apiKeyEnc: encryptJson({ apiKey: KEY + "P" }) };
    create.mockResolvedValue(message());
    await runText({ scope: "platform", feature: "translations", actor: { id: "s", isSuperAdmin: true, role: null }, system: "Translate.", messages: base.messages });
    expect(keysSeen).toEqual([KEY + "P"]);
    expect(create.mock.calls[0]![0].output_config.effort).toBe("medium");
    expect(state.usage[0]).toMatchObject({ scope: "PLATFORM", tenantId: null, feature: "translations" });
  });
});

describe("runStructured", () => {
  const schema = z.object({ items: z.array(z.object({ key: z.string(), value: z.string() })) });

  it("liefert geprüfte Daten", async () => {
    create.mockResolvedValue(message({ content: [{ type: "text", text: JSON.stringify({ items: [{ key: "a", value: "b" }] }) }] }));
    const res = await runStructured({ ...base, schema });
    expect(res.data.items[0]!.value).toBe("b");
    const params = create.mock.calls[0]![0];
    expect(params.output_config.format.type).toBe("json_schema");
    expect(params.output_config.effort).toBe("low");
  });

  it("Schema verletzt oder abgeschnitten → invalidOutput", async () => {
    create.mockResolvedValue(message({ content: [{ type: "text", text: "{\"items\": 3}" }] }));
    await expect(runStructured({ ...base, schema })).rejects.toMatchObject({ code: "invalidOutput" });
    create.mockResolvedValue(message({ stop_reason: "max_tokens", content: [{ type: "text", text: "{\"items\": [" }] }));
    await expect(runStructured({ ...base, schema })).rejects.toMatchObject({ code: "invalidOutput" });
  });
});

function fakeStream(texts: string[], final: Record<string, unknown> | Error, current?: Record<string, unknown>) {
  return {
    abort: vi.fn(),
    currentMessage: current,
    async *[Symbol.asyncIterator]() {
      for (const t of texts) yield { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: t } };
      if (final instanceof Error) throw final;
    },
    finalMessage: async () => final,
  };
}

async function readAll(s: ReadableStream<Uint8Array>): Promise<string> {
  return new Response(s).text();
}

describe("streamText", () => {
  it("streamt Text und ruft onFinish", async () => {
    stream.mockReturnValue(fakeStream(["Hal", "lo"], message({ content: [{ type: "text", text: "Hallo" }] })));
    const onFinish = vi.fn();
    const out = await readAll(await streamText({ ...base, onFinish }));
    expect(splitAiStream(out)).toEqual({ text: "Hallo", error: null });
    expect(onFinish).toHaveBeenCalledWith(expect.objectContaining({ text: "Hallo" }));
    expect(state.usage[0]).toMatchObject({ ok: true });
    expect(stream.mock.calls[0]![0].fallbacks).toBe("default");
  });

  it("Ablehnung und Fehler als Steuerzeile", async () => {
    stream.mockReturnValue(fakeStream(["x"], message({ stop_reason: "refusal" })));
    expect(splitAiStream(await readAll(await streamText(base))).error).toBe("refused");
    stream.mockReturnValue(fakeStream([], new Anthropic.APIConnectionError({ message: "down" })));
    expect(splitAiStream(await readAll(await streamText(base))).error).toBe("network");
    expect(state.usage.map((u) => u.errorCode)).toEqual(["refused", "network"]);
  });

  it("Abbruch mitten im Stream zählt bereits verrechnete Token", async () => {
    const started = message({ model: "claude-opus-5-5", usage: { input_tokens: 40, output_tokens: 1, cache_read_input_tokens: 10_000, cache_creation_input_tokens: 0 } });
    stream.mockReturnValue(fakeStream(["Zuerst ", "öffnest du die Reservation"], new Anthropic.APIUserAbortError(), started));
    expect(splitAiStream(await readAll(await streamText(base))).error).toBe("aborted");
    expect(state.usage[0]).toMatchObject({ ok: false, errorCode: "aborted", model: "claude-opus-5-5", inputTokens: 40, cacheReadTokens: 10_000 });
    expect(state.usage[0]!.outputTokens).toBeGreaterThan(1);
  });

  it("Fehler-Event im Stream (ohne Status) → overloaded", async () => {
    const err = new Anthropic.APIError(undefined, { type: "error", error: { type: "overloaded_error" } }, undefined, new Headers(), "overloaded_error");
    stream.mockReturnValue(fakeStream(["x"], err));
    expect(splitAiStream(await readAll(await streamText(base))).error).toBe("overloaded");
    expect(state.usage[0]).toMatchObject({ errorCode: "overloaded" });
  });

  it("Prüfungen vor dem Stream", async () => {
    state.tenant = tenantRow({ apiKeyEnc: null });
    await expect(streamText(base)).rejects.toMatchObject({ reason: "noKey" });
    expect(stream).not.toHaveBeenCalled();
  });
});

describe("Schlüssel", () => {
  it("speichert verschlüsselt mit Hinweis und testet über models.list", async () => {
    state.tenant = null;
    const res = await saveKey({ scope: "tenant", tenantId: "t9" }, `  ${KEY} `);
    expect(res).toEqual({ ok: true, keyHint: "WXYZ" });
    expect(String(state.tenant!.apiKeyEnc)).not.toContain(KEY);
    expect(await saveKey({ scope: "platform" }, "nope")).toEqual({ ok: false, error: "invalidFormat" });
    list.mockResolvedValue({ data: [] });
    expect(await testKey(KEY)).toEqual({ ok: true });
    list.mockRejectedValue(new Anthropic.AuthenticationError(401, {}, "x", new Headers()));
    expect(await testKey(KEY)).toEqual({ ok: false, code: "invalidKey" });
  });

  it("getAiClient ohne Funktion prüft nur Grundvoraussetzungen", async () => {
    const res = await getAiClient({ scope: "tenant", tenantId: "t1" });
    expect(res.ok && res.model).toBe("claude-sonnet-5-5");
  });
});

describe("toAiError", () => {
  it.each([
    [new Anthropic.RateLimitError(429, {}, "x", new Headers({ "retry-after": "12" })), "rateLimited"],
    [new Anthropic.PermissionDeniedError(403, {}, "x", new Headers()), "invalidKey"],
    [new Anthropic.BadRequestError(400, {}, "x", new Headers()), "badRequest"],
    [new Anthropic.InternalServerError(529, {}, "x", new Headers()), "overloaded"],
    [new Anthropic.APIConnectionTimeoutError(), "network"],
    [new Anthropic.APIUserAbortError(), "aborted"],
    [new Anthropic.APIError(undefined, { type: "error", error: { type: "overloaded_error" } }, undefined, new Headers(), "overloaded_error"), "overloaded"],
    [new Anthropic.APIError(undefined, { type: "error", error: { type: "rate_limit_error" } }, undefined, new Headers(), "rate_limit_error"), "rateLimited"],
    [new Anthropic.APIError(undefined, { type: "error", error: { type: "invalid_request_error" } }, undefined, new Headers(), "invalid_request_error"), "badRequest"],
    [new Anthropic.APIError(undefined, { type: "error", error: { type: "weird" } }, undefined, new Headers(), null), "unknown"],
    [new Error("boom"), "unknown"],
  ] as const)("%s → %s", (err, code) => {
    expect(toAiError(err).code).toBe(code);
  });
  it("retry-after wird übernommen", () => {
    expect(toAiError(new Anthropic.RateLimitError(429, {}, "x", new Headers({ "retry-after": "12" }))).retryAfterSec).toBe(12);
  });
});
