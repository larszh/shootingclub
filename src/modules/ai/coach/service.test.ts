import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";

// --- DB-Mock (keine echte Datenbank, keine echten Claude-Aufrufe) -----------------
const state = vi.hoisted(() => ({
  platform: null as Record<string, unknown> | null,
  tenant: null as Record<string, unknown> | null,
  parts: [] as Array<Record<string, unknown>>,
  cache: new Map<string, { value: string; expiresAt: Date }>(),
  usage: [] as Array<Record<string, unknown>>,
  partWhere: [] as unknown[],
  audits: [] as Array<Record<string, unknown>>,
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
    aiCache: {
      findUnique: vi.fn(async ({ where }: { where: { feature_cacheKey: { feature: string; cacheKey: string } } }) => state.cache.get(`${where.feature_cacheKey.feature}:${where.feature_cacheKey.cacheKey}`) ?? null),
      upsert: vi.fn(async ({ create }: { create: { feature: string; cacheKey: string; value: string; expiresAt: Date } }) => {
        state.cache.set(`${create.feature}:${create.cacheKey}`, { value: create.value, expiresAt: create.expiresAt });
        return create;
      }),
    },
    matchParticipant: {
      findMany: vi.fn(async (args: { where: unknown }) => {
        state.partWhere.push(args.where);
        return state.parts;
      }),
    },
  },
}));
vi.mock("@/lib/audit", () => ({ audit: vi.fn(async (e: Record<string, unknown>) => void state.audits.push(e)) }));

import { encryptJson } from "@/lib/crypto";
import { setAiClientFactory, setAiRateLimiters, AiUnavailable } from "@/lib/ai";
import { CoachNoData, getCoachCard, getImportAssistState, runCoach, suggestImportMapping, type TenantCtx } from "./service";

const KEY = "sk-ant-api03-" + "c".repeat(32) + "ABCD";
const create = vi.fn();

const STAGES = JSON.stringify([{ name: "A", distanceM: 300, shots: 2, maxPerShot: 10 }]);
function part(date: string, shots: number[]) {
  return {
    results: [{ stageIndex: 0, shotsJson: JSON.stringify(shots), total: shots.reduce((a, b) => a + b, 0) }],
    match: { date: new Date(`${date}T10:00:00Z`), status: "FINISHED", program: { id: "p1", name: "Training 300 m", stagesJson: STAGES, scoringMode: "RINGS_INT", tenantId: "t1" } },
  };
}

function ctx(role = "MEMBER", perms: string[] = ["ai.use"]): TenantCtx {
  return {
    user: { id: "u1", isSuperAdmin: false },
    tenant: { id: "t1", role },
    can: (p: string) => perms.includes(p),
    hasModule: () => true,
  } as unknown as TenantCtx;
}

function reply(json: unknown) {
  return {
    id: "msg_1", type: "message", role: "assistant", model: "claude-opus-5-5",
    content: [{ type: "text", text: JSON.stringify(json) }],
    stop_reason: "end_turn",
    usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
  };
}

const COACH_OUT = { summary: "Du schiesst konstant.", strengths: ["Gute zweite Serie"], focus: ["Abzug"], training: { title: "Trockentraining", steps: ["10 Minuten Abzug üben", "5 Probeschüsse"] } };

beforeEach(() => {
  state.platform = { enabled: false, allowClubs: true, apiKeyEnc: null, keyHint: null, model: "claude-opus-5-5", features: "translations,support", monthlyTokenLimit: null, updatedAt: new Date() };
  state.tenant = {
    tenantId: "t1", enabled: true, apiKeyEnc: encryptJson({ apiKey: KEY }), keyHint: "ABCD", model: "claude-opus-5-5",
    features: "help,coach,importHelper", memberAccess: "ALL", monthlyTokenLimit: null, consentAt: new Date(), consentById: "u0", updatedAt: new Date(),
  };
  state.parts = [part("2026-11-01", [9, 8]), part("2026-10-01", [7, 8])];
  state.cache.clear();
  state.usage = [];
  state.partWhere = [];
  state.audits = [];
  create.mockReset();
  setAiRateLimiters(null);
  setAiClientFactory(() => ({ beta: { messages: { create } } }) as unknown as Anthropic);
});

afterEach(() => setAiClientFactory(null));

