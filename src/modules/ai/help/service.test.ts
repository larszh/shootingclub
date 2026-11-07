import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";

// --- DB-Mock (keine echte Datenbank, keine echten Claude-Aufrufe) -----------------
const state = vi.hoisted(() => ({
  platform: null as Record<string, unknown> | null,
  tenant: null as Record<string, unknown> | null,
  usage: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/db", () => ({
  db: {
    platformAiSettings: { findUnique: vi.fn(async () => state.platform) },
    tenantAiSettings: { findUnique: vi.fn(async () => state.tenant) },
    tenantModule: { findUnique: vi.fn(async () => ({ enabled: true })) },
    aiUsage: {
      aggregate: vi.fn(async () => ({ _sum: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 } })),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        state.usage.push(data);
        return data;
      }),
    },
  },
}));

import { encryptJson } from "@/lib/crypto";
import { can as canPerm, type Permission } from "@/lib/permissions";
import type { ModuleKey } from "@/lib/modules";
import { AiError, AiUnavailable, setAiClientFactory, setAiRateLimiters, splitAiStream } from "@/lib/ai";
import { openHelpStream, openSupportStream, type HelpContext } from "./service";
import { setHelpRateLimiters } from "./limits";

const KEY = "sk-ant-api03-" + "h".repeat(32) + "ABCD";
const stream = vi.fn();

function fakeStream(texts: string[]) {
  return {
    abort: vi.fn(),
    async *[Symbol.asyncIterator]() {
      for (const t of texts) yield { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: t } };
    },
    finalMessage: async () => ({
      id: "m", type: "message", role: "assistant", model: "claude-opus-5-5", content: [{ type: "text", text: texts.join("") }],
      stop_reason: "end_turn", usage: { input_tokens: 5, output_tokens: 3, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    }),
  };
}

function ctx(role: string, modules: string[] = ["scores", "bookings", "ai"]): HelpContext {
  return {
    user: { id: "u1", name: "Anna Muster", isSuperAdmin: false },
    tenant: { id: "t1", name: "SV Muster", role, enabledModules: modules as ModuleKey[] },
    can: (p: Permission) => canPerm({ isSuperAdmin: false, role }, p),
  };
}

const ask = [{ role: "user" as const, content: "Wie reserviere ich eine Bahn?" }];
const read = (s: ReadableStream<Uint8Array>) => new Response(s).text();

beforeEach(() => {
  state.platform = { enabled: true, allowClubs: true, apiKeyEnc: encryptJson({ apiKey: KEY }), keyHint: "ABCD", model: "claude-opus-5-5", features: "translations,support", monthlyTokenLimit: null, updatedAt: new Date() };
  state.tenant = {
    tenantId: "t1", enabled: true, apiKeyEnc: encryptJson({ apiKey: KEY }), keyHint: "ABCD", model: "claude-opus-5-5",
    features: "help", memberAccess: "ALL", monthlyTokenLimit: null, consentAt: new Date(), consentById: "u0", updatedAt: new Date(),
  };
  state.usage = [];
  stream.mockReset();
  stream.mockImplementation(() => fakeStream(["Unter ", "[Buchen](/bookings)."]));
  setAiRateLimiters(null);
  setHelpRateLimiters(null);
  setAiClientFactory(() => ({ beta: { messages: { stream } } }) as unknown as Anthropic);
});

afterEach(() => setAiClientFactory(null));

