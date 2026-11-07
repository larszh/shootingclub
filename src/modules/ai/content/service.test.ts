import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";

// --- Mocks: keine Datenbank, keine echten Claude-Aufrufe ---------------------------
const state = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  event: { title: "Endschiessen", description: "Treffpunkt 18:00 Uhr beim Schützenhaus.\n\n- Gehörschutz mitnehmen" } as { title: string; description: string } | null,
  usage: [] as Array<Record<string, unknown>>,
  upserts: [] as Array<Record<string, unknown>>,
  tenantRow: null as Record<string, unknown> | null,
}));

vi.mock("@/lib/db", () => ({
  db: {
    platformAiSettings: { findUnique: vi.fn(async () => ({ enabled: false, allowClubs: true, apiKeyEnc: null, keyHint: null, model: "claude-opus-5-5", features: "", monthlyTokenLimit: null, updatedAt: new Date() })) },
    tenantAiSettings: { findUnique: vi.fn(async () => state.tenantRow) },
    tenantModule: { findUnique: vi.fn(async () => ({ enabled: true })) },
    aiUsage: {
      aggregate: vi.fn(async () => ({ _sum: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 } })),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { state.usage.push(data); return data; }),
    },
    event: { findFirst: vi.fn(async () => state.event) },
    contentTranslation: {
      findMany: vi.fn(async ({ where }: { where: { locale?: string } }) => state.rows.filter((r) => !where.locale || r.locale === where.locale)),
      upsert: vi.fn((args: Record<string, unknown>) => { state.upserts.push(args); return args; }),
      deleteMany: vi.fn(() => ({ count: 0 })),
    },
    $transaction: vi.fn(async (ops: unknown[]) => ops),
  },
}));
vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => undefined) }));
vi.mock("@/lib/i18n", async () => ({ ...(await vi.importActual<object>("@/lib/i18n/core")), getTenantLocale: async () => "de", getRequestLocale: async () => "de" }));

import { encryptJson } from "@/lib/crypto";
import { setAiClientFactory, setAiRateLimiters } from "@/lib/ai";
import { contentHash } from "./logic";
import { displayContent, saveTranslation, translateContent, type TenantCtx } from "./service";

const KEY = "sk-ant-api03-" + "k".repeat(32) + "ABCD";
state.tenantRow = {
  tenantId: "t1", enabled: true, apiKeyEnc: encryptJson({ apiKey: KEY }), keyHint: "ABCD", model: "claude-opus-5-5",
  features: "contentTranslation,writing,reports", memberAccess: "ALL", monthlyTokenLimit: null, consentAt: new Date(), consentById: "u0", updatedAt: new Date(),
};

function ctx(role = "ADMIN", perms: string[] = ["events.manage"]): TenantCtx {
  return {
    user: { id: "u1", isSuperAdmin: false } as TenantCtx["user"],
    tenant: { id: "t1", slug: "sv", name: "SV Muster", kind: "CLUB", role, enabledModules: [], logoUrl: null, brandColor: null, brandColor2: null },
    can: (p) => perms.includes(p),
    hasModule: () => true,
  };
}