describe("runCoach", () => {
  it("loads only the member's own results, calls Claude with structured output and caches per day", async () => {
    create.mockResolvedValue(reply(COACH_OUT));
    const res = await runCoach(ctx(), "de");
    expect(res).toMatchObject({ summary: "Du schiesst konstant.", matchCount: 2, training: { title: "Trockentraining" } });
    expect(state.partWhere[0]).toMatchObject({ userId: "u1", match: { tenantId: "t1" } });

    const params = create.mock.calls[0]![0];
    expect(params.output_config.effort).toBe("low");
    expect(params.output_config.format.type).toBe("json_schema");
    expect(params.fallbacks).toBe("default");
    expect(params.system[1].text).toContain("Swiss Standard German");
    const user = params.messages[0].content as string;
    expect(user).toContain("Training 300 m");
    expect(user).toContain("17/20");
    expect(state.usage[0]).toMatchObject({ feature: "coach", ok: true, userId: "u1" });

    // gleicher Tag, gleiche Daten → aus dem Cache, kein zweiter Aufruf
    const again = await runCoach(ctx(), "de");
    expect(again.summary).toBe(res.summary);
    expect(create).toHaveBeenCalledTimes(1);

    // neues Resultat → neue Auswertung
    state.parts = [part("2026-11-05", [10, 10]), ...state.parts];
    await runCoach(ctx(), "de");
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("throws CoachNoData without completed sessions and never calls Claude", async () => {
    state.parts = [];
    await expect(runCoach(ctx(), "de")).rejects.toBeInstanceOf(CoachNoData);
    expect(create).not.toHaveBeenCalled();
  });

  it("respects the club setting «staff only»", async () => {
    state.tenant = { ...state.tenant!, memberAccess: "STAFF" };
    await expect(runCoach(ctx("MEMBER"), "de")).rejects.toMatchObject({ reason: "noAccess" });
    create.mockResolvedValue(reply(COACH_OUT));
    await expect(runCoach(ctx("TRAINER"), "de")).resolves.toMatchObject({ matchCount: 2 });
  });

  it("requires the ai.use permission", async () => {
    await expect(runCoach(ctx("MEMBER", []), "de")).rejects.toBeInstanceOf(AiUnavailable);
  });
});

describe("getCoachCard", () => {
  it("shows the card with today's cached analysis", async () => {
    create.mockResolvedValue(reply(COACH_OUT));
    await runCoach(ctx(), "de");
    const card = await getCoachCard(ctx(), "de");
    expect(card).toMatchObject({ state: { ok: true }, stale: false, matchCount: 2, cached: { summary: "Du schiesst konstant." } });
    state.parts = [part("2026-11-06", [10, 9]), ...state.parts];
    expect((await getCoachCard(ctx(), "de"))!.stale).toBe(true);
  });

  it("hides the card when the feature is off and shows setup hints only to admins", async () => {
    state.tenant = { ...state.tenant!, features: "help" };
    expect(await getCoachCard(ctx(), "de")).toBeNull();
    state.tenant = { ...state.tenant!, features: "coach", apiKeyEnc: null };
    expect(await getCoachCard(ctx(), "de")).toBeNull();
    expect(await getCoachCard(ctx("ADMIN", ["ai.use", "ai.manage"]), "de")).toMatchObject({ state: { ok: false, messageKey: "ai.unavailable.noKey" } });
  });
});

describe("suggestImportMapping", () => {
  const headers = ["Startnummer", "Name", "Vorname", "E-Mail", "Ring"];
  const rows = [["12", "Muster", "Hans", "hans@example.ch", "10.4"], ["13", "Beispiel", "Anna", "anna@example.ch", "9.8"]];

  it("sends only masked samples and returns a validated mapping", async () => {
    create.mockResolvedValue(reply({
      columns: [
        { column: 0, field: "startNo", confidence: "high" },
        { column: 1, field: "lastName", confidence: "high" },
        { column: 2, field: "firstName", confidence: "high" },
        { column: 4, field: "shotValue", confidence: "medium" },
        { column: 9, field: "total", confidence: "high" },
      ],
      layout: "shots",
      note: "Zeile pro Schuss.",
    }));
    const res = await suggestImportMapping(ctx("ADMIN"), { kind: "scores", headers, rows, locale: "de" });
    expect(res.mapping).toEqual(["startNo", "lastName", "firstName", "ignore", "shotValue"]);
    expect(res.layout).toBe("shots");
    expect(res.dropped).toBe(1);

    const params = create.mock.calls[0]![0];
    const sent = JSON.stringify(params.messages);
    for (const secret of ["Muster", "Hans", "Beispiel", "Anna", "example.ch"]) expect(sent).not.toContain(secret);
    expect(sent).toContain("10.4");
    expect(params.output_config.effort).toBe("medium");
    expect(state.usage[0]).toMatchObject({ feature: "importHelper", ok: true });
    expect(state.audits[0]).toMatchObject({ action: "ai.import.mapping", tenantId: "t1" });
  });

  it("is only for admins (minimum role of importHelper)", async () => {
    await expect(suggestImportMapping(ctx("TRAINER"), { kind: "scores", headers, rows, locale: "de" })).rejects.toMatchObject({ reason: "noAccess" });
    expect(await getImportAssistState(ctx("TRAINER"))).toBeNull();
    expect(await getImportAssistState(ctx("ADMIN"))).toEqual({ ok: true });
    expect(create).not.toHaveBeenCalled();
  });

  it("maps a refusal to a typed error", async () => {
    create.mockResolvedValue({ ...reply({}), stop_reason: "refusal" });
    await expect(suggestImportMapping(ctx("ADMIN"), { kind: "members", headers, rows, locale: "fr" })).rejects.toMatchObject({ code: "refused" });
  });
});