describe("openHelpStream", () => {
  it("streams the answer with a grounded, cached system prompt", async () => {
    const s = await openHelpStream({ ctx: ctx("MEMBER"), locale: "de", messages: ask });
    expect(splitAiStream(await read(s))).toEqual({ text: "Unter [Buchen](/bookings).", error: null });
    const params = stream.mock.calls[0]![0];
    expect(params.system[0].cache_control).toEqual({ type: "ephemeral" });
    expect(params.system[0].text).toContain("- /bookings («Buchen»)");
    expect(params.system[0].text).toContain("Wie trete ich einem Verein bei?");
    expect(params.system[0].text).not.toContain("Anna");
    expect(params.system[0].text).not.toContain("/admin/ai");
    expect(params.system[1].text).toContain("Answer in Swiss Standard German");
    expect(params.system[1].text).toContain("first name is Anna.");
    expect(params.system[1].text).not.toContain("Muster.");
    expect(params.output_config).toEqual({ effort: "low" });
    expect(params.fallbacks).toBe("default");
    expect(params.messages).toEqual(ask);
    expect(params).not.toHaveProperty("thinking");
    expect(state.usage[0]).toMatchObject({ feature: "help", ok: true, userId: "u1" });
  });

  it("sends only the trimmed history", async () => {
    const long = Array.from({ length: 40 }, (_, i) => ({ role: (i % 2 ? "assistant" : "user") as "user" | "assistant", content: `m${i}` }));
    long.push({ role: "user", content: "letzte Frage" });
    await read(await openHelpStream({ ctx: ctx("MEMBER"), locale: "de", messages: long }));
    const sent = stream.mock.calls[0]![0].messages as Array<{ role: string; content: string }>;
    expect(sent.length).toBeLessThanOrEqual(20);
    expect(sent[0]!.role).toBe("user");
    expect(sent.at(-1)).toEqual({ role: "user", content: "letzte Frage" });
  });

  it("rejects a history that does not end with a question", async () => {
    await expect(openHelpStream({ ctx: ctx("MEMBER"), locale: "de", messages: [{ role: "assistant", content: "x" }] })).rejects.toBeInstanceOf(AiError);
    expect(stream).not.toHaveBeenCalled();
  });

  it("throws AiUnavailable before calling Claude when the club has no key", async () => {
    state.tenant = { ...state.tenant!, apiKeyEnc: null };
    const err = await openHelpStream({ ctx: ctx("MEMBER"), locale: "de", messages: ask }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AiUnavailable);
    expect((err as AiUnavailable).reason).toBe("noKey");
    expect(stream).not.toHaveBeenCalled();
  });

  it("requires a club", async () => {
    const c = { ...ctx("MEMBER"), tenant: null };
    await expect(openHelpStream({ ctx: c, locale: "de", messages: ask })).rejects.toMatchObject({ reason: "clubOff" });
  });

  it("limits each person to 20 questions in 10 minutes", async () => {
    for (let i = 0; i < 20; i++) await read(await openHelpStream({ ctx: ctx("MEMBER"), locale: "de", messages: ask }));
    setAiRateLimiters(null); // allgemeines Limit (20/2 min) zurücksetzen, um das Hilfe-Limit zu prüfen
    const err = await openHelpStream({ ctx: ctx("MEMBER"), locale: "de", messages: ask }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AiError);
    expect((err as AiError).code).toBe("rateLimited");
    expect((err as AiError).retryAfterSec).toBeGreaterThan(0);
    expect(stream).toHaveBeenCalledTimes(20);
  });

  it("includes admin pages and help for admins", async () => {
    await read(await openHelpStream({ ctx: ctx("ADMIN"), locale: "fr", messages: ask }));
    const sys = stream.mock.calls[0]![0].system[0].text as string;
    expect(sys).toContain("/admin/ai");
    expect(sys).toContain("Comment adhérer à une société");
  });
});

describe("openSupportStream", () => {
  it("uses the platform key with docs for super admins", async () => {
    const s = await openSupportStream({ user: { id: "sa", name: "Sam Admin", isSuperAdmin: true }, locale: "de", messages: ask });
    await read(s);
    const params = stream.mock.calls[0]![0];
    expect(params.system[0].text).toContain("### File: README.md");
    expect(params.system[0].text).toContain("internal support assistant");
    expect(state.usage[0]).toMatchObject({ feature: "support", ok: true });
  });

  it("refuses non super admins", async () => {
    await expect(openSupportStream({ user: { id: "u", name: "X", isSuperAdmin: false }, locale: "de", messages: ask })).rejects.toMatchObject({ reason: "noAccess" });
    expect(stream).not.toHaveBeenCalled();
  });

  it("reports platformOff when platform AI is switched off", async () => {
    state.platform = { ...state.platform!, enabled: false };
    await expect(openSupportStream({ user: { id: "sa", name: "S", isSuperAdmin: true }, locale: "de", messages: ask })).rejects.toMatchObject({ reason: "platformOff" });
  });
});