const create = vi.fn();
function reply(fields: Array<{ field: string; text: string }>) {
  return {
    id: "m", type: "message", role: "assistant", model: "claude-opus-5-5", stop_reason: "end_turn",
    content: [{ type: "text", text: JSON.stringify({ fields }) }],
    usage: { input_tokens: 50, output_tokens: 20, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
  };
}

beforeEach(() => {
  state.rows = [];
  state.usage = [];
  state.upserts = [];
  state.event = { title: "Endschiessen", description: "Treffpunkt 18:00 Uhr beim Schützenhaus.\n\n- Gehörschutz mitnehmen" };
  create.mockReset();
  setAiRateLimiters(null);
  setAiClientFactory(() => ({ beta: { messages: { create } } }) as unknown as Anthropic);
});
afterEach(() => setAiClientFactory(null));

describe("translateContent", () => {
  it("übersetzt fehlende Sprachen strukturiert und gibt Vorschläge zurück (ohne zu speichern)", async () => {
    create.mockImplementation(async (params: { system: Array<{ text: string }> }) => {
      const lang = params.system[1]!.text.match(/Target language: ([^.]+)\./)![1];
      return reply([{ field: "title", text: `[${lang}] Titel` }, { field: "description", text: `[${lang}] Text\n\n- Liste` }]);
    });
    const res = await translateContent(ctx(), "event", "e1");
    expect(res.proposals.map((p) => p.locale).sort()).toEqual(["en", "fr", "it"]);
    expect(res.failed).toEqual([]);
    const fr = res.proposals.find((p) => p.locale === "fr")!;
    expect(fr.fields.title).toBe("[Swiss French] Titel");
    expect(fr.hashes.title).toBe(contentHash("Endschiessen"));
    expect(state.upserts).toHaveLength(0);

    const params = create.mock.calls[0]![0];
    expect(params.output_config.effort).toBe("medium");
    expect(params.output_config.format.type).toBe("json_schema");
    expect(params.fallbacks).toBe("default");
    expect(params.system[0].cache_control).toEqual({ type: "ephemeral" });
    expect(params.system[0].text).not.toContain("SV Muster");
    expect(params.messages).toHaveLength(1);
    expect(params.messages[0].content).toContain('<data name="field-description">');
    expect(params).not.toHaveProperty("temperature");
    expect(params).not.toHaveProperty("thinking");
    expect(state.usage.every((u) => u.feature === "contentTranslation" && u.ok === true)).toBe(true);
  });

  it("überspringt aktuelle Übersetzungen, übersetzt veraltete neu", async () => {
    state.rows = [
      { entityId: "e1", field: "title", locale: "fr", value: "Tir", sourceHash: contentHash("Endschiessen"), status: "AUTO" },
      { entityId: "e1", field: "description", locale: "fr", value: "…", sourceHash: contentHash(state.event!.description), status: "AUTO" },
      { entityId: "e1", field: "title", locale: "it", value: "Tiro", sourceHash: contentHash("alter Titel"), status: "REVIEWED" },
    ];
    create.mockResolvedValue(reply([{ field: "title", text: "T" }, { field: "description", text: "D" }]));
    const res = await translateContent(ctx(), "event", "e1");
    expect(res.skipped).toEqual(["fr"]);
    expect(res.proposals.map((p) => p.locale).sort()).toEqual(["en", "it"]);
  });

  it("unvollständige Antwort → Fehler pro Sprache, Ablehnung ebenso", async () => {
    create.mockResolvedValueOnce(reply([{ field: "title", text: "nur Titel" }]))
      .mockResolvedValueOnce({ ...reply([]), stop_reason: "refusal", content: [] })
      .mockResolvedValueOnce(reply([{ field: "title", text: "T" }, { field: "description", text: "D" }]));
    const res = await translateContent(ctx(), "event", "e1");
    expect(res.proposals).toHaveLength(1);
    expect(res.failed.map((f) => f.messageKey).sort()).toEqual(["ai.error.invalidOutput", "ai.error.refused"]);
  });

  it("ohne Berechtigung kein Aufruf", async () => {
    await expect(translateContent(ctx("MEMBER", []), "event", "e1")).rejects.toMatchObject({ reason: "noAccess" });
    expect(create).not.toHaveBeenCalled();
  });
});

describe("saveTranslation", () => {
  it("speichert mit Prüfsumme des aktuellen Originals", async () => {
    const hashes = { title: contentHash("Endschiessen"), description: contentHash(state.event!.description) };
    const res = await saveTranslation(ctx(), "event", "e1", { locale: "fr", values: { title: "Tir de clôture", description: "Rendez-vous" }, hashes, reviewed: true });
    expect(res).toEqual({ ok: true });
    expect(state.upserts).toHaveLength(2);
    expect(state.upserts[0]).toMatchObject({ create: { tenantId: "t1", locale: "fr", status: "REVIEWED", sourceHash: hashes.title } });
  });

  it("lehnt ab, wenn das Original inzwischen geändert wurde oder die Sprache die Quelle ist", async () => {
    const hashes = { title: contentHash("alter Titel"), description: contentHash(state.event!.description) };
    expect(await saveTranslation(ctx(), "event", "e1", { locale: "fr", values: { title: "a", description: "b" }, hashes, reviewed: false })).toEqual({ ok: false, error: "changed" });
    expect(await saveTranslation(ctx(), "event", "e1", { locale: "de", values: { title: "a", description: "b" }, hashes, reviewed: false })).toEqual({ ok: false, error: "invalid" });
    expect(state.upserts).toHaveLength(0);
  });
});

describe("displayContent", () => {
  it("wählt pro Inhalt Übersetzung oder Original", async () => {
    state.rows = [
      { entityId: "a", field: "title", locale: "fr", value: "Tir", sourceHash: contentHash("Schiessen"), status: "AUTO" },
      { entityId: "b", field: "title", locale: "fr", value: "Ancien", sourceHash: contentHash("alt"), status: "AUTO" },
    ];
    const m = await displayContent("t1", "event", [{ id: "a", sources: { title: "Schiessen" } }, { id: "b", sources: { title: "Neu" } }], "fr");
    expect(m.get("a")).toMatchObject({ translated: true, fields: { title: "Tir" } });
    expect(m.get("b")).toMatchObject({ translated: false, fields: { title: "Neu" } });
    const de = await displayContent("t1", "event", [{ id: "a", sources: { title: "Schiessen" } }], "de");
    expect(de.get("a")!.translated).toBe(false);
  });
});
